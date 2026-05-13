// Fan-out-on-write consumer for the activity/review feed.
//
// Responsibilities:
//   activity.created  — fan-out to all followers: bulk-insert feed_items + real-time push
//   review.created    — same
//   activity.deleted  — remove feed_items for the deleted activity
//   review.deleted    — remove feed_items for the deleted review
//   feed.cleanup.requested — delete feed_items older than 90 days in batches
//
// TODO: celebrity fan-out (accounts with >50k followers): the current push fan-out
// writes one feed_items row per follower, which becomes a write bottleneck for very
// large follow graphs. The standard mitigation is a hybrid model: push for regular
// accounts (< N followers), pull-on-read for celebrities. Implement by checking
// follower count before fan-out and skipping insertFeedItems for celebrities while
// still emitting the Socket.io push. The read endpoint would then merge
// getFeedFor(userId) + latestFromCelebrities(userId) at query time.

import { consume, getChannel } from '../rabbit.js';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../topology.js';
import {
    insertFeedItems,
    deleteFeedItemsByReference,
    cleanupOldFeedItems,
} from '../../modules/activity/feed.model.js';
import { getFollowerIds } from '../../modules/users/user.model.js';
import { emitToUser } from '../../realtime/io.js';

const FANOUT_CHUNK_SIZE = 1000;

async function handleActivityCreated({ id_user, id_game, payload }) {
    const followerIds = await getFollowerIds(id_user);
    if (followerIds.length === 0) return;

    const payloadJson = JSON.stringify(payload);

    for (let i = 0; i < followerIds.length; i += FANOUT_CHUNK_SIZE) {
        const chunk = followerIds.slice(i, i + FANOUT_CHUNK_SIZE);

        const rows = chunk.map(followerId => ({
            id_user:      followerId,
            id_actor:     id_user,
            event_type:   'activity',
            id_reference: id_game,
            id_game,
            payload_json: payloadJson,
        }));

        await insertFeedItems(rows);

        // Real-time push for connected followers. Fire-and-forget per follower;
        // Socket.io is best-effort and does not affect DB consistency.
        for (const followerId of chunk) {
            emitToUser(followerId, 'feed:activity', payload);
        }
    }

    console.log(`Worker: feed activity faneada — actor ${id_user}, juego ${id_game}, ${followerIds.length} seguidores`);
}

async function handleReviewCreated({ id_review, id_user, id_game, payload }) {
    const followerIds = await getFollowerIds(id_user);
    if (followerIds.length === 0) return;

    const payloadJson = JSON.stringify(payload);

    for (let i = 0; i < followerIds.length; i += FANOUT_CHUNK_SIZE) {
        const chunk = followerIds.slice(i, i + FANOUT_CHUNK_SIZE);

        const rows = chunk.map(followerId => ({
            id_user:      followerId,
            id_actor:     id_user,
            event_type:   'review',
            id_reference: id_review,
            id_game:      id_game ?? null,
            payload_json: payloadJson,
        }));

        await insertFeedItems(rows);

        for (const followerId of chunk) {
            emitToUser(followerId, 'feed:review', payload);
        }
    }

    console.log(`Worker: feed review faneada — actor ${id_user}, review ${id_review}, ${followerIds.length} seguidores`);
}

async function handleActivityDeleted({ id_user, id_game }) {
    await deleteFeedItemsByReference('activity', id_game, id_user);
}

async function handleReviewDeleted({ id_review }) {
    await deleteFeedItemsByReference('review', id_review);
}

async function feedFanoutHandler(payload, msg) {
    const key = msg.fields.routingKey;

    if (key === ROUTING_KEYS.ACTIVITY_CREATED)    { await handleActivityCreated(payload); return; }
    if (key === ROUTING_KEYS.REVIEW_CREATED_FEED)  { await handleReviewCreated(payload);   return; }
    if (key === ROUTING_KEYS.ACTIVITY_DELETED_FEED){ await handleActivityDeleted(payload);  return; }
    if (key === ROUTING_KEYS.REVIEW_DELETED_FEED)  { await handleReviewDeleted(payload);    return; }

    console.warn('[feed.consumer] Routing key desconocida, descartando:', key);
}

async function cleanupHandler() {
    const start = Date.now();
    const count = await cleanupOldFeedItems(10_000);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`Worker: limpieza de feed_items completada — ${count} filas en ${elapsed}s`);
}

async function startFeedConsumer() {
    await consume(QUEUES.FEED_FANOUT.name, {
        exchange:   EXCHANGES.EVENTS,
        routingKey: ROUTING_KEYS.ACTIVITY_CREATED,
        prefetch:   5,
        handler:    feedFanoutHandler,
    });

    const ch = getChannel();
    await ch.bindQueue(QUEUES.FEED_FANOUT.name, EXCHANGES.EVENTS, ROUTING_KEYS.REVIEW_CREATED_FEED);
    await ch.bindQueue(QUEUES.FEED_FANOUT.name, EXCHANGES.EVENTS, ROUTING_KEYS.ACTIVITY_DELETED_FEED);
    await ch.bindQueue(QUEUES.FEED_FANOUT.name, EXCHANGES.EVENTS, ROUTING_KEYS.REVIEW_DELETED_FEED);

    await consume(QUEUES.FEED_CLEANUP.name, {
        exchange:   EXCHANGES.EVENTS,
        routingKey: ROUTING_KEYS.FEED_CLEANUP_REQUESTED,
        prefetch:   1,
        handler:    cleanupHandler,
    });

    console.log('Worker: consumers de feed.fanout y feed.cleanup registrados');
}

export { startFeedConsumer };
