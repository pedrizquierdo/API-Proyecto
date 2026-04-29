import pool from '../../config/db.js';
import searchService from '../../services/search.service.js';

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

const getNewGamesLocal = async (limit) => {
    const [rows] = await pool.query(
        "SELECT * FROM games WHERE release_date IS NOT NULL ORDER BY release_date DESC LIMIT ?", 
        [limit]
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
    
    const id_game = result.insertId || (await getGameByIgdbId(game.igdb_id)).id_game;

    searchService.invalidateIndex();

    return id_game;
};

const getGameByIgdbId = async (igdbId) => {
    const [rows] = await pool.query("SELECT id_game FROM games WHERE igdb_id = ?", [igdbId]);
    return rows[0];
};

const getRandomGame = async (excludeIds = []) => {
    const exclusion = excludeIds.length > 0
        ? `AND id_game NOT IN (${excludeIds.map(() => '?').join(',')})`
        : '';
    const [rows] = await pool.query(
        `SELECT * FROM games WHERE cover_url IS NOT NULL ${exclusion} ORDER BY RAND() LIMIT 1`,
        excludeIds
    );
    return rows[0];
};

const getPopularOnHitboxd = async (limit = 12, dayWindow = 30) => {
    const query = `
        SELECT
            g.id_game,
            g.title,
            g.slug,
            g.cover_url,
            g.developer,
            g.release_date,
            g.description,
            COUNT(DISTINCT ug.id_user) as total_players,
            SUM(CASE WHEN ug.status = 'playing' THEN 1 ELSE 0 END) as active_players,
            SUM(CASE WHEN ug.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN 1 ELSE 0 END) as recent_activity,
            SUM(CASE WHEN ug.is_favorite = TRUE THEN 1 ELSE 0 END) as favorites,
            AVG(CASE WHEN ug.rating IS NOT NULL THEN ug.rating ELSE NULL END) as avg_rating,
            COUNT(DISTINCT r.id_review) as review_count,
            COUNT(DISTINCT li.id_item) as list_count,
            (
                (SUM(CASE WHEN ug.status = 'playing' THEN 1 ELSE 0 END) * 3) +
                (SUM(CASE WHEN ug.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN 1 ELSE 0 END) * 2) +
                (COUNT(DISTINCT ug.id_user) * 1) +
                (SUM(CASE WHEN ug.is_favorite = TRUE THEN 1 ELSE 0 END) * 2) +
                (COUNT(DISTINCT r.id_review) * 1.5) +
                (COUNT(DISTINCT li.id_item) * 0.5)
            ) as hitboxd_score
        FROM games g
        INNER JOIN user_games ug ON g.id_game = ug.id_game
        LEFT JOIN reviews r ON g.id_game = r.id_game
        LEFT JOIN list_items li ON g.id_game = li.id_game
        WHERE g.cover_url IS NOT NULL
            AND ug.status IN ('played', 'playing')
        GROUP BY
            g.id_game, g.title, g.slug, g.cover_url,
            g.developer, g.release_date, g.description
        HAVING COUNT(DISTINCT ug.id_user) >= 1
        ORDER BY hitboxd_score DESC
        LIMIT ?
    `;

    try {
        const [rows] = await pool.query(query, [dayWindow, dayWindow, limit]);
        return rows;
    } catch (error) {
        console.error('Error obteniendo populares de Hitboxd:', error.message);
        return [];
    }
};

const getAllGamesForIndex = async () => {
    const [rows] = await pool.query(
        'SELECT id_game, igdb_id, title, slug, cover_url, developer, release_date, popularity FROM games LIMIT 5000'
    );
    return rows;
};

export {
    getGameById,
    getGameBySlug,
    getTrendingGames,
    searchGamesByTitle,
    createOrUpdateGame,
    getGameByIgdbId,
    getNewGamesLocal,
    getRandomGame,
    getAllGamesForIndex,
    getPopularOnHitboxd,
};