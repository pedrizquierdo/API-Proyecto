import { Router } from 'express';
import { getTrending, search, getById, getBySlug } from './game.controller.js';

const router = Router();


router.get('/trending', getTrending);
router.get('/search', search);
router.get('/:id', getById);
router.get('/:slug', getBySlug);
export default router;