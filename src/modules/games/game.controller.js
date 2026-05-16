import { errorHandlerController } from "../../helpers/errorHandlerController.js";
import {
    getGameById,
    getGameBySlug,
    getTrendingGames,
    getNewGamesLocal,
    getGameByIgdbId,
    getRandomGame,
    getPopularOnHitboxd as getPopularOnHitboxdModel,
    getRecommendedGames,
    getGameGenresLocal,
    upsertGameGenres,
    getStatusDistribution,
    getPopularFromCache,
} from './game.model.js';
import { enqueueGameUpsert } from '../../queue/producers/games.producer.js';
import { publish } from '../../queue/rabbit.js';
import { EXCHANGES, ROUTING_KEYS } from '../../queue/topology.js';
import { getRatingDistribution, getGameRatingStats } from '../reviews/reviews.model.js';
import igdbService from '../../services/igdb.service.js';
import searchService from '../../services/search.service.js';

const getTrending = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const trending = await getTrendingGames(limit);

        if (trending.length >= limit) {
            return res.json(trending);
        }

        // Cache miss: trigger background refresh so the next request is served
        // from MySQL, then fall through to IGDB live data for this request.
        publish(EXCHANGES.EVENTS, ROUTING_KEYS.IGDB_REFRESH_TRENDING, { source: 'cache_miss' })
            .catch(err => console.error('[igdb.refresh] Fallo al publicar trending:', err.message));

        if (process.env.NODE_ENV !== 'production')
            console.log(`Cache local insuficiente (${trending.length}/${limit}). Consultando IGDB en vivo...`);

        const freshGames = await igdbService.getTrendingGames(limit);
        for (const game of freshGames) {
            enqueueGameUpsert({ ...game, is_trending: true })
                .catch(err => console.error('[games.enqueue]', err.message));
        }
        return res.json(freshGames.length ? freshGames : trending);
    } catch (error) {
        errorHandlerController("Error obteniendo tendencias", 500, res, error);
    }
};

const search = async (req, res) => {
    const { q } = req.query;

    if (!q) return res.status(400).json({ message: 'Se requiere término de búsqueda' });

    try {
        const localResults = await searchService.search(q, 10);

        if (process.env.NODE_ENV !== 'production')
            console.log('[Search] Fuse local: ' + localResults.length + ' para "' + q + '"');

        if (localResults.length < 3) {
            const igdbResults = await igdbService.searchGame(q);

            if (igdbResults.length > 0) {
                Promise.all(igdbResults.map(game => enqueueGameUpsert(game)))
                    .catch(err => console.error('[games.enqueue]', err.message));

                const igdbIds = new Set(igdbResults.map(g => g.igdb_id));
                const combined = [...igdbResults];
                localResults.forEach(g => {
                    if (!igdbIds.has(g.igdb_id)) combined.push(g);
                });
                return res.json(combined.slice(0, 10));
            }
        }

        return res.json(localResults);

    } catch (error) {
        try {
            return res.json(await igdbService.searchGame(q));
        } catch {
            return errorHandlerController('Error buscando juegos', 500, res, error);
        }
    }
};

const getById = async (req, res) => {
    const { id } = req.params;

    try {
        const game = await getGameById(id);

        if (!game) {
            return res.status(404).json({ message: "Juego no encontrado" });
        }

        res.json(game);
    } catch (error) {
        errorHandlerController("Error obteniendo detalles del juego", 500, res, error);
    }
};

const getNewReleases = async (req, res) => {
    try {
        const limit = 12;
        const newGames = await getNewGamesLocal(limit);

        if (newGames.length >= limit) {
            return res.json(newGames);
        }

        // Cache miss: trigger background refresh and serve IGDB live data.
        publish(EXCHANGES.EVENTS, ROUTING_KEYS.IGDB_REFRESH_NEW_RELEASES, { source: 'cache_miss' })
            .catch(err => console.error('[igdb.refresh] Fallo al publicar new_releases:', err.message));

        if (process.env.NODE_ENV !== 'production')
            console.log("Pocos juegos nuevos en local. Consultando IGDB en vivo...");

        const freshGames = await igdbService.getNewReleases(limit);
        for (const game of freshGames) {
            enqueueGameUpsert(game).catch(err => console.error('[games.enqueue]', err.message));
        }
        return res.json(freshGames.length ? freshGames : newGames);
    } catch (error) {
        errorHandlerController("Error obteniendo lanzamientos", 500, res, error);
    }
};


const searchPage = async (req, res) => {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;

    if (!q) {
        return res.status(400).json({ message: 'Se requiere término de búsqueda' });
    }

    try {
        const data = await igdbService.searchGamesPaginated(q, page, limit);
        data.results.forEach(game => enqueueGameUpsert(game).catch(err => console.error('[games.enqueue]', err.message)));
        res.json(data);
    } catch (error) {
        errorHandlerController('Error en búsqueda paginada', 500, res, error);
    }
};

const getBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const game = await getGameBySlug(slug);
        if (game) return res.json(game);

        // Local cache miss: try IGDB and warm the cache for future requests.
        const igdbGame = await igdbService.getGameBySlug(slug);
        if (!igdbGame) return res.status(404).json({ message: "Juego no encontrado" });

        enqueueGameUpsert(igdbGame).catch(err => console.error('[games.enqueue]', err.message));
        res.json(igdbGame);
    } catch (error) {
        errorHandlerController("Error obteniendo detalles del juego", 500, res, error);
    }
};
const getRandom = async (req, res) => {
    try {
        const excludeIds = req.query.excludeIds
            ? req.query.excludeIds.split(',').map(Number).filter(Boolean)
            : [];
        const game = await getRandomGame(excludeIds);
        if (!game) return res.status(404).json({ message: "No se encontró ningún juego" });
        res.json(game);
    } catch (error) {
        errorHandlerController("Error obteniendo juego aleatorio", 500, res, error);
    }
};

const getPopularOnHitboxd = async (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    const dayWindow = parseInt(req.query.days) || 30;
    const genre = req.query.genre || null;

    try {
        // Fast path: serve from precomputed cache.
        const cachedResults = await getPopularFromCache(limit, genre);

        if (cachedResults.length >= 6) {
            return res.json(cachedResults);
        }

        // Cache miss (fresh install or cache not yet populated): trigger a background
        // recompute so the next request will be served from cache, then fall through
        // to the live query to serve this request without delay.
        publish(EXCHANGES.EVENTS, ROUTING_KEYS.SCORES_RECOMPUTE_REQUESTED, { source: 'cache_miss' })
            .catch(err => console.error('[scores] Fallo al publicar recompute:', err.message));

        if (process.env.NODE_ENV !== 'production')
            console.log('[Popular] Cache insuficiente (' + cachedResults.length + '), ejecutando query en vivo...');

        const internalResults = await getPopularOnHitboxdModel(limit, dayWindow, genre);

        if (internalResults.length >= 6) {
            return res.json(internalResults);
        }

        if (process.env.NODE_ENV !== 'production')
            console.log('[Popular] Query en vivo insuficiente (' + internalResults.length + '), complementando con IGDB...');

        const igdbResults = await igdbService.getTrendingGames(limit);

        const internalIds = new Set(internalResults.map(g => g.id_game));
        const igdbFiltered = igdbResults.filter(g => !internalIds.has(g.id_game));

        Promise.all(igdbResults.map(g => enqueueGameUpsert(g))).catch(err => console.error('[games.enqueue]', err.message));

        return res.json([...internalResults, ...igdbFiltered].slice(0, limit));

    } catch (error) {
        errorHandlerController('Error obteniendo populares', 500, res, error);
    }
};

const getRecommended = async (req, res) => {
    try {
        const { id_user } = req.user;
        const limit = parseInt(req.query.limit) || 20;
        const games = await getRecommendedGames(id_user, limit);
        res.json(games);
    } catch (error) {
        errorHandlerController('Error obteniendo recomendaciones', 500, res, error);
    }
};

const getExtras = async (req, res) => {
    const { id } = req.params;
    try {
        const game = await getGameById(id);
        if (!game) return res.status(404).json({ message: "Juego no encontrado" });

        let genres = await getGameGenresLocal(id);
        let similarGames = [];

        if (game.igdb_id) {
            const extras = await igdbService.getGameExtras(game.igdb_id);
            similarGames = extras.similarGames;
            if (genres.length === 0 && extras.genres.length > 0) {
                genres = extras.genres;
                await upsertGameGenres(id, genres);
            }
        }

        res.json({ genres, similarGames });
    } catch (error) {
        errorHandlerController("Error obteniendo extras del juego", 500, res, error);
    }
};

const getStats = async (req, res) => {
    const { id } = req.params;
    try {
        const [ratingDist, ratingStats, statusDist] = await Promise.all([
            getRatingDistribution(id),
            getGameRatingStats(id),
            getStatusDistribution(id),
        ]);
        res.json({
            rating_distribution: ratingDist,
            avg_rating: ratingStats.avg_rating,
            total_ratings: ratingStats.total_ratings,
            status_distribution: statusDist,
        });
    } catch (error) {
        errorHandlerController("Error obteniendo estadísticas del juego", 500, res, error);
    }
};

const IGDB_REFRESH_KEYS = {
    trending:     ROUTING_KEYS.IGDB_REFRESH_TRENDING,
    new_releases: ROUTING_KEYS.IGDB_REFRESH_NEW_RELEASES,
    top_rated:    ROUTING_KEYS.IGDB_REFRESH_TOP_RATED,
};

const refreshIgdb = async (req, res) => {
    const { type } = req.params;
    const routingKey = IGDB_REFRESH_KEYS[type];
    if (!routingKey) {
        return res.status(400).json({ message: 'Tipo invalido. Usar: trending, new_releases, top_rated' });
    }
    try {
        await publish(EXCHANGES.EVENTS, routingKey, {
            triggeredBy: req.user.id_user,
            source: 'admin',
        });
        res.status(202).json({ message: 'Refresh de IGDB encolado' });
    } catch (error) {
        errorHandlerController('Error encolando refresh IGDB', 500, res, error);
    }
};

const triggerRecomputeScores = async (req, res) => {
    try {
        await publish(EXCHANGES.EVENTS, ROUTING_KEYS.SCORES_RECOMPUTE_REQUESTED, {
            triggeredBy: req.user.id_user,
            source: 'admin',
        });
        res.status(202).json({ message: 'Recomputo de scores encolado' });
    } catch (error) {
        errorHandlerController('Error encolando recomputo de scores', 500, res, error);
    }
};

const triggerReindex = async (req, res) => {
    try {
        await publish(EXCHANGES.EVENTS, ROUTING_KEYS.SEARCH_REINDEX_REQUESTED, {
            triggeredBy: req.user.id_user,
        });
        res.status(202).json({ message: 'Reindexacion encolada' });
    } catch (error) {
        errorHandlerController('Error encolando reindex', 500, res, error);
    }
};

export { getTrending, search, searchPage, getById, getBySlug, getNewReleases, getRandom, getPopularOnHitboxd, getRecommended, getExtras, getStats, triggerReindex, triggerRecomputeScores, refreshIgdb };