import { errorHandlerController } from "../../helpers/errorHandlerController.js";
import GamesModel from './game.model.js';
import igdbService from '../../services/igdb.service.js';

// 1. Obtener juegos en tendencia (Para Landing Page y Onboarding)
const getTrending = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        // 1. Intentar obtener tendencias cacheadas de la DB Local
        let trending = await GamesModel.getTrendingGames(limit);

        // 2. Si la DB está vacía o los datos son viejos (Cold Start Strategy)
        if (trending.length < limit) {
            console.log(`Cache local insuficiente (${trending.length}/${limit}). Consultando IGDB...`);
            
            const freshGames = await igdbService.getTrendingGames(limit);
            
            for (const game of freshGames) {
                game.is_trending = true;
                await GamesModel.createOrUpdateGame(game);
            }
            
            trending = freshGames;
        }

        res.json(trending);
    } catch (error) {
        console.error("Error en getTrending:", error);
        res.status(500).json({ message: "Error obteniendo tendencias" });
    }
};

// 2. Búsqueda Inteligente (El núcleo de tu app)
const search = async (req, res) => {
    const { q } = req.query; // Obtiene ?q=zelda

    if (!q) {
        return res.status(400).json({ message: "Se requiere un término de búsqueda" });
    }

    try {
        console.log(`Buscando: ${q}`);

        // PASO A: Buscamos en IGDB (Siempre priorizamos datos frescos para búsqueda)
        const igdbResults = await igdbService.searchGame(q);

        if (igdbResults.length > 0) {
            // PASO B: "Hydration" - Guardamos/Actualizamos silenciosamente en MySQL
            // Esto asegura que si el usuario hace clic en un juego, YA lo tenemos en la DB
            const savePromises = igdbResults.map(game => GamesModel.createOrUpdateGame(game));
            await Promise.all(savePromises);
            
            console.log(`Se cachearon ${igdbResults.length} juegos desde IGDB.`);
            return res.json(igdbResults);
        }

        // PASO C: Fallback - Si IGDB falla o no trae nada, buscamos solo localmente
        const localResults = await GamesModel.searchGamesByTitle(q);
        res.json(localResults);

    } catch (error) {
        errorHandlerController("Error buscando juegos", 500, res, error);

        // Fallback adicional en caso de error
        const localFallback = await GamesModel.searchGamesByTitle(q);
        res.json(localFallback);
    }
};

// 3. Obtener detalle de un juego (Por ID local)
const getById = async (req, res) => {
    const { id } = req.params;

    try {
        const game = await GamesModel.getGameById(id);

        if (!game) {
            return res.status(404).json({ message: "Juego no encontrado" });
        }

        res.json(game);
    } catch (error) {
        errorHandlerController("Error obteniendo detalles del juego", 500, res, error);
    }
};

// 4. Obtener detalle por Slug (Para URLs bonitas)
const getBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const game = await GamesModel.getGameBySlug(slug);
        if (!game) return res.status(404).json({ message: "Juego no encontrado" });
        res.json(game);
    } catch (error) {
        errorHandlerController("Error obteniendo detalles del juego", 500, res, error);
    }
};
export { getTrending, search, getById, getBySlug };