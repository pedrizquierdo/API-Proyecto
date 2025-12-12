import { Router } from 'express';
import { getTrending, search, getById, getBySlug, getNewReleases } from './game.controller.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/new', getNewReleases);
router.get('/search', search);

router.get('/slug/:slug', getBySlug);


router.get('/:id', getById);

export default router;