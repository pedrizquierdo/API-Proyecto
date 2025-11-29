import { Router } from "express";
import { registerController, loginController, logoutController, refreshController } from "./auth.controller.js";
import { verifyRefreshToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/logout", logoutController);
router.post("/refresh", verifyRefreshToken, refreshController);

export default router;