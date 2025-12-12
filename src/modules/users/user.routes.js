import { Router } from "express";
import { 
    getUserInfoController, 
    softDeleteUserController, 
    activateUserController,
    updateProfileController, 
    getPublicProfileController, 
    followUserController,
    unfollowUserController,
    checkFollowController,
    searchUsersController
} from "./user.controller.js";
import { verifyToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/me", verifyToken, getUserInfoController);
router.put("/profile", verifyToken, updateProfileController);
router.put("/softdelete", verifyToken, softDeleteUserController);
router.put("/active", verifyToken, activateUserController);
router.post("/follow/:id", verifyToken, followUserController);
router.get("/:username", getPublicProfileController);
router.delete("/follow/:id", verifyToken, unfollowUserController);
router.get("/search", searchUsersController); 

export default router;