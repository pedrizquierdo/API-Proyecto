import { Router } from "express";
import { getUserInfoController, softDeleteUserController, activateUserController } from "./user.controller.js";
import { verifyToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/me", verifyToken, getUserInfoController);
router.put("/users/softdelete", verifyToken, softDeleteUserController);
router.put("/users/active", verifyToken, activateUserController);

export default router;