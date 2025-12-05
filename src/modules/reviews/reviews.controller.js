import { createReview, getReviewsByGame, getReviewsByUser, deleteReview } from './reviews.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';


const addReview = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { id_game, content, has_spoilers } = req.body;

        if (!id_game || !content) {
            return errorHandlerController("Faltan datos (id_game, content)", 400, res);
        }

        const reviewId = await createReview({ id_user, id_game, content, has_spoilers });
        res.status(201).json({ message: "Reseña publicada", id: reviewId });
    } catch (error) {
        return errorHandlerController("Error al publicar reseña", 500, res, error);
    }
};

const getGameReviews = async (req, res) => {
    try {
        const { gameId } = req.params;
        const reviews = await getReviewsByGame(gameId);
        res.json(reviews);
    } catch (error) {
        return errorHandlerController("Error obteniendo reseñas", 500, res, error);
    }
};

const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await getReviewsByUser(userId);
        res.json(reviews);
    } catch (error) {
        return errorHandlerController("Error obteniendo reseñas del usuario", 500, res, error);
    }
};

const removeReview = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { reviewId } = req.params;

        const success = await deleteReview(reviewId, id_user);
        if (!success) {
            return errorHandlerController("Reseña no encontrada o no tienes permiso", 403, res);
        }
        res.json({ message: "Reseña eliminada" });
    } catch (error) {
        return errorHandlerController("Error eliminando reseña", 500, res, error);
    }
};

export { addReview, getGameReviews, getUserReviews, removeReview };