import pool from "../../config/db.js";


const getUserByEmail = async (email) => {
    const [rows] = await pool.query("SELECT id_user, name, email, password, is_visible FROM users WHERE email = ?", [email]);
    return rows[0];
};

const createUser = async (user) => {
    const [result] = await pool.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [user.name, user.email, user.password]);
    return result.insertId;
};

const getUserById = async (id) => {
    const [rows] = await pool.query("SELECT id_user, name, email, password FROM users WHERE id_user = ?", [id]);
    return rows[0];
};

const getUserInfo = async (id) => {
    const [rows] = await pool.query("SELECT id_user, name, email FROM users WHERE id_user = ?", [id]);
    return rows[0];
};

const updateUser = async (id, name, email) => {
    const [result] = await pool.query("UPDATE users SET name = ?, email = ? WHERE id_user = ?", [name, email, id]);
    return result.affectedRows > 0;
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

export { getUserByEmail, createUser, getUserById, getUserInfo, updateUser, softDeleteUser, activateUser };