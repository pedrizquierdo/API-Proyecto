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
    searchUsersController,
    getFollowersController,
    getFollowingController
} from "./user.controller.js";
import { verifyToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/me", verifyToken, getUserInfoController);
router.get("/:id/followers", getFollowersController);
router.get("/:id/following", getFollowingController);
router.put("/profile", verifyToken, updateProfileController);
router.put("/softdelete", verifyToken, softDeleteUserController);
router.put("/active", verifyToken, activateUserController);
router.post("/follow/:id", verifyToken, followUserController);
router.get("/:username", getPublicProfileController);
router.delete("/follow/:id", verifyToken, unfollowUserController);
router.get("/search", searchUsersController); 
router.get("/follow/:id/check", verifyToken, checkFollowController);

export default router;