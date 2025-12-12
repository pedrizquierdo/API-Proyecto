import { Router } from 'express';
import { addReview, getGameReviews, getUserReviews, removeReview, reportReview, getReported, approveReview } from './reviews.controller.js';
import { verifyToken, verifyAdmin } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verifyToken, addReview);

router.get('/game/:gameId', getGameReviews);

router.get('/user/:userId', getUserReviews);

router.delete('/:reviewId', verifyToken, removeReview);

router.post('/:reviewId/report', verifyToken, reportReview);

router.get('/reported', verifyToken, verifyAdmin, getReported);

router.put('/:reviewId/approve', verifyToken, verifyAdmin, approveReview);

router.delete('/:reviewId', verifyToken, removeReview);

export default router;