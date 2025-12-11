import axios from 'axios';

class IgdbService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.clientId = process.env.TWITCH_CLIENT_ID;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
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
        const token = await this._getAuthToken();

 
        const queryBody = `
            fields name, slug, cover.url, first_release_date, total_rating_count, summary, involved_companies.company.name, screenshots.url; 
            sort total_rating_count desc; 
            where cover != null & total_rating_count > 10; 
            limit ${limit};
        `;

        console.log("Query Developer:", queryBody);

        try {
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

            console.log(`IGDB Respondió con ${response.data.length} juegos.`);
            return this._formatGames(response.data);
        } catch (error) {
            console.error(' ERROR AXIOS:', error.response?.status, error.response?.data || error.message);
            return [];
        }
    }

    async getNewReleases(limit = 10) {
        const token = await this._getAuthToken();
        const now = Math.floor(Date.now() / 1000);

        const queryBody = `
            fields name, slug, cover.url, first_release_date, total_rating_count, summary, involved_companies.company.name;
            sort first_release_date desc; 
            where first_release_date < ${now} & cover != null & category = (0, 8, 9);
            limit ${limit};
        `;

        try {
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
            return this._formatGames(response.data);
        } catch (error) {
            console.error('Error New Releases:', error.message);
            return [];
        }
    }

    async searchGame(query) {
        const token = await this._getAuthToken();

        try {
            const queryBody = `
                search "${query}"; 
                fields name, slug, cover.url, first_release_date, total_rating_count, involved_companies.company.name, summary; 
                where category = (0, 8, 9);
                limit 10;
            `;

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
            return this._formatGames(response.data);
        } catch (error) {
            console.error('Error buscando en IGDB:', error.message);
            return [];
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