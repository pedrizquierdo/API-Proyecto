import { z } from "zod";
import { createReview, getReviewsByGame, getReviewsByUser, deleteReview, createReport, getReportedReviewsList, deleteReviewByAdmin, dismissReports } from './reviews.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';
import validate from '../../utils/validate.js';

export const validateAddReview = validate(z.object({
    id_game: z.number().int().positive("id_game debe ser un entero positivo"),
    content: z.string().min(10, "La reseña debe tener al menos 10 caracteres").max(2000, "La reseña no puede superar 2000 caracteres"),
    has_spoilers: z.boolean().optional(),
}));


const addReview = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { id_game, content, has_spoilers } = req.body;

        const reviewId = await createReview({ id_user, id_game, content, has_spoilers });
        res.status(201).json({ message: "Reseña publicada", id: reviewId });
    } catch (error) {
        return errorHandlerController("Error al publicar reseña", 500, res, error);
    }
};

const getGameReviews = async (req, res) => {
    try {
        const { gameId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const reviews = await getReviewsByGame(gameId, page, limit);
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
        const { id_user, role } = req.user;
        const { reviewId } = req.params;

        let success = false;

        if (role === 'admin') {
            success = await deleteReviewByAdmin(reviewId);
        } else {
            success = await deleteReview(reviewId, id_user);
        }
        if (!success) {
            return errorHandlerController("Reseña no encontrada o no tienes permiso", 403, res);
        }
        res.json({ message: "Reseña eliminada correctamente" });
    } catch (error) {
        return errorHandlerController("Error eliminando reseña", 500, res, error);
    }
};

const getReported = async (req, res) => {
    try {
        const reports = await getReportedReviewsList();
        res.json(reports);
    } catch (error) {
        return errorHandlerController("Error obteniendo reportes", 500, res, error);
    }
};

const approveReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        await dismissReports(reviewId);
        res.json({ message: "Reportes descartados, reseña aprobada." });
    } catch (error) {
        return errorHandlerController("Error aprobando reseña", 500, res, error);
    }
};

const reportReview = async (req, res) => {
    try {
        const { id_user } = req.user; 
        const { reviewId } = req.params; 
        const { reason } = req.body; 

        if (!reason) {
            return errorHandlerController("Debes indicar un motivo", 400, res);
        }

        await createReport(id_user, reviewId, reason);
        
        res.json({ message: "Reporte enviado. Gracias por ayudar a la comunidad." });
    } catch (error) {
        return errorHandlerController("Error enviando reporte", 500, res, error);
    }
};

export { addReview, getGameReviews, getUserReviews, removeReview, reportReview, getReported, approveReview };