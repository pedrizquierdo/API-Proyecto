import { getUserInfo, softDeleteUser, activateUser } from "./user.model.js";
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
    activateUserController
};