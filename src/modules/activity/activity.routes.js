import { Router } from "express";
import { logActivity, getMyWatchlist, checkStatus, getFeed, getUserLibrary, getStreak, getStats } from "./activity.controller.js";
import { verifyToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.post("/", verifyToken, logActivity);
router.get("/watchlist", verifyToken, getMyWatchlist);
router.get("/check/:gameId", verifyToken, checkStatus);
router.get("/feed", verifyToken, getFeed);
router.get('/all', verifyToken, getUserLibrary);
router.get('/streak', verifyToken, getStreak);
router.get('/stats', verifyToken, getStats);

export default router;