/**
 * Domain event producers for user and social actions.
 *
 * Each function publishes a single domain event to the events exchange and
 * returns immediately. Notification creation and Socket.io delivery are the
 * responsibility of the notifications.consumer — this module knows nothing
 * about notifications.
 *
 * Trade-off: if the broker is unavailable at publish time, the event is lost
 * and no notification is created. The underlying action (follow, like) has
 * already been committed to MySQL and is NOT rolled back. This is intentional:
 * breaking the user-visible action to preserve a notification is worse than
 * silently dropping the notification. rabbit.js scheduleReconnect() runs in
 * the background, so subsequent events resume automatically once the broker
 * recovers.
 */

import { publish } from '../rabbit.js';
import { EXCHANGES, ROUTING_KEYS } from '../topology.js';

/**
 * @param {{ followerId: number, followingId: number }} payload
 */
async function emitUserFollowed({ followerId, followingId }) {
  await publish(EXCHANGES.EVENTS, ROUTING_KEYS.USER_FOLLOWED, {
    followerId,
    followingId,
  });
}

/**
 * @param {{ likerId: number, reviewId: number, reviewAuthorId: number, gameId: number | null }} payload
 */
async function emitReviewLiked({ likerId, reviewId, reviewAuthorId, gameId }) {
  await publish(EXCHANGES.EVENTS, ROUTING_KEYS.REVIEW_LIKED, {
    likerId,
    reviewId,
    reviewAuthorId,
    gameId: gameId ?? null,
  });
}

export { emitUserFollowed, emitReviewLiked };
