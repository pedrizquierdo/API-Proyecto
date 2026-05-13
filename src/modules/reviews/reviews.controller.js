import { z } from "zod";
import { createReview, getReviewsByGame, getReviewsByUser, deleteReview, createReport, getReportedReviewsList, deleteReviewByAdmin, dismissReports, likeReview, unlikeReview, getReviewLikesCount, getRecentReviews, getReviewAuthorId, getReviewGameId, getReviewForFeed } from './reviews.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';
import validate from '../../utils/validate.js';
import { upsertActivity } from '../activity/activity.model.js';
import { createNotification, getUnreadCount } from '../notifications/notifications.model.js';
import { emitToUser, emitToGame } from '../../realtime/io.js';
import { fanoutToFollowers } from '../../realtime/fanout.js';

export const validateAddReview = validate(z.object({
    id_game: z.number().int().positive("id_game debe ser un entero positivo"),
    content: z.string().min(10, "La reseña debe tener al menos 10 caracteres").max(2000, "La reseña no puede superar 2000 caracteres"),
    has_spoilers: z.boolean().optional(),
    rating: z.number().min(0).max(5).multipleOf(0.5).optional(),
}));

export const validateReport = validate(z.object({
    reason: z.string().min(1, "Debes indicar un motivo").max(500, "El motivo no puede superar 500 caracteres").trim(),
}));


const addReview = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { id_game, content, has_spoilers, rating } = req.body;

        const reviewId = await createReview({ id_user, id_game, content, has_spoilers });

        if (rating !== undefined) {
            await upsertActivity(id_user, id_game, { rating });
        }

        getReviewForFeed(reviewId)
            .then(item => {
                if (!item) return;
                fanoutToFollowers(id_user, 'feed:review', item);
                emitToGame(id_game, 'review:created', item);
            })
            .catch(() => {});

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
        const userId = req.user?.id_user ?? null;
        const reviews = await getReviewsByGame(gameId, page, limit, userId);
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

        // Must be fetched before deletion; row is gone afterward.
        const gameId = await getReviewGameId(reviewId);

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
        if (gameId) emitToGame(gameId, 'review:deleted', { id_review: parseInt(reviewId) });
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

        await createReport(id_user, reviewId, reason);
        
        res.json({ message: "Reporte enviado. Gracias por ayudar a la comunidad." });
    } catch (error) {
        return errorHandlerController("Error enviando reporte", 500, res, error);
    }
};

const toggleReviewLike = async (req, res) => {
    try {
        const { id_user } = req.user;
        const { reviewId } = req.params;

        const likeResult = await likeReview(id_user, reviewId);
        let liked;
        if (likeResult.affectedRows === 0) {
            await unlikeReview(id_user, reviewId);
            liked = false;
        } else {
            liked = true;
        }

        const [count, gameId] = await Promise.all([
            getReviewLikesCount(reviewId),
            getReviewGameId(reviewId),
        ]);

        if (liked) {
            const authorId = await getReviewAuthorId(reviewId);
            if (authorId && authorId !== id_user) {
                createNotification(authorId, id_user, 'review_like', parseInt(reviewId))
                    .then(notif => Promise.all([
                        emitToUser(authorId, 'notification:new', notif),
                        getUnreadCount(authorId).then(c => emitToUser(authorId, 'notification:unread_count', { count: c })),
                    ]))
                    .catch(() => {});
            }
        }

        res.json({ liked, count });
        // Emit to all clients viewing this game, including the originator.
        // The client discards the event when actor_id === current_user_id (optimistic update already applied).
        if (gameId) emitToGame(gameId, 'review:like_changed', { id_review: parseInt(reviewId), count, actor_id: id_user });
    } catch (error) {
        return errorHandlerController("Error al dar like a la reseña", 500, res, error);
    }
};

export { addReview, getGameReviews, getUserReviews, removeReview, reportReview, getReported, approveReview, toggleReviewLike, getRecentReviewsController };

async function getRecentReviewsController(req, res) {
    try {
        const limit = Math.min(Number(req.query.limit) || 3, 10);
        const reviews = await getRecentReviews(limit);
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Could not fetch recent reviews' });
    }
}