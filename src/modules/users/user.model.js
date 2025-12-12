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
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", 
        [user.username, user.email, user.password]
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
        "SELECT id_user, username, avatar_url, bio, pronouns, created_at FROM users WHERE username = ?", 
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

const updateVisibility = async (id, visibility) => {
    const [result] = await pool.query("UPDATE users SET is_visible = ? WHERE id_user = ?", [visibility, id]);
    return result.affectedRows > 0;
};

const softDeleteUser = (id) => {
    return updateVisibility(id, false);
};
    
const activateUser = (id) => {
    return updateVisibility(id, true);
};

// Exportamos todas las funciones
export { 
    getUserByEmail, 
    getUserByUsernameForAuth,
    createUser, 
    getUserInfo, 
    getUserByUsername, 
    updateUserProfile,
    followUser,
    softDeleteUser, 
    activateUser 
};