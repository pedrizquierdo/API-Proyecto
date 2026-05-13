import pool from '../../config/db.js';

// Auto-create table on first import
pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
        id_notification INT PRIMARY KEY AUTO_INCREMENT,
        id_user  INT NOT NULL,
        id_actor INT NOT NULL,
        type ENUM('follow', 'review_like') NOT NULL,
        id_reference INT DEFAULT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (id_user),
        INDEX idx_unread (id_user, is_read)
    )
`).catch(err => {
    if (process.env.NODE_ENV !== 'production')
        console.warn('[Notifications] Table init:', err.message);
});

const fetchNotificationRow = async (id) => {
    const [[row]] = await pool.query(`
        SELECT n.id_notification, n.type, n.id_reference, n.is_read, n.created_at,
               u.username AS actor_username, u.avatar_url AS actor_avatar
        FROM notifications n
        JOIN users u ON n.id_actor = u.id_user
        WHERE n.id_notification = ?
    `, [id]);
    return row;
};

const createNotification = async (userId, actorId, type, referenceId = null) => {
    const [[existing]] = await pool.query(`
        SELECT id_notification FROM notifications
        WHERE id_user = ? AND id_actor = ? AND type = ? AND id_reference <=> ? AND is_read = 0
        LIMIT 1
    `, [userId, actorId, type, referenceId]);
    if (existing) return fetchNotificationRow(existing.id_notification);

    const [result] = await pool.query(
        `INSERT INTO notifications (id_user, id_actor, type, id_reference) VALUES (?, ?, ?, ?)`,
        [userId, actorId, type, referenceId]
    );
    return fetchNotificationRow(result.insertId);
};

const getNotifications = async (userId, limit = 30) => {
    const [rows] = await pool.query(`
        SELECT n.id_notification, n.type, n.id_reference, n.is_read, n.created_at,
               u.username AS actor_username, u.avatar_url AS actor_avatar
        FROM notifications n
        JOIN users u ON n.id_actor = u.id_user
        WHERE n.id_user = ?
        ORDER BY n.created_at DESC
        LIMIT ?
    `, [userId, limit]);
    return rows;
};

const getUnreadCount = async (userId) => {
    const [[{ count }]] = await pool.query(
        `SELECT COUNT(*) as count FROM notifications WHERE id_user = ? AND is_read = 0`,
        [userId]
    );
    return Number(count);
};

const markAllRead = async (userId) => {
    await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE id_user = ? AND is_read = 0`,
        [userId]
    );
};

const markOneRead = async (notifId, userId) => {
    await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE id_notification = ? AND id_user = ?`,
        [notifId, userId]
    );
};

export { createNotification, getNotifications, getUnreadCount, markAllRead, markOneRead };
