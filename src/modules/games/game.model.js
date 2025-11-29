import pool from '../../config/db.js';

// 1. Obtener por ID (Para la ficha de detalle)
// Agregamos todos los campos visuales
export const getGameById = async (id) => {
    const [rows] = await pool.query(
        "SELECT id_game, igdb_id, title, slug, cover_url, description, release_date, developer, popularity FROM games WHERE id_game = ?", 
        [id]
    );
    return rows[0];
};

// 2. Obtener por Slug (Para URLs amigables: hitboxd.com/game/zelda-totk)
export const getGameBySlug = async (slug) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE slug = ?", 
        [slug]
    );
    return rows[0];
};

// 3. Obtener Juegos en Tendencia (Para la Landing Page y Onboarding) [cite: 306]
export const getTrendingGames = async (limit) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE is_trending = TRUE ORDER BY popularity DESC LIMIT ?", 
        [limit]
    );
    return rows;
};

// 4. Buscar juegos por título (Para el catálogo local) [cite: 297]
export const searchGamesByTitle = async (searchTerm) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE title LIKE ? LIMIT 20", 
        [`%${searchTerm}%`]
    );
    return rows;
};

// 5. CRÍTICO: Create or Update (Upsert)
// Esta reemplaza a tu 'createGame'. Es la magia del caché.
export const createOrUpdateGame = async (game) => {
    const isTrendingValue = game.is_trending ? 1 : 0
    const query = `
        INSERT INTO games (igdb_id, title, slug, cover_url, release_date, developer, description, popularity, is_trending)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            popularity = VALUES(popularity),
            cover_url = VALUES(cover_url),
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
        game.release_date, 
        game.developer, 
        game.description, 
        game.popularity,
        isTrendingValue
    ]);
    
    // Si insertó, devuelve insertId. Si actualizó, necesitamos buscar el ID.
    if (result.insertId) return result.insertId;
    
    // Si solo actualizó, buscamos el ID para devolverlo
    const existing = await getGameByIgdbId(game.igdb_id);
    return existing.id_game;
};

// Auxiliar para verificar existencia por ID de IGDB
export const getGameByIgdbId = async (igdbId) => {
    const [rows] = await pool.query("SELECT id_game FROM games WHERE igdb_id = ?", [igdbId]);
    return rows[0];
};

export default {
    getGameById,
    getGameBySlug,
    getTrendingGames,
    searchGamesByTitle,
    createOrUpdateGame,
    getGameByIgdbId
};