import http from 'node:http';
import express from "express";
import dotenv from "dotenv";
import cookie from "cookie-parser";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import rateLimit from "express-rate-limit";
import searchService from "./services/search.service.js";
import { attachIo } from "./realtime/io.js";
import { bootstrapQueues } from "./queue/bootstrap.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import gameRoutes from "./modules/games/game.routes.js";
import activityRoutes from "./modules/activity/activity.routes.js";
import reviewRoutes from "./modules/reviews/reviews.routes.js";
import listRoutes from "./modules/lists/lists.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json());
app.use(cookie());
app.use(cors(corsOptions));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Demasiadas peticiones, intenta de nuevo mas tarde",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Demasiados intentos de inicio de sesion, intenta en 15 minutos",
  skipSuccessfulRequests: true,
});

app.use(generalLimiter);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

searchService.search('__warmup__').catch(() => {});

if (process.env.RABBITMQ_URL) {
  try {
    await bootstrapQueues();
  } catch (err) {
    console.error('Error fatal al inicializar RabbitMQ:', err);
    process.exit(1);
  }
} else {
  console.warn('RABBITMQ_URL no definida, arrancando sin cola de mensajes');
}

attachIo(server);

server.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') console.log(`Servidor corriendo en el puerto: ${PORT}`);
});
