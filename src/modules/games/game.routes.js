import { Router } from 'express';
import { getTrending, search, getById, getBySlug, getNewReleases } from './game.controller.js';

const router = Router();


router.get('/trending', getTrending);
router.get('/new', getNewReleases);
router.get('/search', search);
router.get('/:id', getById);
router.get('/:slug', getBySlug);
export default router;