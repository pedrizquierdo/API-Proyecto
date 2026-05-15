import pool from '../../config/db.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';

/**
 * Devuelve estadisticas globales del sistema para el AdminDashboard.
 *
 * ADMIN-ONLY: no exponer sin verifyAdmin en el router.
 *
 * Las queries son ligeras (COUNT sobre indices), pero se ejecutan 9 en paralelo.
 * No hacer polling agresivo desde el cliente: intervalo minimo recomendado de 30s.
 * Si el volumen crece y el pool (default 10 conexiones) se satura bajo carga
 * concurrente, considerar cachear el response 60s en memoria o mover a un worker.
 */
const getGlobalStats = async (req, res) => {
    try {
        const [
            [[users]],
            [[games]],
            [[reviews]],
            [[lists]],
            [[follows]],
            [[activities]],
            [[pendingReports]],
            [[bannedUsers]],
            [[recentSignups]],
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users WHERE is_visible = TRUE'),
            pool.query('SELECT COUNT(*) as count FROM games'),
            pool.query('SELECT COUNT(*) as count FROM reviews'),
            pool.query('SELECT COUNT(*) as count FROM lists'),
            pool.query('SELECT COUNT(*) as count FROM follows'),
            pool.query('SELECT COUNT(*) as count FROM user_games'),
            pool.query("SELECT COUNT(DISTINCT id_review) as count FROM review_reports WHERE status = 'pending'"),
            pool.query('SELECT COUNT(*) as count FROM users WHERE is_visible = FALSE'),
            pool.query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
        ]);

        // Reviews por dia, ultimos 7 dias
        const [reviewsPerDay] = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM reviews
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Top juegos por actividad reciente (ultimos 30 dias)
        const [topGames] = await pool.query(`
            SELECT g.id_game, g.title, g.slug, g.cover_url,
                   COUNT(ug.id_activity) as activity_count
            FROM games g
            JOIN user_games ug ON g.id_game = ug.id_game
            WHERE ug.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY g.id_game
            ORDER BY activity_count DESC
            LIMIT 5
        `);

        res.json({
            counts: {
                active_users: Number(users.count),
                banned_users: Number(bannedUsers.count),
                total_games: Number(games.count),
                total_reviews: Number(reviews.count),
                total_lists: Number(lists.count),
                total_follows: Number(follows.count),
                total_activities: Number(activities.count),
                pending_reports: Number(pendingReports.count),
                recent_signups_7d: Number(recentSignups.count),
            },
            reviews_per_day_7d: reviewsPerDay.map(r => ({
                date: r.date,
                count: Number(r.count),
            })),
            top_games_30d: topGames,
            admin: {
                id_user: req.user.id_user,
                username: req.user.username,
            },
            generated_at: new Date().toISOString(),
        });
    } catch (error) {
        return errorHandlerController("Error obteniendo estadisticas globales", 500, res, error);
    }
};

export { getGlobalStats };
