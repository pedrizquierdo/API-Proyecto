import { errorHandlerController } from "../../helpers/errorHandlerController.js";
import {
    getGameById,
    getGameBySlug,
    getTrendingGames,
    getNewGamesLocal,
    searchGamesByTitle,
    createOrUpdateGame,
    getGameByIgdbId,
} from './game.model.js';
import igdbService from '../../services/igdb.service.js';

const getTrending = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        let trending = await getTrendingGames(limit);

        if (trending.length < limit) {
            if (process.env.NODE_ENV !== 'production') console.log(`Cache local insuficiente (${trending.length}/${limit}). Consultando IGDB...`);
            
            const freshGames = await igdbService.getTrendingGames(limit);
            
            for (const game of freshGames) {
                game.is_trending = true;
                await createOrUpdateGame(game);
            }
            
            trending = freshGames;
        }

        res.json(trending);
    } catch (error) {
        errorHandlerController("Error obteniendo tendencias", 500, res, error);
    }
};

const search = async (req, res) => {
    const { q } = req.query; // Obtiene ?q=zelda

    if (!q) {
        return res.status(400).json({ message: "Se requiere un término de búsqueda" });
    }

    try {
        if (process.env.NODE_ENV !== 'production') console.log(`Buscando: ${q}`);

        // PASO A: Buscamos en IGDB (Siempre priorizamos datos frescos para búsqueda)
        const igdbResults = await igdbService.searchGame(q);

        if (igdbResults.length > 0) {
            // PASO B: "Hydration" - Guardamos/Actualizamos silenciosamente en MySQL
            // Esto asegura que si el usuario hace clic en un juego, YA lo tenemos en la DB
            const savePromises = igdbResults.map(game => createOrUpdateGame(game));
            await Promise.all(savePromises);
            
            if (process.env.NODE_ENV !== 'production') console.log(`Se cachearon ${igdbResults.length} juegos desde IGDB.`);
            return res.json(igdbResults);
        }

        // PASO C: Fallback - Si IGDB falla o no trae nada, buscamos solo localmente
        const localResults = await searchGamesByTitle(q);
        res.json(localResults);

    } catch (error) {
        try {
            const localFallback = await searchGamesByTitle(q);
            return res.json(localFallback);
        } catch (fallbackError) {
            errorHandlerController("Error buscando juegos", 500, res, error);
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
        let newGames = await getNewGamesLocal(limit);

        if (newGames.length < limit) {
            if (process.env.NODE_ENV !== 'production') console.log("Pocos juegos nuevos en local. Consultando IGDB...");
            const freshGames = await igdbService.getNewReleases(limit);
            
            if (freshGames.length > 0) {
                for (const game of freshGames) {
                    await createOrUpdateGame(game);
                }

                newGames = freshGames;
            }
        }

        res.json(newGames);
    } catch (error) {
        errorHandlerController("Error obteniendo lanzamientos", 500, res, error);
    }
};


const getBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const game = await getGameBySlug(slug);
        if (!game) return res.status(404).json({ message: "Juego no encontrado" });
        res.json(game);
    } catch (error) {
        errorHandlerController("Error obteniendo detalles del juego", 500, res, error);
    }
};
export { getTrending, search, getById, getBySlug, getNewReleases };