import { publish } from '../rabbit.js';
import { createOrUpdateGame } from '../../modules/games/game.model.js';
import { EXCHANGES, QUEUES } from '../topology.js';

const REQUIRED_FIELDS = ['igdb_id', 'title', 'slug', 'cover_url'];

async function enqueueGameUpsert(gameData) {
  if (!REQUIRED_FIELDS.every(f => gameData[f] != null)) {
    console.warn('[games.producer] Datos de juego incompletos, descartando igdb_id:', gameData?.igdb_id ?? 'desconocido');
    return;
  }

  try {
    await publish(EXCHANGES.EVENTS, QUEUES.GAMES_UPSERT.routingKey, gameData);
  } catch (err) {
    // Broker unavailable: fall back to synchronous upsert so no game is lost.
    // rabbit.js scheduleReconnect() is already running in the background, so
    // publishing will resume automatically once the broker comes back.
    console.warn('[games.producer] Broker no disponible, ejecutando upsert directo:', err.message);
    await createOrUpdateGame(gameData);
  }
}

export { enqueueGameUpsert };
