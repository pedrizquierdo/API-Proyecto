import pool from '../../config/db.js';

const upsertActivity = async (userId, gameId, activityData) => {

    const statusProvided = activityData.status !== undefined;
    const ratingProvided = activityData.rating !== undefined;
    const favProvided = activityData.is_favorite !== undefined;
    const likeProvided = activityData.is_liked !== undefined;

    const statusVal = activityData.status || null;
    const ratingVal = activityData.rating || null;
    const favVal = activityData.is_favorite ? 1 : 0;
    const likeVal = activityData.is_liked ? 1 : 0;

    const query = `
        INSERT INTO user_games (id_user, id_game, status, rating, is_favorite, is_liked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            -- Si statusProvided es true, usa el nuevo valor (aunque sea null). Si es false, deja el viejo.
            status = IF(?, VALUES(status), status),
            rating = IF(?, VALUES(rating), rating),
            is_favorite = IF(?, VALUES(is_favorite), is_favorite),
            is_liked = IF(?, VALUES(is_liked), is_liked),
            updated_at = NOW();
    `;

    const [result] = await pool.query(query, [
        // Valores para el INSERT
        userId, gameId, statusVal, ratingVal, favVal, likeVal,
        // Banderas para el IF del UPDATE
        statusProvided, ratingProvided, favProvided, likeProvided
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

const getFriendsFeed = async (userId, limit = 10) => {
    const query = `
        SELECT 
        ug.updated_at as activity_date,
        ug.status, ug.rating, ug.is_favorite, ug.is_liked,
        u.username, u.avatar_url,
        g.id_game, g.title, g.cover_url, g.slug
        FROM user_games ug
        JOIN follows f ON ug.id_user = f.following_id
        JOIN users u ON ug.id_user = u.id_user
        JOIN games g ON ug.id_game = g.id_game
        WHERE f.follower_id = ?
        ORDER BY ug.updated_at DESC
        LIMIT ?;
    `;
    const [rows] = await pool.query(query, [userId, limit]);
    return rows;
};

const getAllUserGames = async (userId) => {
    const [rows] = await pool.query(`
        SELECT g.*, ug.status, ug.rating, ug.is_favorite, ug.is_liked, ug.updated_at as added_at
        FROM user_games ug
        JOIN games g ON ug.id_game = g.id_game
        WHERE ug.id_user = ?
        ORDER BY ug.updated_at DESC
    `, [userId]);
    return rows;
};

export {
    upsertActivity,
    getActivityByGame,
    getWatchlist,
    deleteActivity,
    getFriendsFeed,
    getAllUserGames
};