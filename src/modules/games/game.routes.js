import { Router } from 'express';
import { getTrending, search, searchPage, getById, getBySlug, getNewReleases, getRandom, getPopularOnHitboxd, getRecommended, getExtras, getStats, triggerReindex } from './game.controller.js';
import { verifyToken, verifyAdmin } from '../../middlewares/authMiddleware.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/new', getNewReleases);
router.get('/search', search);
router.get('/search-page', searchPage);
router.get('/random', verifyToken, getRandom);
router.get('/recommended', verifyToken, getRecommended);

router.post('/admin/reindex', verifyToken, verifyAdmin, triggerReindex);

router.get('/popular', getPopularOnHitboxd);
router.get('/slug/:slug', getBySlug);

router.get('/:id/extras', getExtras);
router.get('/:id/stats', getStats);
router.get('/:id', getById);

export default router;