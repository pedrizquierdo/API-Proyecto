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
    getUserCountController,
    getSuggestionsController,
    getAllUsersAdminController,
    banUserAdminController,
    unbanUserAdminController,
} from "./user.controller.js";
import { verifyToken, verifyAdmin, optionalToken } from "../../middlewares/authMiddleware.js";
import { getUserPublicLibraryController } from "../activity/activity.controller.js";

const router = Router();

router.get("/count", getUserCountController);
router.get("/suggestions", verifyToken, getSuggestionsController);
router.get("/search", searchUsersController);
router.get("/follow/:id/check", verifyToken, checkFollowController);
router.get("/me", verifyToken, getUserInfoController);
router.get("/:id/followers", getFollowersController);
router.get("/:id/following", getFollowingController);
router.get("/:id/library", optionalToken, getUserPublicLibraryController);
router.put("/profile", verifyToken, validateUpdateProfile, updateProfileController);
router.put("/softdelete", verifyToken, softDeleteUserController);
router.put("/active", verifyToken, activateUserController);
router.post("/follow/:id", verifyToken, followUserController);
router.delete("/follow/:id", verifyToken, unfollowUserController);
router.get("/admin/all", verifyToken, verifyAdmin, getAllUsersAdminController);
router.put("/admin/:id/ban", verifyToken, verifyAdmin, banUserAdminController);
router.put("/admin/:id/unban", verifyToken, verifyAdmin, unbanUserAdminController);

router.get("/:username", getPublicProfileController);

export default router;