import 'dotenv/config';
import igdbService from '../src/services/igdb.service.js';
import { createOrUpdateGame, getGameByIgdbId } from '../src/modules/games/game.model.js';
import pool from '../src/config/db.js';

// Guard runs after imports (ESM hoists import declarations)
if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
    console.error('Set FORCE_SEED=true to run in production');
    process.exit(1);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTopRated(limit = 50) {
    const queryBody = `
        fields name, slug, cover.url, first_release_date, total_rating, total_rating_count, summary, involved_companies.company.name, screenshots.url;
        sort total_rating desc;
        where total_rating > 80 & cover != null & total_rating_count > 20;
        limit ${limit};
    `;
    const data = await igdbService._request(queryBody);
    return igdbService._formatGames(data);
}

async function seedBatch(games, label) {
    let inserted = 0;
    let updated = 0;

    for (const game of games) {
        const existing = await getGameByIgdbId(game.igdb_id);
        await createOrUpdateGame(game);
        if (existing) {
            updated++;
        } else {
            inserted++;
        }
        await delay(100);
    }

    console.log(`[${label}] inserted: ${inserted}, updated: ${updated}`);
    return { inserted, updated };
}

async function main() {
    console.log('Starting seed...');

    // Sequential to respect IGDB rate limits
    const topRated = await fetchTopRated(50);
    await delay(300);
    const trending = await igdbService.getTrendingGames(20);
    await delay(300);
    const newReleases = await igdbService.getNewReleases(20);

    const r1 = await seedBatch(topRated, 'top-rated');
    const r2 = await seedBatch(trending, 'trending');
    const r3 = await seedBatch(newReleases, 'new-releases');

    const totalInserted = r1.inserted + r2.inserted + r3.inserted;
    const totalUpdated = r1.updated + r2.updated + r3.updated;
    console.log(`Seed complete. Total inserted: ${totalInserted}, total updated: ${totalUpdated}`);

    await pool.end();
}

main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
