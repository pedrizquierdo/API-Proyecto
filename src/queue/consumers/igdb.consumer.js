// prefetch: 1 prevents concurrent IGDB calls from the same worker instance.
// If IGDB returns an error, the handler throws and the consume() wrapper nacks
// the message to the DLQ. The scheduler will retry on the next interval window.

import { consume, getChannel } from '../rabbit.js';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../topology.js';
import igdbService from '../../services/igdb.service.js';
import { enqueueGameUpsert } from '../producers/games.producer.js';
import { clearTrendingFlags } from '../../modules/games/game.model.js';

async function handleTrending() {
    const games = await igdbService._fetchTrending(20);
    // Reset stale trending flags before writing the new set.
    // There is a brief window between the clear and the async upserts where no
    // games have is_trending = TRUE; the HTTP handler's live-fallback path covers
    // that window without user-visible impact.
    await clearTrendingFlags();
    for (const game of games) {
        await enqueueGameUpsert({ ...game, is_trending: true });
    }
    console.log(`Worker: trending IGDB actualizado — ${games.length} juegos encolados`);
}

async function handleNewReleases() {
    const games = await igdbService._fetchNewReleases(20);
    for (const game of games) {
        await enqueueGameUpsert(game);
    }
    console.log(`Worker: new releases IGDB actualizados — ${games.length} juegos encolados`);
}

async function handleTopRated() {
    const games = await igdbService.getTopRated(20);
    for (const game of games) {
        await enqueueGameUpsert(game);
    }
    console.log(`Worker: top rated IGDB actualizado — ${games.length} juegos encolados`);
}

async function igdbRefreshHandler(payload, msg) {
    const key = msg.fields.routingKey;

    if (key === ROUTING_KEYS.IGDB_REFRESH_TRENDING) {
        await handleTrending();
        return;
    }
    if (key === ROUTING_KEYS.IGDB_REFRESH_NEW_RELEASES) {
        await handleNewReleases();
        return;
    }
    if (key === ROUTING_KEYS.IGDB_REFRESH_TOP_RATED) {
        await handleTopRated();
        return;
    }

    console.warn('[igdb.consumer] Routing key desconocida, descartando:', key);
}

async function startIgdbConsumer() {
    await consume(QUEUES.IGDB_REFRESH.name, {
        exchange: EXCHANGES.EVENTS,
        routingKey: ROUTING_KEYS.IGDB_REFRESH_TRENDING,
        prefetch: 1,
        handler: igdbRefreshHandler,
    });

    const ch = getChannel();
    await ch.bindQueue(QUEUES.IGDB_REFRESH.name, EXCHANGES.EVENTS, ROUTING_KEYS.IGDB_REFRESH_NEW_RELEASES);
    await ch.bindQueue(QUEUES.IGDB_REFRESH.name, EXCHANGES.EVENTS, ROUTING_KEYS.IGDB_REFRESH_TOP_RATED);

    console.log('Worker: consumer de igdb.refresh registrado');
}

export { startIgdbConsumer };
