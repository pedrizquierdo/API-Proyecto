import { Router } from 'express';
import { getTrending, search, getById, getBySlug } from './game.controller.js';

const router = Router();


router.get('/games/trending', getTrending);
router.get('/games/search', search);
router.get('/games/:id', getById);
router.get('/games/slug/:slug', getBySlug);
export default router;