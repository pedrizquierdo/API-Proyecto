import {
    upsertActivity,
    getActivityByGame,
    getWatchlist,
    deleteActivity,
    getFriendsFeed,
    getAllUserGames,
    getUserStreak,
    getUserStats,
    buildFeedItem,
    getPublicUserLibrary,
} from './activity.model.js';
import { getFeedFor, hasFeedItemsFor } from './feed.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';
import { emitActivityCreated, emitActivityDeleted } from '../../queue/producers/feed.producer.js';

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

        // Build payload synchronously while the DB row is hot, then hand off to
        // the queue — the consumer handles DB fan-out and Socket.io pushes.
        buildFeedItem(userId, gameId)
            .then(item => {
                if (!item) return;
                emitActivityCreated({ id_activity: gameId, id_user: userId, id_game: gameId, payload: item })
                    .catch(err => console.error('[event]', err.message));
            })
            .catch(() => {});

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
        const limit    = Math.min(parseInt(req.query.limit) || 20, 50);
        const beforeId = req.query.before ? parseInt(req.query.before) : null;

        // Fast path: serve from the pre-computed fan-out table.
        // Flatten payload into top-level so the response shape matches getFriendsFeed().
        const items = await getFeedFor(userId, limit, beforeId);
        if (items.length > 0) {
            return res.json(items.map(({ payload, id_feed_item, ...meta }) => ({
                ...payload,
                id_feed_item,
            })));
        }

        // Fallback: new user (no fan-out rows yet) on the first page only.
        // If beforeId is set we're paginating and there simply are no more items.
        if (!beforeId && !(await hasFeedItemsFor(userId))) {
            const fallback = await getFriendsFeed(userId, limit);
            return res.json(fallback);
        }

        return res.json([]);
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

const getStats = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const stats = await getUserStats(userId);
        res.json(stats);
    } catch (error) {
        return errorHandlerController('Error obteniendo estadísticas', 500, res, error);
    }
};

const removeActivity = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { gameId } = req.params;

        await deleteActivity(userId, gameId);

        // Fire-and-forget: remove feed_items for this activity from all followers.
        emitActivityDeleted({ id_user: userId, id_game: parseInt(gameId) })
            .catch(err => console.error('[event]', err.message));

        res.json({ message: "Actividad eliminada" });
    } catch (error) {
        return errorHandlerController("Error eliminando actividad", 500, res, error);
    }
};

const getUserPublicLibraryController = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        if (isNaN(targetId)) {
            return res.status(400).json({ message: 'ID de usuario inválido' });
        }

        const callerId = req.user?.id_user ?? null;
        const games = await getPublicUserLibrary(targetId, callerId);
        res.json(games);
    } catch (error) {
        return errorHandlerController('Error obteniendo librería del usuario', 500, res, error);
    }
};

export { logActivity, getMyWatchlist, checkStatus, getFeed, getUserLibrary, getStreak, getStats, removeActivity, getUserPublicLibraryController };