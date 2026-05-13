import 'dotenv/config';
import '../config/db.js';
import { bootstrapQueues } from './bootstrap.js';
import { startGamesConsumer } from './consumers/games.consumer.js';
import { startSearchConsumer } from './consumers/search.consumer.js';
import { startNotificationsConsumer } from './consumers/notifications.consumer.js';
import { startScoresConsumer } from './consumers/scores.consumer.js';
import { startIgdbConsumer } from './consumers/igdb.consumer.js';
import { publish } from './rabbit.js';
import { EXCHANGES, ROUTING_KEYS } from './topology.js';
import { getTrendingAge } from '../modules/games/game.model.js';

const SCORES_INTERVAL_MS  = 15 * 60 * 1000;
const TRENDING_INTERVAL_MS     = 30 * 60 * 1000;
const NEW_RELEASES_INTERVAL_MS = 60 * 60 * 1000;
const TOP_RATED_INTERVAL_MS    =  6 * 60 * 60 * 1000;
const IGDB_STARTUP_STAGGER_MS  = 2000;

function publishIgdb(routingKey, source) {
  publish(EXCHANGES.EVENTS, routingKey, { source })
    .catch(err => console.error('[scheduler] Fallo al publicar ' + routingKey + ':', err.message));
}

async function main() {
  console.log('Worker: iniciando...');

  await bootstrapQueues();
  await startGamesConsumer();
  await startSearchConsumer();
  await startNotificationsConsumer();
  await startScoresConsumer();
  await startIgdbConsumer();

  // Publish a recompute event every 15 minutes; prefetch: 1 on the consumer
  // ensures only one worker processes it at a time.
  setInterval(() => {
    publish(EXCHANGES.EVENTS, ROUTING_KEYS.SCORES_RECOMPUTE_REQUESTED, { source: 'scheduler' })
      .catch(err => console.error('[scheduler] Fallo al publicar scores.recompute:', err.message));
  }, SCORES_INTERVAL_MS);

  // Periodic IGDB hydration — publish to the queue so the prefetch: 1 consumer
  // serializes execution even when multiple worker instances are running.
  setInterval(() => publishIgdb(ROUTING_KEYS.IGDB_REFRESH_TRENDING, 'scheduler'), TRENDING_INTERVAL_MS);
  setInterval(() => publishIgdb(ROUTING_KEYS.IGDB_REFRESH_NEW_RELEASES, 'scheduler'), NEW_RELEASES_INTERVAL_MS);
  setInterval(() => publishIgdb(ROUTING_KEYS.IGDB_REFRESH_TOP_RATED, 'scheduler'), TOP_RATED_INTERVAL_MS);

  // Startup hydration: skip if trending data is already fresh (< 30 min old)
  // to avoid hammering IGDB after a rolling restart. Stagger publishes 2 s apart
  // to respect IGDB rate limits when all three fire at once.
  const trendingAge = await getTrendingAge().catch(() => Infinity);
  if (trendingAge > TRENDING_INTERVAL_MS) {
    console.log('Worker: datos IGDB desactualizados, publicando hidratacion inicial...');
    publishIgdb(ROUTING_KEYS.IGDB_REFRESH_TRENDING, 'startup');
    setTimeout(() => publishIgdb(ROUTING_KEYS.IGDB_REFRESH_NEW_RELEASES, 'startup'), IGDB_STARTUP_STAGGER_MS);
    setTimeout(() => publishIgdb(ROUTING_KEYS.IGDB_REFRESH_TOP_RATED, 'startup'), IGDB_STARTUP_STAGGER_MS * 2);
  } else {
    console.log('Worker: datos IGDB recientes, omitiendo hidratacion inicial');
  }

  console.log('Worker: listo y escuchando mensajes');
}

main().catch((err) => {
  console.error('Worker: error fatal al iniciar:', err);
  process.exit(1);
});
