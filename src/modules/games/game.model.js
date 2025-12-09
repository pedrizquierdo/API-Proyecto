import pool from '../../config/db.js';

const getGameById = async (id) => {
    const [rows] = await pool.query(
        "SELECT id_game, igdb_id, title, slug, cover_url, background_url, description, release_date, developer, popularity FROM games WHERE id_game = ?", 
        [id]
    );
    return rows[0];
};

const getGameBySlug = async (slug) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE slug = ?", 
        [slug]
    );
    return rows[0];
};

const getTrendingGames = async (limit) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE is_trending = TRUE ORDER BY popularity DESC LIMIT ?", 
        [limit]
    );
    return rows;
};

const searchGamesByTitle = async (searchTerm) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE title LIKE ? LIMIT 20", 
        [`%${searchTerm}%`]
    );
    return rows;
};

const createOrUpdateGame = async (game) => {
    const isTrendingValue = game.is_trending ? 1 : 0
    const query = `
        INSERT INTO games (
            igdb_id, title, slug, cover_url, background_url, release_date, 
            developer, description, popularity, is_trending
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            popularity = VALUES(popularity),
            cover_url = VALUES(cover_url),
            background_url = VALUES(background_url),
            description = VALUES(description),
            developer = VALUES(developer),
            is_trending = VALUES(is_trending),
            updated_at = NOW();
    `;
    
    const [result] = await pool.query(query, [
        game.igdb_id, 
        game.title, 
        game.slug, 
        game.cover_url,
        game.background_url,
        game.release_date, 
        game.developer, 
        game.description, 
        game.popularity,
        isTrendingValue 
    ]);
    
    if (result.insertId) return result.insertId;
    const existing = await getGameByIgdbId(game.igdb_id);
    return existing.id_game;
};

const getGameByIgdbId = async (igdbId) => {
    const [rows] = await pool.query("SELECT id_game FROM games WHERE igdb_id = ?", [igdbId]);
    return rows[0];
};

export {
    getGameById,
    getGameBySlug,
    getTrendingGames,
    searchGamesByTitle,
    createOrUpdateGame,
    getGameByIgdbId
};