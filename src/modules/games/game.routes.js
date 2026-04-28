import { Router } from 'express';
import { getTrending, search, searchPage, getById, getBySlug, getNewReleases, getRandom } from './game.controller.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/new', getNewReleases);
router.get('/search', search);
router.get('/search-page', searchPage);
router.get('/random', verifyToken, getRandom);

router.get('/slug/:slug', getBySlug);

router.get('/:id', getById);

export default router;