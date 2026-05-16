/**
 * Socket.io singleton. Attach to an http.Server before accepting connections.
 *
 * Room membership is ephemeral. If the server restarts, all rooms are cleared.
 * Clients are responsible for re-joining game rooms after a reconnect by re-emitting
 * game:join. The server intentionally does not persist room membership.
 *
 * Convention for game-room events: every event includes an actor_id field so the
 * client that originated the action can discard the event when actor_id matches
 * the current user (avoiding double-application of an optimistic update).
 *
 * Privacy note: game:presence only emits a numeric count, never a list of usernames
 * or avatars. A "who is watching" feature would require an explicit opt-in flow and
 * must filter users where users.is_visible = true before exposing identities.
 *
 * Emitted events (server -> client):
 *
 * notification:new
 *   Payload: { id_notification, type, id_reference, is_read, created_at, actor_username, actor_avatar }
 *   Fired when a new notification is created for a user (follow, review_like, ...).
 *   Room: user:<userId>
 *
 * notification:unread_count
 *   Payload: { count: number }
 *   Fired after notification:new and on initial connection so the client badge stays in sync.
 *   Room: user:<userId>
 *
 * notification:read
 *   Payload: { all: true } | { id: string }
 *   Fired when the user marks one or all notifications as read (e.g. from another tab).
 *   Room: user:<userId>
 *
 * feed:activity
 *   Payload: { activity_date, status, rating, is_favorite, is_liked, id_user, username,
 *              avatar_url, id_game, title, cover_url, slug }
 *   Fired when a followed user logs or updates a game activity.
 *   Room: user:<followerId>  (one emit per follower via fanoutToFollowers)
 *   Note: follows_you is omitted because it is viewer-relative; resolve on the client if needed.
 *
 * feed:review
 *   Payload: { id_review, id_user, username, avatar_url, id_game, title, cover_url, content,
 *              rating, created_at }
 *   Fired when a followed user publishes a new review.
 *   Room: user:<followerId>  (one emit per follower via fanoutToFollowers)
 *
 * review:like_changed
 *   Payload: { id_review: number, count: number, actor_id: number }
 *   Fired when any user likes or unlikes a review. Broadcast to all clients viewing that game.
 *   actor_id identifies who triggered the change; clients should ignore the event when
 *   actor_id === current_user_id to avoid conflicting with their own optimistic update.
 *   Room: game:<gameId>
 *
 * review:created
 *   Payload: { id_review, id_user, username, avatar_url, id_game, title, cover_url, content,
 *              rating, created_at }
 *   Fired when a review is published. Clients on the game page can prepend it to the list.
 *   actor_id is id_user in the payload; discard if actor_id === current_user_id.
 *   Room: game:<gameId>
 *
 * review:deleted
 *   Payload: { id_review: number }
 *   Fired after a review is removed. Clients should remove it from the list if present.
 *   Room: game:<gameId>
 *
 * game:presence
 *   Payload: { gameId: number, count: number }
 *   Fired to all clients in a game room when the viewer count changes (join, leave, or
 *   disconnect). Debounced to at most one emission per room per second so rapid
 *   join/leave bursts do not flood clients.
 *   Room: game:<gameId>
 *
 * moderation:report_new
 *   Payload: { id_review, content, created_at, review_username, game_title, game_cover_url,
 *              report_count, all_reasons }
 *   Fired when a user submits a new report. Shape mirrors getReportedReviewsList rows so
 *   the admin dashboard can append the item without a full re-fetch.
 *   Room: admin
 *
 * moderation:resolved
 *   Payload: { id_review: number }
 *   Fired after a reported review is approved (reports dismissed) or deleted by an admin.
 *   Admin dashboards remove the matching item on receipt.
 *   Room: admin
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookiePkg from 'cookie';
import { allowedOrigins } from '../config/origins.js';
import { getUnreadCount } from '../modules/notifications/notifications.model.js';

const io = new Server({
  cors: {
    origin: (origin, callback) => {
      // Clientes nativos (Android, iOS, Postman) no envian Origin
      if (!origin) return callback(null, true);
      // Origenes web: validar contra la lista
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin bloqueado por CORS: ${origin}`));
    },
    credentials: true,
  },
});

// TODO: adapter Redis para horizontal scaling
// When running multiple Node processes, io.sockets.adapter.rooms only reflects
// sockets connected to the current process. Switch to @socket.io/redis-adapter
// so presence counts are accurate across all instances.
const presenceTimers = new Map();

function schedulePresenceEmit(gameId) {
  if (presenceTimers.has(gameId)) {
    clearTimeout(presenceTimers.get(gameId));
  }
  presenceTimers.set(
    gameId,
    setTimeout(() => {
      presenceTimers.delete(gameId);
      // Read count inside the callback, not at schedule time, so that:
      // - rapid join/leave bursts resolve to the final stable value, and
      // - disconnecting sockets have fully left the room by the time this runs
      //   (Socket.io completes room cleanup within the same event-loop tick),
      //   so no manual -1 adjustment is needed here.
      const count = io.sockets.adapter.rooms.get(`game:${gameId}`)?.size ?? 0;
      io.to(`game:${gameId}`).emit('game:presence', { gameId, count });
    }, 1000)
  );
}

io.use((socket, next) => {
  const rawCookie = socket.handshake.headers.cookie;

  if (!rawCookie) return next(new Error('unauthorized'));

  const cookies = cookiePkg.parse(rawCookie);
  const { token } = cookies;

  if (!token) return next(new Error('unauthorized'));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('unauthorized'));

    socket.data.user = {
      id_user: decoded.id_user,
      role: decoded.role,
    };

    socket.join(`user:${decoded.id_user}`);

    // Admin room is joined at handshake time so the role encoded in the JWT
    // is the authority. If a user is promoted to admin mid-session, the 'admin'
    // room subscription only takes effect on the next reconnect (new handshake,
    // fresh JWT). The server does not re-evaluate role after the initial connection.
    if (decoded.role === 'admin') {
      socket.join('admin');
    }

    next();
  });
});

io.on('connection', async (socket) => {
  const { id_user } = socket.data.user;

  // feed:<userId> is reserved for potential grouped broadcasts in the future;
  // individual fan-out currently delivers to user:<followerId> directly.
  socket.join(`feed:${id_user}`);

  socket.on('game:join', ({ gameId } = {}) => {
    if (!Number.isInteger(gameId) || gameId <= 0) return;
    socket.join(`game:${gameId}`);
    schedulePresenceEmit(gameId);
  });

  socket.on('game:leave', ({ gameId } = {}) => {
    if (!Number.isInteger(gameId) || gameId <= 0) return;
    socket.leave(`game:${gameId}`);
    schedulePresenceEmit(gameId);
  });

  socket.on('disconnecting', () => {
    // 'disconnecting' fires while socket.rooms still contains the joined rooms.
    // We schedule via schedulePresenceEmit rather than emitting immediately:
    // by the time the 1000ms timer fires the socket has fully disconnected and
    // the adapter has removed it from the room, so the count is already correct
    // without subtracting 1 manually.
    for (const room of socket.rooms) {
      if (!room.startsWith('game:')) continue;
      const gameId = parseInt(room.slice(5), 10);
      if (Number.isInteger(gameId) && gameId > 0) {
        schedulePresenceEmit(gameId);
      }
    }
  });

  try {
    const count = await getUnreadCount(id_user);
    socket.emit('notification:unread_count', { count });
  } catch {
    // non-fatal: client will sync on next poll or action
  }
});

function attachIo(server) {
  io.attach(server);
}

function emitToUser(userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

function emitToGame(gameId, event, payload) {
  io.to(`game:${gameId}`).emit(event, payload);
}

function emitToAdmins(event, payload) {
  io.to('admin').emit(event, payload);
}

export { io, attachIo, emitToUser, emitToGame, emitToAdmins };
