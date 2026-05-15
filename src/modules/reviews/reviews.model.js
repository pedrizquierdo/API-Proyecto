import pool from '../../config/db.js';

const createReview = async (reviewData) => {
    const { id_user, id_game, content, has_spoilers } = reviewData;
    const [result] = await pool.query(
        "INSERT INTO reviews (id_user, id_game, content, has_spoilers) VALUES (?, ?, ?, ?)",
        [id_user, id_game, content, has_spoilers || false]
    );
    return result.insertId;
};

const getReviewsByGame = async (gameId, page = 1, limit = 20, userId = null) => {
    const offset = (page - 1) * limit;
    const isLikedSelect = userId != null
        ? ', (SELECT COUNT(*) > 0 FROM likes WHERE id_review = r.id_review AND id_user = ?) as is_liked'
        : '';
    const params = userId != null
        ? [userId, gameId, limit, offset]
        : [gameId, limit, offset];
    const [rows] = await pool.query(`
        SELECT r.*, u.username, u.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE id_review = r.id_review) as likes
            ${isLikedSelect}
        FROM reviews r
        JOIN users u ON r.id_user = u.id_user
        WHERE r.id_game = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `, params);
    return rows;
};

const getReviewsByUser = async (userId) => {
    const [rows] = await pool.query(`
        SELECT r.*, g.title as game_title, g.cover_url, g.slug as game_slug
        FROM reviews r
        JOIN games g ON r.id_game = g.id_game
        WHERE r.id_user = ?
        ORDER BY r.created_at DESC
    `, [userId]);
    return rows;
};

const getReviewAuthorId = async (reviewId) => {
    const [[row]] = await pool.query(
        'SELECT id_user FROM reviews WHERE id_review = ?',
        [reviewId]
    );
    return row?.id_user ?? null;
};

const getReviewGameId = async (reviewId) => {
    const [[row]] = await pool.query(
        'SELECT id_game FROM reviews WHERE id_review = ?',
        [reviewId]
    );
    return row?.id_game ?? null;
};

const createReport = async (userId, reviewId, reason) => {
    const [result] = await pool.query(
        "INSERT INTO review_reports (id_user, id_review, reason) VALUES (?, ?, ?)",
        [userId, reviewId, reason]
    );
    return result.insertId;
};

const deleteReview = async (reviewId, userId) => {
    const [result] = await pool.query(
        "DELETE FROM reviews WHERE id_review = ? AND id_user = ?",
        [reviewId, userId]
    );
    return result.affectedRows > 0;
};

const getReportedReviewsList = async () => {
    const query = `
        SELECT 
        r.id_review, r.content, r.created_at,
        u.username as review_username, 
        g.title as game_title, g.cover_url as game_cover_url,
        COUNT(rr.id_report) as report_count,
        GROUP_CONCAT(DISTINCT rr.reason SEPARATOR ', ') as all_reasons
        FROM reviews r
        JOIN review_reports rr ON r.id_review = rr.id_review
        JOIN users u ON r.id_user = u.id_user
        JOIN games g ON r.id_game = g.id_game
        WHERE rr.status = 'pending'
        GROUP BY r.id_review
        ORDER BY report_count DESC
    `;
    const [rows] = await pool.query(query);
    return rows;
};

const deleteReviewByAdmin = async (reviewId) => {
    const [result] = await pool.query("DELETE FROM reviews WHERE id_review = ?", [reviewId]);
    return result.affectedRows > 0;
};

const dismissReports = async (reviewId) => {
    const [result] = await pool.query(
        "UPDATE review_reports SET status = 'dismissed' WHERE id_review = ?", 
        [reviewId]
    );
    return result.affectedRows > 0;
};



const likeReview = async (userId, reviewId) => {
    const [result] = await pool.query(
        "INSERT IGNORE INTO likes (id_user, id_review) VALUES (?, ?)",
        [userId, reviewId]
    );
    return result;
};

const unlikeReview = async (userId, reviewId) => {
    const [result] = await pool.query(
        "DELETE FROM likes WHERE id_user = ? AND id_review = ?",
        [userId, reviewId]
    );
    return result;
};

const getReviewLikesCount = async (reviewId) => {
    const [[{ count }]] = await pool.query(
        "SELECT COUNT(*) as count FROM likes WHERE id_review = ?",
        [reviewId]
    );
    return count;
};

const getRecentReviews = async (limit = 3) => {
    const [rows] = await pool.query(`
        SELECT r.id_review, r.content, r.rating, r.created_at,
               u.username, u.avatar_url,
               g.title as game_title, g.cover_url
        FROM reviews r
        JOIN users u ON r.id_user = u.id_user
        JOIN games g ON r.id_game = g.id_game
        WHERE r.has_spoilers = false
          AND r.content IS NOT NULL
          AND LENGTH(r.content) >= 20
        ORDER BY r.created_at DESC
        LIMIT ?
    `, [limit]);
    return rows;
};

const getRatingDistribution = async (gameId) => {
    const [rows] = await pool.query(`
        SELECT rating, COUNT(*) as count
        FROM user_games
        WHERE id_game = ? AND rating IS NOT NULL
        GROUP BY rating
        ORDER BY rating ASC
    `, [gameId]);
    return rows;
};

const getGameRatingStats = async (gameId) => {
    const [[stats]] = await pool.query(`
        SELECT COUNT(*) as total_ratings, AVG(rating) as avg_rating
        FROM user_games
        WHERE id_game = ? AND rating IS NOT NULL
    `, [gameId]);
    return {
        avg_rating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : null,
        total_ratings: Number(stats.total_ratings),
    };
};

const getReportedReviewSummary = async (reviewId) => {
    const [[row]] = await pool.query(`
        SELECT
            r.id_review, r.content, r.created_at,
            u.username AS review_username,
            g.title AS game_title, g.cover_url AS game_cover_url,
            COUNT(rr.id_report) AS report_count,
            GROUP_CONCAT(DISTINCT rr.reason SEPARATOR ', ') AS all_reasons
        FROM reviews r
        JOIN review_reports rr ON r.id_review = rr.id_review
        JOIN users u ON r.id_user = u.id_user
        JOIN games g ON r.id_game = g.id_game
        WHERE r.id_review = ? AND rr.status = 'pending'
        GROUP BY r.id_review
    `, [reviewId]);
    return row ?? null;
};

const getReviewForFeed = async (reviewId) => {
    const [[row]] = await pool.query(`
        SELECT
            r.id_review, r.content, r.created_at,
            u.id_user, u.username, u.avatar_url,
            g.id_game, g.title, g.cover_url,
            ug.rating
        FROM reviews r
        JOIN users u ON r.id_user = u.id_user
        JOIN games g ON r.id_game = g.id_game
        LEFT JOIN user_games ug ON r.id_user = ug.id_user AND r.id_game = ug.id_game
        WHERE r.id_review = ?
    `, [reviewId]);
    return row ?? null;
};

const getPopularReviewsThisWeek = async (limit = 6) => {
    const [rows] = await pool.query(`
        SELECT
            r.id_review,
            r.content,
            r.created_at,
            u.id_user,
            u.username,
            u.avatar_url,
            g.id_game,
            g.title AS game_title,
            g.cover_url,
            g.slug AS game_slug,
            ug.rating,
            COUNT(DISTINCT lk.id_like) AS like_count
        FROM reviews r
        JOIN users u ON r.id_user = u.id_user
        JOIN games g ON r.id_game = g.id_game
        LEFT JOIN user_games ug ON r.id_user = ug.id_user AND r.id_game = ug.id_game
        LEFT JOIN likes lk ON lk.id_review = r.id_review
            AND lk.created_at >= NOW() - INTERVAL 7 DAY
        WHERE r.has_spoilers = FALSE
          AND r.content IS NOT NULL
          AND LENGTH(r.content) >= 10
        GROUP BY r.id_review, r.content, r.created_at,
                 u.id_user, u.username, u.avatar_url,
                 g.id_game, g.title, g.cover_url, g.slug, ug.rating
        HAVING like_count > 0
        ORDER BY like_count DESC
        LIMIT ?
    `, [limit]);

    return rows.map(row => ({
        ...row,
        like_count: Number(row.like_count),
        rating: row.rating !== null ? Number(row.rating) : null,
    }));
};

/**
 * Returns the game slug (and basic metadata) associated with a review.
 * Safe to expose without authentication: game slugs are public URLs, not private data.
 * Used as a fallback resolution endpoint for review_like notifications on Android.
 */
const getReviewGameSlug = async (reviewId) => {
    const [[row]] = await pool.query(`
        SELECT r.id_review, r.id_game, g.slug, g.title as game_title
        FROM reviews r
        JOIN games g ON r.id_game = g.id_game
        WHERE r.id_review = ?
    `, [reviewId]);
    return row ?? null;
};

export { createReview, getReviewsByGame, getReviewsByUser, deleteReview, createReport, getReportedReviewsList, deleteReviewByAdmin, dismissReports, likeReview, unlikeReview, getReviewLikesCount, getRecentReviews, getRatingDistribution, getGameRatingStats, getReviewAuthorId, getReviewGameId, getReviewForFeed, getReportedReviewSummary, getPopularReviewsThisWeek, getReviewGameSlug };