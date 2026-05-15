import { Router } from 'express';
import { create, getUserLists, getOneList, addGame, removeList, validateCreateList, getPopular, removeItem, reorderItems, validateReorder } from './lists.controller.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verifyToken, validateCreateList, create);

router.get('/popular', getPopular);

router.get('/user/:userId', getUserLists);

router.get('/:listId', getOneList);

router.post('/:listId/games', verifyToken, addGame);

router.delete('/:listId/items/:itemId', verifyToken, removeItem);

router.put('/:listId/reorder', verifyToken, validateReorder, reorderItems);

router.delete('/:listId', verifyToken, removeList);

export default router;