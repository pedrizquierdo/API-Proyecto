import { consume, publish } from '../rabbit.js';
import { createOrUpdateGame, upsertGameGenres } from '../../modules/games/game.model.js';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../topology.js';

// Idempotency: createOrUpdateGame uses INSERT ... ON DUPLICATE KEY UPDATE keyed on
// igdb_id (UNIQUE constraint), so reprocessing the same message is safe.

async function gameUpsertHandler(payload) {
  const id_game = await createOrUpdateGame(payload);

  if (Array.isArray(payload.genres) && payload.genres.length > 0) {
    await upsertGameGenres(id_game, payload.genres);
  }

  // Publish a domain event so downstream consumers (e.g. search reindex, Bloque 7)
  // can react without coupling to this handler.
  // TODO: if the publish here fails, the MySQL upsert already succeeded but the
  // message will be nacked to DLQ. On replay from DLQ the upsert is idempotent,
  // but game.upserted may fire twice — downstream handlers must also be idempotent.
  await publish(EXCHANGES.EVENTS, ROUTING_KEYS.GAME_UPSERTED, {
    id_game,
    igdb_id: payload.igdb_id,
    title: payload.title,
    slug: payload.slug,
  });
}

async function startGamesConsumer() {
  // TODO: delayed-exchange retry plugin is the recommended path for automatic
  // retries with backoff. Until then, failed messages land in games.upsert.dlx
  // (the DLQ) and must be replayed manually or via a scheduled task.
  await consume(QUEUES.GAMES_UPSERT.name, {
    exchange: EXCHANGES.EVENTS,
    routingKey: QUEUES.GAMES_UPSERT.routingKey,
    prefetch: 10,
    handler: gameUpsertHandler,
  });
  console.log('Worker: consumer de games.upsert registrado');
}

export { startGamesConsumer };
