import { Router } from "express";
import { logActivity, getMyWatchlist, checkStatus, getFeed } from "./activity.controller.js";
import { verifyToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.post("/", verifyToken, logActivity);
router.get("/watchlist", verifyToken, getMyWatchlist);
router.get("/check/:gameId", verifyToken, checkStatus);
router.get("/feed", verifyToken, getFeed);

export default router;