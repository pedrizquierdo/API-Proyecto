import { z } from "zod";
import { createList, getListsByUser, getListDetails, addGameToList, deleteList, getPopularLists, removeListItem, reorderListItems, updateList } from './lists.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';
import validate from '../../utils/validate.js';

export const validateCreateList = validate(z.object({
    title: z.string().min(1, "El título es obligatorio").max(100, "El título no puede superar 100 caracteres"),
    description: z.string().max(500, "La descripción no puede superar 500 caracteres").optional(),
    is_public: z.boolean().optional(),
    list_type: z.enum(['collection', 'ranking', 'wishlist']).optional(),
}));

const create = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { title, description, is_public, list_type } = req.body;

        const id = await createList({ id_user, title, description, is_public, list_type });
        res.status(201).json({ message: "Lista creada", id });
    } catch (error) {
        return errorHandlerController("Error creando lista", 500, res, error);
    }
};

const getUserLists = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const lists = await getListsByUser(userId, page, limit);
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
        const { id_user } = req.user;
        const { listId } = req.params;
        const { gameId, comment } = req.body;

        if (!gameId || !Number.isInteger(Number(gameId)) || Number(gameId) <= 0) {
            return errorHandlerController("gameId es requerido y debe ser un entero positivo", 400, res);
        }

        const list = await getListDetails(listId);
        if (!list) return errorHandlerController("Lista no encontrada", 404, res);
        if (list.id_user !== id_user) return errorHandlerController("No tienes permiso para modificar esta lista", 403, res);

        await addGameToList(listId, Number(gameId), comment);
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

const getPopular = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 6, 6);
        const lists = await getPopularLists(limit);
        res.json(lists);
    } catch (error) {
        return errorHandlerController("Error obteniendo listas populares", 500, res, error);
    }
};

export const validateReorder = validate(z.object({
    items: z.array(z.object({
        id_item: z.number().int().positive(),
        position: z.number().int().positive(),
    })).min(1).max(1000),
}));

const removeItem = async (req, res) => {
    try {
        const { id_user } = req.user;
        const listId = parseInt(req.params.listId);
        const itemId = parseInt(req.params.itemId);
        if (!Number.isFinite(listId) || !Number.isFinite(itemId)) {
            return errorHandlerController("IDs invalidos", 400, res);
        }

        const result = await removeListItem(listId, itemId, id_user);
        if (!result.success) {
            if (result.reason === 'not_found_or_forbidden')
                return errorHandlerController("Item no encontrado o sin permisos", 404, res);
            return errorHandlerController("No se pudo remover el item", 400, res);
        }
        res.json({ message: "Juego removido de la lista" });
    } catch (error) {
        return errorHandlerController("Error removiendo item", 500, res, error);
    }
};

const reorderItems = async (req, res) => {
    try {
        const { id_user } = req.user;
        const listId = parseInt(req.params.listId);
        if (!Number.isFinite(listId)) {
            return errorHandlerController("ID de lista invalido", 400, res);
        }
        const { items } = req.body;

        const result = await reorderListItems(listId, id_user, items);
        if (!result.success) {
            switch (result.reason) {
                case 'not_found':
                    return errorHandlerController("Lista no encontrada", 404, res);
                case 'forbidden':
                    return errorHandlerController("No tienes permiso para modificar esta lista", 403, res);
                case 'mismatch':
                    return errorHandlerController("Los items no coinciden con la lista", 400, res);
                case 'invalid_positions':
                    return errorHandlerController("Las posiciones deben ser 1..N sin huecos ni duplicados", 400, res);
                default:
                    return errorHandlerController("No se pudo reordenar", 400, res);
            }
        }
        res.json({ message: "Lista reordenada" });
    } catch (error) {
        return errorHandlerController("Error reordenando lista", 500, res, error);
    }
};

export const validateUpdateList = validate(z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    is_public: z.boolean().optional(),
    list_type: z.enum(['collection', 'ranking', 'wishlist']).optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo a actualizar",
}));

const updateListController = async (req, res) => {
    try {
        const { id_user } = req.user;
        const listId = parseInt(req.params.listId);
        if (!Number.isFinite(listId)) {
            return errorHandlerController("ID invalido", 400, res);
        }

        const result = await updateList(listId, id_user, req.body);
        if (!result.success) {
            switch (result.reason) {
                case 'not_found':
                    return errorHandlerController("Lista no encontrada", 404, res);
                case 'forbidden':
                    return errorHandlerController("No tienes permiso para editar esta lista", 403, res);
                case 'no_fields':
                    return errorHandlerController("Sin campos para actualizar", 400, res);
                default:
                    return errorHandlerController("No se pudo actualizar", 400, res);
            }
        }
        res.json({ message: "Lista actualizada", list: result.list });
    } catch (error) {
        return errorHandlerController("Error actualizando lista", 500, res, error);
    }
};

export { create, getUserLists, getOneList, addGame, removeList, getPopular, removeItem, reorderItems, updateListController };