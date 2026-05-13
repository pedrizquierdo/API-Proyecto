const EXCHANGES = {
  EVENTS: 'hitboxd.events',
  COMMANDS: 'hitboxd.commands',
};

// DLQ names follow the convention established by rabbit.js consume():
// dead-letter exchange = <exchange>.dlx, dead-letter queue = <queueName>.dlx
const QUEUES = {
  GAMES_UPSERT: {
    name: 'games.upsert',
    exchange: EXCHANGES.EVENTS,
    routingKey: 'game.upsert.requested',
    // DLQ: games.upsert.dlx (created automatically by consume() via x-dead-letter-exchange)
    // TODO: add x-dead-letter-routing-key support to rabbit.js consume() if per-queue
    // DLX routing keys are needed (currently inherits original routing key).
  },
};

// Routing keys that are published by consumers as domain events (not queue bindings):
const ROUTING_KEYS = {
  GAME_UPSERTED: 'game.upserted',
};

export { EXCHANGES, QUEUES, ROUTING_KEYS };
