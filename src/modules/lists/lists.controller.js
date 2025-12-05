import { createList, getListsByUser, getListDetails, addGameToList, deleteList } from './lists.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';

const create = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { title, description, is_public, list_type } = req.body;

        if (!title) return errorHandlerController("El título es obligatorio", 400, res);

        const id = await createList({ id_user, title, description, is_public, list_type });
        res.status(201).json({ message: "Lista creada", id });
    } catch (error) {
        return errorHandlerController("Error creando lista", 500, res, error);
    }
};

const getUserLists = async (req, res) => {
    try {
        const { userId } = req.params;
        const lists = await getListsByUser(userId);
        res.json(lists);
    } catch (error) {
        return errorHandlerController("Error obteniendo listas", 500, res, error);
    }
};

const getOneList = async (req, res) => {
    try {
        const { listId } = req.params;
        const list = await getListDetails(listId);
        
        if (!list) return errorHandlerController("Lista no encontrada", 404, res);
        
        res.json(list);
    } catch (error) {
        return errorHandlerController("Error obteniendo detalle de lista", 500, res, error);
    }
};

const addGame = async (req, res) => {
    try {
        const { listId } = req.params;
        const { gameId, comment } = req.body;

        await addGameToList(listId, gameId, comment);
        res.json({ message: "Juego agregado a la lista" });
    } catch (error) {
        return errorHandlerController("Error agregando juego", 500, res, error);
    }
};

const removeList = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { listId } = req.params;
        
        const success = await deleteList(listId, id_user);
        if (!success) return errorHandlerController("No se pudo eliminar (verifica permisos)", 403, res);
        
        res.json({ message: "Lista eliminada" });
    } catch (error) {
        return errorHandlerController("Error eliminando lista", 500, res, error);
    }
};

export { create, getUserLists, getOneList, addGame, removeList };