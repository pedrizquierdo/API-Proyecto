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

const getUserStats = async (userId) => {
    const [genreRows] = await pool.query(`
        SELECT gr.name AS genre, COUNT(*) AS count
        FROM user_games ug
        JOIN game_genres gg ON ug.id_game = gg.id_game
        JOIN genres gr ON gg.id_genre = gr.id_genre
        WHERE ug.id_user = ?
        GROUP BY gr.name
        ORDER BY count DESC
        LIMIT 8
    `, [userId]);

    const [yearRows] = await pool.query(`
        SELECT YEAR(g.release_date) AS year, COUNT(*) AS count
        FROM user_games ug
        JOIN games g ON ug.id_game = g.id_game
        WHERE ug.id_user = ? AND g.release_date IS NOT NULL AND YEAR(g.release_date) > 1979
        GROUP BY YEAR(g.release_date)
        ORDER BY count DESC
        LIMIT 8
    `, [userId]);

    const [[ratingRow]] = await pool.query(`
        SELECT AVG(rating) AS avg_rating, COUNT(*) AS rated_count
        FROM user_games
        WHERE id_user = ? AND rating IS NOT NULL
    `, [userId]);

    const [statusRows] = await pool.query(`
        SELECT status, COUNT(*) AS count
        FROM user_games
        WHERE id_user = ? AND status IS NOT NULL
        GROUP BY status
    `, [userId]);

    return {
        genre_distribution: genreRows.map(r => ({ genre: r.genre, count: Number(r.count) })),
        year_distribution: yearRows.map(r => ({ year: r.year, count: Number(r.count) })),
        avg_rating: ratingRow.avg_rating ? parseFloat(ratingRow.avg_rating).toFixed(1) : null,
        rated_count: Number(ratingRow.rated_count),
        status_distribution: statusRows.map(r => ({ status: r.status, count: Number(r.count) })),
    };
};

const buildFeedItem = async (userId, gameId) => {
    const [[row]] = await pool.query(`
        SELECT
            ug.updated_at AS activity_date,
            ug.status, ug.rating, ug.is_favorite, ug.is_liked,
            u.id_user, u.username, u.avatar_url,
            g.id_game, g.title, g.cover_url, g.slug
        FROM user_games ug
        JOIN users u ON ug.id_user = u.id_user
        JOIN games g ON ug.id_game = g.id_game
        WHERE ug.id_user = ? AND ug.id_game = ?
    `, [userId, gameId]);
    return row ?? null;
};

export {
    upsertActivity,
    getActivityByGame,
    getWatchlist,
    deleteActivity,
    getFriendsFeed,
    getAllUserGames,
    getUserStreak,
    getUserStats,
    buildFeedItem,
};