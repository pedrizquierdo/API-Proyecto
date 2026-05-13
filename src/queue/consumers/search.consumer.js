import { consume, getChannel } from '../rabbit.js';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../topology.js';
import searchService from '../../services/search.service.js';

// Debounce state lives in worker process memory only.
// If the worker restarts within the 10 s window, the pending timer is lost.
// Correctness is preserved: the SearchService TTL (5 min) forces a rebuild on
// the next query, and any subsequent upsert event will reschedule invalidation.
// TODO: if guaranteed post-restart reindex is required, replace this timer with
// a TTL queue message or a persistent cron schedule.

const DEBOUNCE_MS = 10_000;
let reindexTimer = null;

async function runReindex() {
  searchService.invalidateIndex();
  await searchService.search('__warmup__');
  console.log('Worker: indice de busqueda reconstruido');
}

function scheduleReindex() {
  if (reindexTimer) clearTimeout(reindexTimer);
  reindexTimer = setTimeout(async () => {
    reindexTimer = null;
    try {
      await runReindex();
    } catch (err) {
      console.error('[search.consumer] Fallo en reindex diferido:', err.message);
    }
  }, DEBOUNCE_MS);
}

// The consume() wrapper acks after this function returns.
// For the debounce path (game.upserted) the function returns synchronously,
// so the ack is immediate and the timer fires independently.
// For the forced path (search.reindex.requested) we await runReindex() so
// the caller knows the reindex completed before we ack.
async function searchReindexHandler(payload, msg) {
  if (msg.fields.routingKey === ROUTING_KEYS.SEARCH_REINDEX_REQUESTED) {
    if (reindexTimer) {
      clearTimeout(reindexTimer);
      reindexTimer = null;
    }
    try {
      await runReindex();
    } catch (err) {
      console.error('[search.consumer] Fallo en reindex forzado:', err.message);
    }
    return;
  }

  // game.upserted: collapse N upsert events into a single reindex at the end
  // of the burst. Does not throw, so ack always fires.
  scheduleReindex();
}

async function startSearchConsumer() {
  // consume() asserts the queue with DLX and binds the primary routing key.
  await consume(QUEUES.SEARCH_REINDEX.name, {
    exchange: EXCHANGES.EVENTS,
    routingKey: ROUTING_KEYS.GAME_UPSERTED,
    prefetch: 50,
    handler: searchReindexHandler,
  });

  // Second binding: admin-triggered immediate reindex.
  // bindQueue is idempotent; safe to call on every worker start.
  const ch = getChannel();
  await ch.bindQueue(
    QUEUES.SEARCH_REINDEX.name,
    EXCHANGES.EVENTS,
    ROUTING_KEYS.SEARCH_REINDEX_REQUESTED
  );

  console.log('Worker: consumer de search.reindex registrado');
}

export { startSearchConsumer };
