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
    
export {getUserInfoController, softDeleteUserController, activateUserController};