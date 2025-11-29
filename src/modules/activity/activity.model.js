import pool from '../../config/db.js';

// 1. Registrar o Actualizar actividad (Core)
const upsertActivity = async (userId, gameId, activityData) => {
    // activityData puede traer: { status, rating, is_favorite }
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
        activityData.status || 'plan_to_play', // Default si es nuevo
        activityData.rating || null,
        activityData.is_favorite || false,
        activityData.status || null,
        activityData.rating || null,
        activityData.is_favorite || null
    ]);

    return result;
};

// 2. Obtener la actividad de un usuario para un juego específico
// (Para saber si pintar el botón de "Like" de color rojo o gris)
const getActivityByGame = async (userId, gameId) => {
    const [rows] = await pool.query(
        "SELECT * FROM user_games WHERE id_user = ? AND id_game = ?",
        [userId, gameId]
    );
    return rows[0];
};

// 3. Obtener la Watchlist (Pendientes)
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

// 4. Eliminar registro (Por si se arrepiente)
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