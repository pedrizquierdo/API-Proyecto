import { consume, getChannel } from '../rabbit.js';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../topology.js';
import { createNotification, getUnreadCount } from '../../modules/notifications/notifications.model.js';
import { emitToUser } from '../../realtime/io.js';

// Single point of control for all notification creation.
// To add a new notification type, add a routing key binding in
// startNotificationsConsumer() and a new case in notificationDispatchHandler().

async function handleUserFollowed({ followerId, followingId }) {
  if (followerId === followingId) return;

  const notif = await createNotification(followingId, followerId, 'follow');
  if (!notif) return;

  const count = await getUnreadCount(followingId);
  emitToUser(followingId, 'notification:new', notif);
  emitToUser(followingId, 'notification:unread_count', { count });
}

async function handleReviewLiked({ likerId, reviewId, reviewAuthorId }) {
  if (!reviewAuthorId || reviewAuthorId === likerId) return;

  const notif = await createNotification(reviewAuthorId, likerId, 'review_like', reviewId);
  if (!notif) return;

  const count = await getUnreadCount(reviewAuthorId);
  emitToUser(reviewAuthorId, 'notification:new', notif);
  emitToUser(reviewAuthorId, 'notification:unread_count', { count });
}

async function notificationDispatchHandler(payload, msg) {
  const key = msg.fields.routingKey;

  if (key === ROUTING_KEYS.USER_FOLLOWED) {
    await handleUserFollowed(payload);
    return;
  }

  if (key === ROUTING_KEYS.REVIEW_LIKED) {
    await handleReviewLiked(payload);
    return;
  }

  // Unknown routing key — ack without processing so the message doesn't dead-letter.
  console.warn('[notifications.consumer] Routing key desconocida, descartando:', key);
}

async function startNotificationsConsumer() {
  await consume(QUEUES.NOTIFICATIONS_DISPATCHER.name, {
    exchange: EXCHANGES.EVENTS,
    routingKey: ROUTING_KEYS.USER_FOLLOWED,
    prefetch: 20,
    handler: notificationDispatchHandler,
  });

  // Second binding: review.liked events.
  // bindQueue is idempotent; safe to call on every worker start.
  const ch = getChannel();
  await ch.bindQueue(
    QUEUES.NOTIFICATIONS_DISPATCHER.name,
    EXCHANGES.EVENTS,
    ROUTING_KEYS.REVIEW_LIKED
  );

  console.log('Worker: consumer de notifications.dispatcher registrado');
}

export { startNotificationsConsumer };
