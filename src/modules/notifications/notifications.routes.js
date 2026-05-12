import { Router } from 'express';
import { getMyNotifications, readAll, readOne } from './notifications.controller.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = Router();

router.get('/', verifyToken, getMyNotifications);
router.put('/read-all', verifyToken, readAll);
router.put('/:id/read', verifyToken, readOne);

export default router;
