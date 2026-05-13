// prefetch: 1 ensures only one recompute runs at a time across all worker
// instances. RabbitMQ will not deliver the next message until the current one
// is acked, so even if the scheduler fires a second message before the first
// recompute finishes, the second message simply waits in the queue.

import { consume } from '../rabbit.js';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../topology.js';
import { recomputeHitboxdScores } from '../../modules/games/game.model.js';

async function scoresRecomputeHandler(payload) {
  const source = payload?.source ?? 'unknown';
  const start = Date.now();

  console.log(`Worker: iniciando recomputo de scores (source: ${source})`);

  const count = await recomputeHitboxdScores();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`Worker: recomputo de scores completado — ${count} filas en ${elapsed}s`);
}

async function startScoresConsumer() {
  await consume(QUEUES.SCORES_RECOMPUTE.name, {
    exchange: EXCHANGES.EVENTS,
    routingKey: ROUTING_KEYS.SCORES_RECOMPUTE_REQUESTED,
    prefetch: 1,
    handler: scoresRecomputeHandler,
  });

  console.log('Worker: consumer de scores.recompute registrado');
}

export { startScoresConsumer };
