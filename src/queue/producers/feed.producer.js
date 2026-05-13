/**
 * Feed fan-out event producers.
 *
 * These functions publish domain events that the feed.consumer will process
 * asynchronously: writing feed_items rows for every follower and emitting
 * Socket.io pushes to connected clients.
 *
 * Trade-off (same as events.producer.js): if the broker is unavailable, the
 * event is dropped and the fan-out does not happen for this action. The
 * underlying write (activity / review creation) is already committed to MySQL
 * and is NOT rolled back. Followers will see the item on their next full-refresh
 * once the broker recovers and future events resume. This is acceptable; breaking
 * the user's save action to preserve a feed entry is not.
 */

import { publish } from '../rabbit.js';
import { EXCHANGES, ROUTING_KEYS } from '../topology.js';

/**
 * @param {{ id_activity: number, id_user: number, id_game: number, payload: object }} p
 * id_activity is id_game for activities (user_games uses a composite PK with no
 * standalone auto-increment id). The consumer uses (id_actor, id_game) to identify
 * the row when handling activity.deleted.
 */
async function emitActivityCreated({ id_activity, id_user, id_game, payload }) {
    await publish(EXCHANGES.EVENTS, ROUTING_KEYS.ACTIVITY_CREATED, {
        id_activity,
        id_user,
        id_game,
        payload,
    });
}

/**
 * @param {{ id_review: number, id_user: number, id_game: number, payload: object }} p
 */
async function emitReviewCreatedForFeed({ id_review, id_user, id_game, payload }) {
    await publish(EXCHANGES.EVENTS, ROUTING_KEYS.REVIEW_CREATED_FEED, {
        id_review,
        id_user,
        id_game,
        payload,
    });
}

/**
 * Publish when a user_games row is deleted.
 * Call this from the activity delete endpoint (not yet implemented) once it exists.
 * @param {{ id_user: number, id_game: number }} p
 */
async function emitActivityDeleted({ id_user, id_game }) {
    await publish(EXCHANGES.EVENTS, ROUTING_KEYS.ACTIVITY_DELETED_FEED, {
        id_user,
        id_game,
    });
}

/**
 * @param {{ id_review: number }} p
 */
async function emitReviewDeletedForFeed({ id_review }) {
    await publish(EXCHANGES.EVENTS, ROUTING_KEYS.REVIEW_DELETED_FEED, {
        id_review,
    });
}

export {
    emitActivityCreated,
    emitReviewCreatedForFeed,
    emitActivityDeleted,
    emitReviewDeletedForFeed,
};
