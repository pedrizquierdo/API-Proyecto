import Fuse from 'fuse.js';
import pool from '../config/db.js';

class SearchService {
    constructor() {
        this.fuse = null;
        this.gameIndex = [];
        this.lastIndexed = null;
        this.INDEX_TTL = 5 * 60 * 1000;
    }

    async _buildIndex() {
        const now = Date.now();
        if (this.fuse && this.lastIndexed && (now - this.lastIndexed) < this.INDEX_TTL) {
            return;
        }
        const [rows] = await pool.query(
            'SELECT id_game, title, slug, cover_url, developer, release_date, popularity FROM games ORDER BY popularity DESC'
        );
        this.gameIndex = rows;
        this.fuse = new Fuse(rows, {
            keys: [
                { name: 'title', weight: 0.8 },
                { name: 'developer', weight: 0.2 },
            ],
            threshold: 0.4,
            distance: 200,
            minMatchCharLength: 2,
            includeScore: true,
            ignoreLocation: true,
        });
        this.lastIndexed = now;
        if (process.env.NODE_ENV !== 'production')
            console.log(`[Search] Indice construido con ${rows.length} juegos`);
    }

    async search(query, limit = 10) {
        await this._buildIndex();
        if (!this.fuse) return [];
        const results = this.fuse.search(query, { limit });
        return results.map(r => r.item);
    }

    invalidateIndex() {
        this.lastIndexed = null;
    }
}

const searchService = new SearchService();
export default searchService;
