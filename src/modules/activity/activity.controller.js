import {
    upsertActivity,
    getActivityByGame,
    getWatchlist,
    deleteActivity,
    getFriendsFeed
} from './activity.model.js';

const logActivity = async (req, res) => {
    try {
        const userId = req.user.id_user; 
        const { gameId, status, rating, isFavorite } = req.body;

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
            is_favorite: isFavorite
        });

        res.json({ message: "Actividad actualizada", gameId });

    } catch (error) {
        console.error("Error logging activity:", error);
        res.status(500).json({ message: "Error al guardar actividad" });
    }
};

const getMyWatchlist = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const games = await getWatchlist(userId);
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo watchlist" });
    }
};

const checkStatus = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { gameId } = req.params;
        
        const activity = await getActivityByGame(userId, gameId);
        
        res.json(activity || { status: null, is_favorite: false, rating: null });
    } catch (error) {
        res.status(500).json({ message: "Error verificando estado" });
    }
};

const getFeed = async (req, res) => {
    try {
        const userId = req.user.id_user; // Viene del token
        const feed = await getFriendsFeed(userId, 10);
        res.json(feed);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error cargando feed de amigos" });
    }
};

export { logActivity, getMyWatchlist, checkStatus, getFeed };