import { Router } from 'express';
import { getTrending, search, getById, getBySlug } from './game.controller.js';

const router = Router();

// Definición de Endpoints

// GET /api/games/trending
// Para la Landing Page y el Onboarding
router.get('/games/trending', getTrending);

// GET /api/games/search?q=nombre
// Para la barra de búsqueda global
router.get('/games/search', search);
// GET /api/games/:id
// Para la ficha técnica del juego (ID numérico interno)
router.get('/games/:id', getById);

// GET /api/games/slug/:slug
// (Opcional) Si prefieres usar URLs como hitboxd.com/game/god-of-war
router.get('/games/slug/:slug', getBySlug);
export default router;