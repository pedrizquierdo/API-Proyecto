import { Router } from 'express';
import { getGlobalStats } from './admin.controller.js';
import { verifyToken, verifyAdmin } from '../../middlewares/authMiddleware.js';

const router = Router();

router.get('/stats/global', verifyToken, verifyAdmin, getGlobalStats);

export default router;
