import { Router } from "express";
import {
    getUserInfoController,
    softDeleteUserController,
    activateUserController,
    updateProfileController,
    validateUpdateProfile,
    getPublicProfileController,
    followUserController,
    unfollowUserController,
    checkFollowController,
    searchUsersController,
    getFollowersController,
    getFollowingController,
    getUserCountController
} from "./user.controller.js";
import { verifyToken } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/count", getUserCountController);
router.get("/search", searchUsersController);
router.get("/follow/:id/check", verifyToken, checkFollowController);
router.get("/me", verifyToken, getUserInfoController);
router.get("/:id/followers", getFollowersController);
router.get("/:id/following", getFollowingController);
router.put("/profile", verifyToken, validateUpdateProfile, updateProfileController);
router.put("/softdelete", verifyToken, softDeleteUserController);
router.put("/active", verifyToken, activateUserController);
router.post("/follow/:id", verifyToken, followUserController);
router.delete("/follow/:id", verifyToken, unfollowUserController);
router.get("/:username", getPublicProfileController);

export default router;