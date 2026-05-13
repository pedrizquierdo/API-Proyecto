import 'dotenv/config';
import '../config/db.js';
import { bootstrapQueues } from './bootstrap.js';

async function main() {
  console.log('Worker: iniciando...');

  await bootstrapQueues();

  // Registrar consumers aqui a medida que se implementen features
  // Ejemplo:
  // await consume('some.queue', { exchange: EXCHANGES.EVENTS, routingKey: 'some.key', handler })

  console.log('Worker: listo y escuchando mensajes');
}

main().catch((err) => {
  console.error('Worker: error fatal al iniciar:', err);
  process.exit(1);
});
