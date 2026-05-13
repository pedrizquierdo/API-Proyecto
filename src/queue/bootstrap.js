import { connect, assertExchanges } from './rabbit.js';
import { EXCHANGES } from './topology.js';

async function bootstrapQueues() {
  await connect();
  await assertExchanges(EXCHANGES);
  console.log('RabbitMQ: topologia inicializada');
}

export { bootstrapQueues };
