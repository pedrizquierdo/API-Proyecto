import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookiePkg from 'cookie';
import { allowedOrigins } from '../config/origins.js';

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

function attachIo(server) {
  io.attach(server);
}

function emitToUser(userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

export { io, attachIo, emitToUser };
