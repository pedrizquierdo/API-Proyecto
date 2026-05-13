/**
 * Socket.io singleton. Attach to an http.Server before accepting connections.
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
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookiePkg from 'cookie';
import { allowedOrigins } from '../config/origins.js';
import { getUnreadCount } from '../modules/notifications/notifications.model.js';

const io = new Server({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

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
    next();
  });
});

io.on('connection', async (socket) => {
  try {
    const count = await getUnreadCount(socket.data.user.id_user);
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

export { io, attachIo, emitToUser };
