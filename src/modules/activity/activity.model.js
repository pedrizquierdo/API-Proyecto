import pool from '../../config/db.js';

const upsertActivity = async (userId, gameId, activityData) => {
    const query = `
        INSERT INTO user_games (id_user, id_game, status, rating, is_favorite)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = COALESCE(?, status),
            rating = COALESCE(?, rating),
            is_favorite = COALESCE(?, is_favorite),
            updated_at = NOW();
    `;

    const [result] = await pool.query(query, [
        userId, gameId, 
        activityData.status || 'plan_to_play',
        activityData.rating || null,
        activityData.is_favorite || false,
        activityData.status || null,
        activityData.rating || null,
        activityData.is_favorite || null
    ]);

    return result;
};

const getActivityByGame = async (userId, gameId) => {
    const [rows] = await pool.query(
        "SELECT * FROM user_games WHERE id_user = ? AND id_game = ?",
        [userId, gameId]
    );
    return rows[0];
};

const getWatchlist = async (userId) => {
    const [rows] = await pool.query(`
        SELECT g.*, ug.created_at as added_at
        FROM user_games ug
        JOIN games g ON ug.id_game = g.id_game
        WHERE ug.id_user = ? AND ug.status = 'plan_to_play'
        ORDER BY ug.updated_at DESC
    `, [userId]);
    return rows;
};

const deleteActivity = async (userId, gameId) => {
    const [result] = await pool.query(
        "DELETE FROM user_games WHERE id_user = ? AND id_game = ?",
        [userId, gameId]
    );
    return result;
};

export {
    upsertActivity,
    getActivityByGame,
    getWatchlist,
    deleteActivity
};