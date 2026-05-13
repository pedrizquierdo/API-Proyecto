import { getFollowerIds } from '../modules/users/user.model.js';
import { emitToUser } from './io.js';

// TODO: si el actor tiene >500 followers, encolar a RabbitMQ (ver Bloque 8)
function fanoutToFollowers(actorId, event, payload) {
  setImmediate(async () => {
    try {
      const followerIds = await getFollowerIds(actorId);
      for (const followerId of followerIds) {
        emitToUser(followerId, event, payload);
      }
    } catch (err) {
      console.error('[fanout]', err.message);
    }
  });
}

export { fanoutToFollowers };
