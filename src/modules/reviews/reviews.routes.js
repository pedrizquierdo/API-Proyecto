import { Router } from 'express';
import { addReview, getGameReviews, getUserReviews, removeReview } from './reviews.controller.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verifyToken, addReview);

router.get('/game/:gameId', getGameReviews);

router.get('/user/:userId', getUserReviews);

router.delete('/:reviewId', verifyToken, removeReview);

export default router;