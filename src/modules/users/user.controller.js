import { getUserInfo, softDeleteUser, activateUser, updateUserProfile, getUserByUsername, followUser, unfollowUser, checkFollowStatus, searchUsersByUsername } from "./user.model.js";
import { errorHandlerController } from "../../helpers/errorHandlerController.js";

const getUserInfoController = async (req, res) => {
    const { id_user } = req.user;
    try {
        const user = await getUserInfo(id_user);
        if (!user) {
            return errorHandlerController("Usuario no encontrado", 404, res);
        }
        res.status(200).json(user);
    } catch (error) {
        return errorHandlerController("Error al obtener el usuario", 500, res, error);
    }
};

const updateProfileController = async (req, res) => {
    const { id_user } = req.user;
    const { bio, avatar_url, pronouns } = req.body;

    try {
        const updatedUser = await updateUserProfile(id_user, { bio, avatar_url, pronouns });
        if (!updatedUser) {
            return errorHandlerController("No se pudo actualizar el perfil", 400, res);
        }
        res.status(200).json({ message: "Perfil actualizado correctamente", user: updatedUser });
    } catch (error) {
        return errorHandlerController("Error al actualizar perfil", 500, res, error);
    }
};

const getPublicProfileController = async (req, res) => {
    const { username } = req.params;

    try {
        const user = await getUserByUsername(username);
        if (!user) {
            return errorHandlerController("Usuario no encontrado", 404, res);
        }
        res.status(200).json(user);
    } catch (error) {
        return errorHandlerController("Error buscando usuario", 500, res, error);
    }
};

const followUserController = async (req, res) => {
    const followerId = req.user.id_user;
    const followingId = req.params.id; 

    if (parseInt(followerId) === parseInt(followingId)) {
        return errorHandlerController("No puedes seguirte a ti mismo", 400, res);
    }

    try {
        await followUser(followerId, followingId);
        res.status(200).json({ message: "Usuario seguido correctamente" });
    } catch (error) {
        // Si ya lo seguía, MySQL dará error de duplicado, puedes manejarlo aquí
        if (error.code === 'ER_DUP_ENTRY') {
            return errorHandlerController("Ya sigues a este usuario", 400, res);
        }
        return errorHandlerController("Error al seguir usuario", 500, res, error);
    }
};

const unfollowUserController = async (req, res) => {
    const followerId = req.user.id_user; 
    const followingId = req.params.id;   

    try {
        await unfollowUser(followerId, followingId);
        res.status(200).json({ message: "Usuario dejado de seguir" });
    } catch (error) {
        return errorHandlerController("Error al dejar de seguir", 500, res, error);
    }
};

const checkFollowController = async (req, res) => {
    const followerId = req.user.id_user;
    const followingId = req.params.id;

    try {
        const isFollowing = await checkFollowStatus(followerId, followingId);
        res.json({ isFollowing });
    } catch (error) {
        return errorHandlerController("Error verificando estado", 500, res, error);
    }
};

const searchUsersController = async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    try {
        // Llamamos a la función importada, NO la redefinimos aquí
        const users = await searchUsersByUsername(q);
        res.json(users);
    } catch (error) {
        return errorHandlerController("Error buscando usuarios", 500, res, error);
    }
};

const getFollowersController = async (req, res) => {
    try {
        const { id } = req.params;
        const followers = await getFollowersModel(id);
        res.json(followers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener seguidores" });
    }
};

const getFollowingController = async (req, res) => {
    try {
        const { id } = req.params;
        const following = await getFollowingModel(id);
        res.json(following);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener seguidos" });
    }
};

const softDeleteUserController = async (req, res) => {
    const { id_user } = req.user;
    try {
        const success = await softDeleteUser(id_user);
        if (!success) {
            return errorHandlerController("No se pudo eliminar el usuario", 404, res);
        }
        res.status(200).json({ message: "Usuario desactivado correctamente" });
    } catch (error) {
        return errorHandlerController("Error al eliminar el usuario", 500, res, error);
    }
};

const activateUserController = async (req, res) => {
    const { id_user } = req.user;
    try {
        const success = await activateUser(id_user);
        if (!success) {
            return errorHandlerController("No se pudo activar el usuario", 404, res);
        }
        res.status(200).json({ message: "Usuario activado correctamente" });
    } catch (error) {
        return errorHandlerController("Error al activar el usuario", 500, res, error);
    }
};
    
export {
    getUserInfoController, 
    updateProfileController, 
    getPublicProfileController,
    followUserController,
    softDeleteUserController, 
    activateUserController,
    unfollowUserController,
    checkFollowController,
    searchUsersController,
    getFollowersController,
    getFollowingController
};