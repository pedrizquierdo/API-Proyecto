/**
 * @module rabbit
 * @description Singleton de RabbitMQ con reconexion automatica y soporte de DLX.
 *
 * Variables de entorno:
 * @env RABBITMQ_URL - URL de conexion al broker.
 *   Formato local:     amqp://localhost:5672
 *   Formato CloudAMQP: amqps://user:pass@hostname/vhost
 *   Formato Railway:   amqp://user:pass@hostname:port/vhost
 */

import amqplib from 'amqplib';

let connection = null;
let channel = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
let isConnecting = false;

async function connect() {
  if (channel) return;
  if (isConnecting) return;

  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL no esta definida');

  isConnecting = true;

  try {
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();
    reconnectDelay = 1000;
    isConnecting = false;

    connection.on('error', (err) => {
      console.error('RabbitMQ: error de conexion:', err.message);
      scheduleReconnect();
    });

    connection.on('close', () => {
      console.error('RabbitMQ: conexion cerrada, reconectando...');
      scheduleReconnect();
    });

    channel.on('error', (err) => {
      console.error('RabbitMQ: error de canal:', err.message);
      channel = null;
      scheduleReconnect();
    });

    channel.on('close', () => {
      channel = null;
      scheduleReconnect();
    });

    console.log('RabbitMQ: conexion establecida');
  } catch (err) {
    isConnecting = false;
    connection = null;
    channel = null;
    console.error('RabbitMQ: fallo al conectar:', err.message);
    scheduleReconnect();
    throw err;
  }
}

function scheduleReconnect() {
  if (isConnecting) return;

  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);

  connection = null;
  channel = null;

  setTimeout(() => {
    connect().catch(() => {});
  }, delay);
}

function getChannel() {
  if (!channel) throw new Error('Canal de RabbitMQ no disponible');
  return channel;
}

async function assertExchanges(exchanges) {
  const ch = getChannel();
  for (const name of Object.values(exchanges)) {
    await ch.assertExchange(name, 'topic', { durable: true });
    await ch.assertExchange(`${name}.dlx`, 'topic', { durable: true });
  }
}

async function publish(exchange, routingKey, payload, options = {}) {
  const ch = getChannel();
  const { exchangeType = 'topic', ...publishOptions } = options;

  await ch.assertExchange(exchange, exchangeType, { durable: true });

  const content = Buffer.from(JSON.stringify(payload));

  ch.publish(exchange, routingKey, content, {
    persistent: true,
    ...publishOptions,
  });
}

async function consume(queueName, { exchange, routingKey, prefetch = 10, handler }) {
  const ch = getChannel();
  const dlxExchange = `${exchange}.dlx`;
  const dlxQueue = `${queueName}.dlx`;

  await ch.assertExchange(exchange, 'topic', { durable: true });
  await ch.assertExchange(dlxExchange, 'topic', { durable: true });

  await ch.assertQueue(dlxQueue, { durable: true });
  await ch.bindQueue(dlxQueue, dlxExchange, routingKey);

  await ch.assertQueue(queueName, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': dlxExchange },
  });
  await ch.bindQueue(queueName, exchange, routingKey);

  await ch.prefetch(prefetch);

  await ch.consume(queueName, async (msg) => {
    if (!msg) return;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      ch.nack(msg, false, false);
      return;
    }

    try {
      await handler(payload, msg);
      ch.ack(msg);
    } catch (err) {
      console.error(`RabbitMQ: error procesando mensaje de ${queueName}:`, err.message);
      ch.nack(msg, false, false);
    }
  });
}

export { connect, getChannel, assertExchanges, publish, consume };
