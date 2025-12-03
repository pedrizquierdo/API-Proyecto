import pool from "../../config/db.js";

const getUserByEmail = async (email) => {
    const [rows] = await pool.query(
        "SELECT id_user, username, email, password_hash as password, role FROM users WHERE email = ?", 
        [email]
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
    const [rows] = await pool.query(
        "SELECT id_user, username, email, avatar_url, bio, pronouns, role, created_at FROM users WHERE id_user = ?", 
        [id]
    );
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
    createUser, 
    getUserInfo, 
    getUserByUsername, 
    updateUserProfile,
    followUser,
    softDeleteUser, 
    activateUser 
};