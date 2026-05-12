import { Router } from 'express';
import { addReview, getGameReviews, getUserReviews, removeReview, reportReview, getReported, approveReview, toggleReviewLike, validateAddReview, validateReport, getRecentReviewsController } from './reviews.controller.js';
import { verifyToken, verifyAdmin } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verifyToken, validateAddReview, addReview);

router.get('/recent', getRecentReviewsController);

router.get('/game/:gameId', getGameReviews);

router.get('/user/:userId', getUserReviews);

router.delete('/:reviewId', verifyToken, removeReview);

router.post('/:reviewId/like', verifyToken, toggleReviewLike);
router.post('/:reviewId/report', verifyToken, validateReport, reportReview);

router.get('/reported', verifyToken, verifyAdmin, getReported);

router.put('/:reviewId/approve', verifyToken, verifyAdmin, approveReview);

router.delete('/:reviewId', verifyToken, removeReview);

export default router;