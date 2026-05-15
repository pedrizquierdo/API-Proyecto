import pool from "../../config/db.js";

const getUserByEmail = async (email) => {
    const [rows] = await pool.query(
        "SELECT id_user, username, email, password_hash as password, role FROM users WHERE email = ?", 
        [email]
    );
    return rows[0];
};

const getUserByUsernameForAuth = async (username) => {
    const [rows] = await pool.query(
        "SELECT id_user, username, email, password_hash as password, role, is_visible FROM users WHERE username = ?", 
        [username]
    );
    return rows[0];
};

const createUser = async (user) => {
    const [result] = await pool.query(
        "INSERT INTO users (username, email, password_hash, avatar_url) VALUES (?, ?, ?, ?)", 
        [user.username, user.email, user.password, user.avatar_url]
    );
    return result.insertId;
};

const getUserInfo = async (id) => {
    const query = `
        SELECT 
            u.id_user, u.username, u.email, u.avatar_url, u.bio, u.pronouns, u.role, u.created_at,
            -- Subconsultas para contadores
            (SELECT COUNT(*) FROM follows WHERE following_id = u.id_user) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.id_user) as following_count,
            (SELECT COUNT(*) FROM user_games WHERE id_user = u.id_user) as games_count
        FROM users u 
        WHERE u.id_user = ?
    `;
    
    const [rows] = await pool.query(query, [id]);
    return rows[0];
};

const getUserByUsername = async (username) => {
    const [rows] = await pool.query(
        "SELECT id_user, username, avatar_url, bio, pronouns, created_at FROM users WHERE username = ? AND is_visible = TRUE",
        [username]
    );
    return rows[0];
};

// Usamos COALESCE para que si envías un campo null, no borre lo que ya existía
const updateUserProfile = async (id, data) => {
    const query = `
        UPDATE users 
        SET 
            bio = COALESCE(?, bio),
            avatar_url = COALESCE(?, avatar_url),
            pronouns = COALESCE(?, pronouns)
        WHERE id_user = ?
    `;
    
    const [result] = await pool.query(query, [data.bio, data.avatar_url, data.pronouns, id]);
    
    // Si se actualizó, devolvemos los datos nuevos para actualizar el frontend
    if (result.affectedRows > 0) {
        return getUserInfo(id);
    }
    return null;
};

const followUser = async (followerId, followingId) => {
    const [result] = await pool.query(
        "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
        [followerId, followingId]
    );
    return result;
};

const unfollowUser = async (followerId, followingId) => {
    const [result] = await pool.query(
        "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
        [followerId, followingId]
    );
    return result.affectedRows > 0;
};

const checkFollowStatus = async (followerId, followingId) => {
    const [rows] = await pool.query(
        "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?",
        [followerId, followingId]
    );
    return rows.length > 0;
};

const updateVisibility = async (id, visibility) => {
    const [result] = await pool.query("UPDATE users SET is_visible = ? WHERE id_user = ?", [visibility, id]);
    return result.affectedRows > 0;
};

const searchUsersByUsername = async (query) => {
    if (query.length < 2) return [];
    const [rows] = await pool.query(
        "SELECT id_user, username, avatar_url FROM users WHERE username LIKE ? AND is_visible = TRUE LIMIT 5",
        [`%${query}%`]
    );
    return rows;
};

const getFollowersModel = async (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(`
        SELECT u.id_user, u.username, u.avatar_url, u.bio
        FROM follows f
        JOIN users u ON f.follower_id = u.id_user
        WHERE f.following_id = ?
        LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
    return rows;
};

const getFollowingModel = async (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(`
        SELECT u.id_user, u.username, u.avatar_url, u.bio
        FROM follows f
        JOIN users u ON f.following_id = u.id_user
        WHERE f.follower_id = ?
        LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
    return rows;
};

const softDeleteUser = (id) => {
    return updateVisibility(id, false);
};
    
const activateUser = (id) => {
    return updateVisibility(id, true);
};

const getFollowerIds = async (userId) => {
    const [rows] = await pool.query(
        'SELECT follower_id FROM follows WHERE following_id = ?',
        [userId]
    );
    return rows.map(r => r.follower_id);
};

const getAllUsersAdmin = async ({ page = 1, limit = 20, query = null, includeBanned = true }) => {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = 'WHERE 1=1';
    if (query) {
        whereClause += ' AND (username LIKE ? OR email LIKE ?)';
        params.push(`%${query}%`, `%${query}%`);
    }
    if (!includeBanned) {
        whereClause += ' AND is_visible = TRUE';
    }
    params.push(limit, offset);

    const [rows] = await pool.query(`
        SELECT id_user, username, email, role, is_visible, avatar_url, created_at,
               (SELECT COUNT(*) FROM follows WHERE following_id = u.id_user) as followers_count,
               (SELECT COUNT(*) FROM user_games WHERE id_user = u.id_user) as games_count
        FROM users u
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, params);

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM users u ${whereClause}`,
        params.slice(0, params.length - 2)
    );

    return { users: rows, total, page, limit };
};

const banUserAdmin = async (targetUserId, adminUserId) => {
    if (targetUserId === adminUserId) {
        return { success: false, reason: 'self_ban' };
    }

    const [[target]] = await pool.query(
        'SELECT role, is_visible FROM users WHERE id_user = ?',
        [targetUserId]
    );
    if (!target) return { success: false, reason: 'not_found' };
    if (target.role === 'admin') return { success: false, reason: 'cannot_ban_admin' };
    if (target.is_visible === 0) return { success: false, reason: 'already_banned' };

    await pool.query(
        'UPDATE users SET is_visible = FALSE WHERE id_user = ?',
        [targetUserId]
    );
    return { success: true };
};

const unbanUserAdmin = async (targetUserId) => {
    const [[target]] = await pool.query(
        'SELECT is_visible FROM users WHERE id_user = ?',
        [targetUserId]
    );
    if (!target) return { success: false, reason: 'not_found' };
    if (target.is_visible === 1) return { success: false, reason: 'not_banned' };

    await pool.query(
        'UPDATE users SET is_visible = TRUE WHERE id_user = ?',
        [targetUserId]
    );
    return { success: true };
};

// TODO: revocacion de sesion inmediata para baneos (requiere session store o JWT denylist)

export {
    getUserByEmail,
    getUserByUsernameForAuth,
    createUser,
    getUserInfo,
    getUserByUsername,
    updateUserProfile,
    followUser,
    unfollowUser,
    updateVisibility,
    checkFollowStatus,
    softDeleteUser,
    activateUser,
    searchUsersByUsername,
    getFollowersModel,
    getFollowingModel,
    getUserCount,
    getUserSuggestions,
    getFollowerIds,
    getAllUsersAdmin,
    banUserAdmin,
    unbanUserAdmin,
};

async function getUserCount() {
    const [[{ count }]] = await pool.query("SELECT COUNT(*) as count FROM users");
    return Number(count);
}

async function getUserSuggestions(userId, limit = 6) {
    const [rows] = await pool.query(`
        SELECT DISTINCT u.id_user, u.username, u.avatar_url, u.bio
        FROM follows f1
        JOIN follows f2 ON f1.following_id = f2.follower_id
        JOIN users u ON f2.following_id = u.id_user
        WHERE f1.follower_id = ?
          AND f2.following_id != ?
          AND u.is_visible = TRUE
          AND f2.following_id NOT IN (
              SELECT following_id FROM follows WHERE follower_id = ?
          )
        UNION
        SELECT DISTINCT u.id_user, u.username, u.avatar_url, u.bio
        FROM follows f
        JOIN users u ON f.follower_id = u.id_user
        WHERE f.following_id = ?
          AND f.follower_id != ?
          AND u.is_visible = TRUE
          AND f.follower_id NOT IN (
              SELECT following_id FROM follows WHERE follower_id = ?
          )
        LIMIT ?
    `, [userId, userId, userId, userId, userId, userId, limit]);
    return rows;
}