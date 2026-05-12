import pool from '../../config/db.js';

const upsertActivity = async (userId, gameId, activityData) => {
    const statusProvided = activityData.status !== undefined;
    const status = activityData.status ?? null;
    const rating = activityData.rating ?? null;
    const isLiked = activityData.is_liked != null ? (activityData.is_liked ? 1 : 0) : null;
    const isFav = activityData.is_favorite != null ? (activityData.is_favorite ? 1 : 0) : null;

    const query = `
        INSERT INTO user_games (id_user, id_game, status, rating, is_favorite, is_liked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            status = IF(?, ?, status),
            rating = COALESCE(?, rating),
            is_favorite = COALESCE(?, is_favorite),
            is_liked = COALESCE(?, is_liked),
            updated_at = NOW();
    `;

    const [result] = await pool.query(query, [
        userId,
        gameId,
        status,
        rating,
        isFav ?? null,
        isLiked ?? null,
        statusProvided,
        status,
        rating,
        isFav,
        isLiked,
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
        u.id_user, u.username, u.avatar_url,
        g.id_game, g.title, g.cover_url, g.slug,
        EXISTS(
            SELECT 1 FROM follows f2 WHERE f2.follower_id = ug.id_user AND f2.following_id = ?
        ) as follows_you
        FROM user_games ug
        JOIN follows f ON ug.id_user = f.following_id
        JOIN users u ON ug.id_user = u.id_user
        JOIN games g ON ug.id_game = g.id_game
        WHERE f.follower_id = ?
        ORDER BY ug.updated_at DESC
        LIMIT ?;
    `;
    const [rows] = await pool.query(query, [userId, userId, limit]);
    return rows;
};

const getUserStreak = async (userId) => {
    const [rows] = await pool.query(`
        SELECT DISTINCT DATE(updated_at) as activity_day
        FROM user_games
        WHERE id_user = ?
        ORDER BY activity_day DESC
        LIMIT 365
    `, [userId]);

    if (rows.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let cursor = new Date(today);

    for (const row of rows) {
        const day = new Date(row.activity_day);
        day.setHours(0, 0, 0, 0);
        const diff = Math.round((cursor - day) / 86400000);
        if (diff === 0 || diff === 1) {
            streak++;
            cursor = day;
        } else {
            break;
        }
    }

    return streak;
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
    getAllUserGames,
    getUserStreak,
};