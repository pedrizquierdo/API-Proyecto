import dotenv from 'dotenv';
dotenv.config();

import { getAllGamesForIndex } from '../src/modules/games/game.model.js';
import searchService from '../src/services/search.service.js';

const reindex = async () => {
    console.log('Iniciando re-indexacion...');
    const games = await getAllGamesForIndex();
    console.log(`Cargando ${games.length} juegos en el indice Fuse...`);
    await searchService.search('__warmup__');
    console.log('Re-indexacion completada.');
    process.exit(0);
};

reindex().catch(err => {
    console.error(err);
    process.exit(1);
});
