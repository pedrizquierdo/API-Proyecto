import pool from '../../config/db.js';

// Runtime migration: create cache table if it does not exist.
// Mirrors the pattern used in notifications.model.js.
// InnoDB ON DUPLICATE KEY UPDATE uses row-level locks; concurrent SELECT queries
// read a consistent MVCC snapshot and are never blocked by chunk UPSERTs.
// LOW_PRIORITY INSERT is a MyISAM-era hint and has no effect on InnoDB — it is
// intentionally omitted here.
pool.query(`
    CREATE TABLE IF NOT EXISTS hitboxd_score_cache (
        id_game INT PRIMARY KEY,
        score DOUBLE NOT NULL DEFAULT 0,
        total_players INT NOT NULL DEFAULT 0,
        active_players INT NOT NULL DEFAULT 0,
        recent_activity INT NOT NULL DEFAULT 0,
        favorites INT NOT NULL DEFAULT 0,
        avg_rating DECIMAL(3,2),
        review_count INT NOT NULL DEFAULT 0,
        list_count INT NOT NULL DEFAULT 0,
        computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_score (score DESC),
        FOREIGN KEY (id_game) REFERENCES games(id_game) ON DELETE CASCADE
    )
`).catch(err => {
    if (process.env.NODE_ENV !== 'production')
        console.warn('[Games] hitboxd_score_cache init:', err.message);
});

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

    // Index invalidation removed: the games.consumer publishes game.upserted,
    // and the search reindex consumer (Bloque 7) handles invalidation there.

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

const getPopularOnHitboxd = async (limit = 12, dayWindow = 30, genre = null) => {
    const genreJoin  = genre ? 'JOIN game_genres gg ON g.id_game = gg.id_game JOIN genres gr ON gg.id_genre = gr.id_genre' : '';
    const genreWhere = genre ? 'AND gr.name = ?' : '';

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
        ${genreJoin}
        WHERE g.cover_url IS NOT NULL
            AND ug.status IN ('played', 'playing')
            ${genreWhere}
        GROUP BY
            g.id_game, g.title, g.slug, g.cover_url,
            g.developer, g.release_date, g.description
        HAVING COUNT(DISTINCT ug.id_user) >= 1
        ORDER BY hitboxd_score DESC
        LIMIT ?
    `;

    const params = genre
        ? [dayWindow, dayWindow, genre, limit]
        : [dayWindow, dayWindow, limit];

    try {
        const [rows] = await pool.query(query, params);
        return rows;
    } catch (error) {
        console.error('Error obteniendo populares de Hitboxd:', error.message);
        return [];
    }
};

const getRecommendedGames = async (userId, limit = 20) => {
    const query = `
        SELECT DISTINCT g.id_game, g.title, g.slug, g.cover_url, g.developer, g.release_date, g.popularity
        FROM game_genres gg1
        JOIN genres gr ON gg1.id_genre = gr.id_genre
        JOIN game_genres gg2 ON gg1.id_genre = gg2.id_genre
        JOIN games g ON gg2.id_game = g.id_game
        WHERE gg1.id_game IN (
            SELECT id_game FROM user_games
            WHERE id_user = ? AND status IN ('played', 'playing')
        )
        AND g.id_game NOT IN (
            SELECT id_game FROM user_games WHERE id_user = ?
        )
        AND g.cover_url IS NOT NULL
        ORDER BY g.popularity DESC
        LIMIT ?
    `;
    try {
        const [rows] = await pool.query(query, [userId, userId, limit]);
        return rows;
    } catch (error) {
        console.error('Error fetching recommendations:', error.message);
        return [];
    }
};

const getAllGamesForIndex = async () => {
    const [rows] = await pool.query(
        'SELECT id_game, igdb_id, title, slug, cover_url, developer, release_date, popularity FROM games LIMIT 5000'
    );
    return rows;
};

const getGameGenresLocal = async (gameId) => {
    const [rows] = await pool.query(`
        SELECT gr.igdb_genre_id as id, gr.name
        FROM game_genres gg
        JOIN genres gr ON gg.id_genre = gr.id_genre
        WHERE gg.id_game = ?
    `, [gameId]);
    return rows;
};

const upsertGameGenres = async (gameId, genres) => {
    for (const genre of genres) {
        await pool.query(
            `INSERT INTO genres (igdb_genre_id, name) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name)`,
            [genre.id, genre.name]
        );
        await pool.query(
            `INSERT IGNORE INTO game_genres (id_game, id_genre)
             SELECT ?, id_genre FROM genres WHERE igdb_genre_id = ?`,
            [gameId, genre.id]
        );
    }
};

const getStatusDistribution = async (gameId) => {
    const [rows] = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM user_games
        WHERE id_game = ? AND status IS NOT NULL
        GROUP BY status
    `, [gameId]);
    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
    return rows.map(r => ({
        status: r.status,
        count: Number(r.count),
        percentage: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
    }));
};

const getPopularFromCache = async (limit = 12, genre = null) => {
    const genreJoin  = genre ? 'JOIN game_genres gg ON g.id_game = gg.id_game JOIN genres gr ON gg.id_genre = gr.id_genre' : '';
    const genreWhere = genre ? 'AND gr.name = ?' : '';

    const query = `
        SELECT
            g.id_game, g.title, g.slug, g.cover_url, g.developer, g.release_date, g.description,
            hsc.score AS hitboxd_score,
            hsc.total_players, hsc.active_players, hsc.recent_activity,
            hsc.favorites, hsc.avg_rating, hsc.review_count, hsc.list_count,
            hsc.computed_at
        FROM hitboxd_score_cache hsc
        JOIN games g ON hsc.id_game = g.id_game
        ${genreJoin}
        WHERE hsc.score > 0 AND g.cover_url IS NOT NULL
            ${genreWhere}
        ORDER BY hsc.score DESC
        LIMIT ?
    `;

    const params = genre ? [genre, limit] : [limit];
    const [rows] = await pool.query(query, params);
    return rows;
};

// Recomputes hitboxd_score for all eligible games (up to 5000) and writes the
// results to hitboxd_score_cache in batches of 500 rows.
//
// Concurrent reads on hitboxd_score_cache are not blocked: InnoDB uses MVCC so
// SELECT queries always read a committed snapshot. Each 500-row batch is its own
// short transaction; readers see the previous batch's committed values until the
// next batch commits. There is no full-table lock at any point.
const UPSERT_CHUNK_SIZE = 500;

const recomputeHitboxdScores = async () => {
    const [rows] = await pool.query(`
        SELECT
            g.id_game,
            COUNT(DISTINCT ug.id_user)                                                                  AS total_players,
            SUM(CASE WHEN ug.status = 'playing' THEN 1 ELSE 0 END)                                     AS active_players,
            SUM(CASE WHEN ug.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END)         AS recent_activity,
            SUM(CASE WHEN ug.is_favorite = TRUE THEN 1 ELSE 0 END)                                     AS favorites,
            AVG(CASE WHEN ug.rating IS NOT NULL THEN ug.rating ELSE NULL END)                           AS avg_rating,
            COUNT(DISTINCT r.id_review)                                                                 AS review_count,
            COUNT(DISTINCT li.id_item)                                                                  AS list_count,
            (
                (SUM(CASE WHEN ug.status = 'playing' THEN 1 ELSE 0 END) * 3) +
                (SUM(CASE WHEN ug.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) * 2) +
                (COUNT(DISTINCT ug.id_user) * 1) +
                (SUM(CASE WHEN ug.is_favorite = TRUE THEN 1 ELSE 0 END) * 2) +
                (COUNT(DISTINCT r.id_review) * 1.5) +
                (COUNT(DISTINCT li.id_item) * 0.5)
            )                                                                                           AS hitboxd_score
        FROM games g
        INNER JOIN user_games ug ON g.id_game = ug.id_game
        LEFT JOIN reviews r ON g.id_game = r.id_game
        LEFT JOIN list_items li ON g.id_game = li.id_game
        WHERE g.cover_url IS NOT NULL
            AND ug.status IN ('played', 'playing')
        GROUP BY g.id_game
        HAVING COUNT(DISTINCT ug.id_user) >= 1
        ORDER BY hitboxd_score DESC
        LIMIT 5000
    `);

    if (rows.length === 0) return 0;

    const placeholderRow = '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const updateClause = `
        score          = VALUES(score),
        total_players  = VALUES(total_players),
        active_players = VALUES(active_players),
        recent_activity = VALUES(recent_activity),
        favorites      = VALUES(favorites),
        avg_rating     = VALUES(avg_rating),
        review_count   = VALUES(review_count),
        list_count     = VALUES(list_count),
        computed_at    = NOW()
    `;

    let upserted = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
        const placeholders = chunk.map(() => placeholderRow).join(', ');
        const values = chunk.flatMap(r => [
            r.id_game,
            r.hitboxd_score,
            r.total_players,
            r.active_players,
            r.recent_activity,
            r.favorites,
            r.avg_rating ?? null,
            r.review_count,
            r.list_count,
        ]);

        await pool.query(
            `INSERT INTO hitboxd_score_cache
                (id_game, score, total_players, active_players, recent_activity, favorites, avg_rating, review_count, list_count)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE ${updateClause}`,
            values
        );
        upserted += chunk.length;
    }

    return upserted;
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
    getRecommendedGames,
    getGameGenresLocal,
    upsertGameGenres,
    getStatusDistribution,
    getPopularFromCache,
    recomputeHitboxdScores,
    clearTrendingFlags,
    getTrendingAge,
};

// Resets is_trending on all games. Called by the IGDB refresh consumer before
// writing the new trending set so stale entries don't linger.
async function clearTrendingFlags() {
    await pool.query('UPDATE games SET is_trending = FALSE WHERE is_trending = TRUE');
}

// Returns milliseconds since the most recent trending game was updated.
// Returns Infinity when no trending games exist (fresh install).
// Used by the worker to skip the startup hydration if the cache is already warm.
async function getTrendingAge() {
    const [[row]] = await pool.query(
        'SELECT MAX(updated_at) AS last_updated FROM games WHERE is_trending = TRUE'
    );
    if (!row || !row.last_updated) return Infinity;
    return Date.now() - new Date(row.last_updated).getTime();
}