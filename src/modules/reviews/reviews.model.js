import pool from '../../config/db.js';

const createReview = async (reviewData) => {
    const { id_user, id_game, content, has_spoilers } = reviewData;
    const [result] = await pool.query(
        "INSERT INTO reviews (id_user, id_game, content, has_spoilers) VALUES (?, ?, ?, ?)",
        [id_user, id_game, content, has_spoilers || false]
    );
    return result.insertId;
};

const getReviewsByGame = async (gameId) => {
    const [rows] = await pool.query(`
        SELECT r.*, u.username, u.avatar_url 
        FROM reviews r
        JOIN users u ON r.id_user = u.id_user
        WHERE r.id_game = ?
        ORDER BY r.created_at DESC
    `, [gameId]);
    return rows;
};

const getReviewsByUser = async (userId) => {
    const [rows] = await pool.query(`
        SELECT r.*, g.title as game_title, g.cover_url 
        FROM reviews r
        JOIN games g ON r.id_game = g.id_game
        WHERE r.id_user = ?
        ORDER BY r.created_at DESC
    `, [userId]);
    return rows;
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



export { createReview, getReviewsByGame, getReviewsByUser, deleteReview, createReport, getReportedReviewsList, deleteReviewByAdmin, dismissReports };