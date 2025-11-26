import { Router } from "express";
import { registerController, loginController, logoutController, refreshController } from "./auth.controller.js";
import { verifyRefreshToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.post("/auth/register", registerController);
router.post("/auth/login", loginController);
router.post("/auth/logout", logoutController);
router.post("/auth/refresh", verifyRefreshToken, refreshController);

export default router;