import ActivityModel from './activity.model.js';

// Body esperado: { gameId: 10, status: 'played', rating: 4.5, isFavorite: true }
const logActivity = async (req, res) => {
    try {
        const userId = req.user.id_user; // Viene de tu Auth Middleware (JWT)
        const { gameId, status, rating, isFavorite } = req.body;

        if (!gameId) {
            return res.status(400).json({ message: "Falta el ID del juego" });
        }

        // Validamos status si viene
        const validStatuses = ['played', 'playing', 'plan_to_play', 'dropped'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: "Estado inválido" });
        }

        await ActivityModel.upsertActivity(userId, gameId, {
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
        const games = await ActivityModel.getWatchlist(userId);
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo watchlist" });
    }
};

const checkStatus = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { gameId } = req.params;
        
        const activity = await ActivityModel.getActivityByGame(userId, gameId);
        
        // Si no hay actividad, devolvemos null o un objeto vacío seguro
        res.json(activity || { status: null, is_favorite: false, rating: null });
    } catch (error) {
        res.status(500).json({ message: "Error verificando estado" });
    }
};

export { logActivity, getMyWatchlist, checkStatus };