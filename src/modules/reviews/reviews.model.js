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

const deleteReview = async (reviewId, userId) => {
    const [result] = await pool.query(
        "DELETE FROM reviews WHERE id_review = ? AND id_user = ?",
        [reviewId, userId]
    );
    return result.affectedRows > 0;
};

export { createReview, getReviewsByGame, getReviewsByUser, deleteReview };