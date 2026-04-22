import { Router } from "express";
import { registerController, loginController, logoutController, refreshController, validateRegister, validateLogin } from "./auth.controller.js";
import { verifyRefreshToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", validateRegister, registerController);
router.post("/login", validateLogin, loginController);
router.post("/logout", logoutController);
router.post("/refresh", verifyRefreshToken, refreshController);

export default router;