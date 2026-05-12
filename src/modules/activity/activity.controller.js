import {
    upsertActivity,
    getActivityByGame,
    getWatchlist,
    deleteActivity,
    getFriendsFeed,
    getAllUserGames,
    getUserStreak,
} from './activity.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';

const logActivity = async (req, res) => {
    try {
        const userId = req.user.id_user; 
        const { gameId, status, rating, isFavorite, isLiked } = req.body;

        if (!gameId) {
            return res.status(400).json({ message: "Falta el ID del juego" });
        }
        const validStatuses = ['played', 'playing', 'plan_to_play', 'dropped'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: "Estado inválido" });
        }

        await upsertActivity(userId, gameId, {
            status,
            rating,
            is_favorite: isFavorite,
            is_liked: isLiked
        });

        res.json({ message: "Actividad actualizada", gameId });

    } catch (error) {
        return errorHandlerController("Error al guardar actividad", 500, res, error);
    }
};

const getMyWatchlist = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const games = await getWatchlist(userId);
        res.json(games);
    } catch (error) {
        return errorHandlerController("Error obteniendo watchlist", 500, res, error);
    }
};

const checkStatus = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { gameId } = req.params;
        
        const activity = await getActivityByGame(userId, gameId);
        
        if (activity) {
            res.json({
                ...activity,
                is_liked: Boolean(activity.is_liked),
                is_favorite: Boolean(activity.is_favorite)
            });
        } else {
            res.json({ status: null, is_favorite: false, is_liked: false, rating: null });
        }
    } catch (error) {
        return errorHandlerController("Error verificando estado", 500, res, error);
    }
};

const getFeed = async (req, res) => {
    try {
        const userId = req.user.id_user; 
        const feed = await getFriendsFeed(userId, 10);
        res.json(feed);
    } catch (error) {
        return errorHandlerController("Error cargando feed de amigos", 500, res, error);
    }
};

const getUserLibrary = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const games = await getAllUserGames(userId);
        res.json(games);
    } catch (error) {
        return errorHandlerController("Error obteniendo librería completa", 500, res, error);
    }
};

const getStreak = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const streak = await getUserStreak(userId);
        res.json({ streak });
    } catch (error) {
        return errorHandlerController("Error obteniendo racha", 500, res, error);
    }
};

export { logActivity, getMyWatchlist, checkStatus, getFeed, getUserLibrary, getStreak };