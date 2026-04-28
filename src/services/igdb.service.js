import axios from 'axios';

class IgdbService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.clientId = process.env.TWITCH_CLIENT_ID;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    }

    async _request(queryBody) {
        const token = await this._getAuthToken();
        const response = await axios.post(
            'https://api.igdb.com/v4/games',
            queryBody,
            {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'text/plain'
                }
            }
        );
        return response.data;
    }

    async _getAuthToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials'
                }
            });
            
            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            return this.accessToken;
        } catch (error) {
            console.error('ERROR obteniendo Token:', error.message);
            throw new Error('No se pudo autenticar con IGDB');
        }
    }

    async getTrendingGames(limit = 10) {
        const queryBody = `
            fields name, slug, cover.url, first_release_date, total_rating_count, summary, involved_companies.company.name, screenshots.url;
            sort total_rating_count desc;
            where cover != null & total_rating_count > 10;
            limit ${limit};
        `;

        try {
            const data = await this._request(queryBody);
            if (process.env.NODE_ENV !== 'production') console.log(`IGDB Respondió con ${data.length} juegos.`);
            return this._formatGames(data);
        } catch (error) {
            console.error('ERROR AXIOS:', error.response?.status, error.response?.data || error.message);
            return [];
        }
    }

    async getNewReleases(limit = 12) {
        const now = Math.floor(Date.now() / 1000);
        const queryBody = `
            fields name, slug, cover.url, first_release_date, total_rating_count, summary, involved_companies.company.name, screenshots.url;
            sort first_release_date desc;
            where first_release_date < ${now} & cover != null;
            limit ${limit};
        `;

        try {
            return this._formatGames(await this._request(queryBody));
        } catch (error) {
            console.error('Error New Releases:', error.message);
            return [];
        }
    }

    _buildSearchBodies(query, limit) {
        const normalized = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const safeNormalized = normalized.replace(/"/g, '\\"');
        const safeQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        // Strategy A: normalized substring — strips accents from query so "pokemon" matches "Pokémon"
        const stepABody = `
            fields name, slug, cover.url, first_release_date,
                   total_rating_count, involved_companies.company.name, summary;
            where name ~ *"${safeNormalized}"* & category = (0, 8, 9, 10, 11) & cover != null;
            sort total_rating_count desc;
            limit ${limit};
        `;

        // Strategy B: IGDB fuzzy search — no where clause (adding where breaks search operator)
        // category field is fetched so we can filter client-side
        const stepBBody = `
            search "${safeQuery}";
            fields name, slug, cover.url, first_release_date,
                   total_rating_count, involved_companies.company.name, summary, category;
            limit ${limit};
        `;

        return { stepABody, stepBBody };
    }

    _mergeResults(resA, resB, limit) {
        const VALID_CATEGORIES = new Set([0, 1, 2, 3, 4, 8, 9, 10, 11]);

        const stepA = resA.status === 'fulfilled' ? this._formatGames(resA.value) : [];
        const stepBRaw = resB.status === 'fulfilled'
            ? resB.value.filter(g => g.cover && (!g.category || VALID_CATEGORIES.has(g.category)))
            : [];
        const stepB = this._formatGames(stepBRaw);

        if (process.env.NODE_ENV !== 'production') {
            if (resA.status === 'rejected') console.warn('[IGDB] Estrategia A fallo:', resA.reason?.message);
            if (resB.status === 'rejected') console.warn('[IGDB] Estrategia B fallo:', resB.reason?.message);
        }

        const seen = new Set();
        const combined = [...stepA, ...stepB].filter(g => {
            if (seen.has(g.igdb_id)) return false;
            seen.add(g.igdb_id);
            return true;
        });
        combined.sort((a, b) => b.popularity - a.popularity);
        return combined.slice(0, limit);
    }

    async searchGame(query, limit = 10) {
        const { stepABody, stepBBody } = this._buildSearchBodies(query, limit);
        try {
            const [resA, resB] = await Promise.allSettled([
                this._request(stepABody),
                this._request(stepBBody),
            ]);

            if (process.env.NODE_ENV !== 'production') {
                const a = resA.status === 'fulfilled' ? resA.value.length : 0;
                const b = resB.status === 'fulfilled' ? resB.value.length : 0;
                console.log('[IGDB] "' + query + '" — A: ' + a + ', B: ' + b);
            }

            return this._mergeResults(resA, resB, limit);
        } catch (error) {
            console.error('Error buscando en IGDB:', error.message);
            return [];
        }
    }

    async searchGamesPaginated(query, page = 1, limit = 24) {
        const { stepABody, stepBBody } = this._buildSearchBodies(query, limit);

        try {
            const [resA, resB] = await Promise.allSettled([
                this._request(stepABody),
                this._request(stepBBody),
            ]);

            const stepA = resA.status === 'fulfilled' ? this._formatGames(resA.value) : [];
            const VALID_CATEGORIES = new Set([0, 1, 2, 3, 4, 8, 9, 10, 11]);
            const stepBRaw = resB.status === 'fulfilled'
                ? resB.value.filter(g => g.cover && (!g.category || VALID_CATEGORIES.has(g.category)))
                : [];
            const stepB = this._formatGames(stepBRaw);

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[IGDB Search] "${query}" — PasoA: ${stepA.length}, PasoB: ${stepB.length}`);
            }

            const seen = new Set();
            const combined = [...stepA, ...stepB].filter(g => {
                if (seen.has(g.igdb_id)) return false;
                seen.add(g.igdb_id);
                return true;
            });

            combined.sort((a, b) => b.popularity - a.popularity);

            const offset = (page - 1) * limit;
            const paginated = combined.slice(offset, offset + limit);

            return { results: paginated, total: combined.length, page, limit };
        } catch (error) {
            console.error('Error en búsqueda paginada IGDB:', error.message);
            return { results: [], total: 0, page, limit };
        }
    }

    _formatGames(igdbData) {
        
        return igdbData.map(game => {

            let bgUrl = null;
            
            if (game.screenshots && game.screenshots.length > 0) {
                bgUrl = `https:${game.screenshots[0].url.replace('t_thumb', 't_1080p')}`;
            } else if (game.cover) {
                bgUrl = `https:${game.cover.url.replace('t_thumb', 't_1080p')}`;
            }

            return {
                igdb_id: game.id,
                title: game.name,
                slug: game.slug,
                description: game.summary || "Sin descripción disponible.",
                cover_url: game.cover ? `https:${game.cover.url.replace('t_thumb', 't_1080p')}` : null,
                background_url: bgUrl, 
                release_date: game.first_release_date ? new Date(game.first_release_date * 1000) : null,
                developer: game.involved_companies?.[0]?.company?.name || 'Unknown',
                popularity: game.total_rating_count || 0
            };
        });
    }
}

const igdbServiceInstance = new IgdbService();

export default igdbServiceInstance;