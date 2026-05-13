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

  SEARCH_REINDEX: {
    name: 'search.reindex',
    exchange: EXCHANGES.EVENTS,
    // Primary binding set via consume(). Second binding (SEARCH_REINDEX_REQUESTED)
    // is added manually in startSearchConsumer() after the queue is asserted.
    routingKey: 'game.upserted',
    // DLQ: search.reindex.dlx
  },

  NOTIFICATIONS_DISPATCHER: {
    name: 'notifications.dispatcher',
    exchange: EXCHANGES.EVENTS,
    // Primary binding set via consume() using the first routing key.
    // Additional bindings (review.liked) are added manually in
    // startNotificationsConsumer() after the queue is asserted.
    routingKey: 'user.followed',
    // DLQ: notifications.dispatcher.dlx
  },

  SCORES_RECOMPUTE: {
    name: 'scores.recompute',
    exchange: EXCHANGES.EVENTS,
    routingKey: 'scores.recompute.requested',
    // prefetch: 1 — only one recompute runs at a time across all workers.
    // DLQ: scores.recompute.dlx
  },
};

// Routing keys published by consumers as domain events, and by producers
// for commands that are not tied to a specific queue binding.
const ROUTING_KEYS = {
  GAME_UPSERTED: 'game.upserted',
  SEARCH_REINDEX_REQUESTED: 'search.reindex.requested',
  USER_FOLLOWED: 'user.followed',
  REVIEW_LIKED: 'review.liked',
  SCORES_RECOMPUTE_REQUESTED: 'scores.recompute.requested',
};

export { EXCHANGES, QUEUES, ROUTING_KEYS };
