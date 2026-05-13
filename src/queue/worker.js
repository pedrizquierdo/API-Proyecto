import 'dotenv/config';
import '../config/db.js';
import { bootstrapQueues } from './bootstrap.js';
import { startGamesConsumer } from './consumers/games.consumer.js';
import { startSearchConsumer } from './consumers/search.consumer.js';
import { startNotificationsConsumer } from './consumers/notifications.consumer.js';
import { startScoresConsumer } from './consumers/scores.consumer.js';
import { publish } from './rabbit.js';
import { EXCHANGES, ROUTING_KEYS } from './topology.js';

const SCORES_INTERVAL_MS = 15 * 60 * 1000;

async function main() {
  console.log('Worker: iniciando...');

  await bootstrapQueues();
  await startGamesConsumer();
  await startSearchConsumer();
  await startNotificationsConsumer();
  await startScoresConsumer();

  // Publish a recompute event every 15 minutes instead of calling
  // recomputeHitboxdScores() directly. Publishing to the queue guarantees that
  // only one worker processes the message at a time (prefetch: 1 on the consumer)
  // even when multiple worker instances are running.
  setInterval(() => {
    publish(EXCHANGES.EVENTS, ROUTING_KEYS.SCORES_RECOMPUTE_REQUESTED, { source: 'scheduler' })
      .catch(err => console.error('[scheduler] Fallo al publicar scores.recompute:', err.message));
  }, SCORES_INTERVAL_MS);

  console.log('Worker: listo y escuchando mensajes');
}

main().catch((err) => {
  console.error('Worker: error fatal al iniciar:', err);
  process.exit(1);
});
