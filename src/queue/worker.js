import 'dotenv/config';
import '../config/db.js';
import { bootstrapQueues } from './bootstrap.js';
import { startGamesConsumer } from './consumers/games.consumer.js';
import { startSearchConsumer } from './consumers/search.consumer.js';

async function main() {
  console.log('Worker: iniciando...');

  await bootstrapQueues();
  await startGamesConsumer();
  await startSearchConsumer();

  console.log('Worker: listo y escuchando mensajes');
}

main().catch((err) => {
  console.error('Worker: error fatal al iniciar:', err);
  process.exit(1);
});
