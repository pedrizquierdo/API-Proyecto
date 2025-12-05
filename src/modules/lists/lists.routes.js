import { Router } from 'express';
import { create, getUserLists, getOneList, addGame, removeList } from './lists.controller.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verifyToken, create);

router.get('/user/:userId', getUserLists);

router.get('/:listId', getOneList);

router.post('/:listId/games', verifyToken, addGame);

router.delete('/:listId', verifyToken, removeList);

export default router;