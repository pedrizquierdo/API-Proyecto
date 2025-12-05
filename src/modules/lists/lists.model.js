import pool from '../../config/db.js';

const createList = async (listData) => {
    const { id_user, title, description, is_public, list_type } = listData;
    const [result] = await pool.query(
        "INSERT INTO lists (id_user, title, description, is_public, list_type) VALUES (?, ?, ?, ?, ?)",
        [id_user, title, description, is_public ?? true, list_type || 'collection']
    );
    return result.insertId;
};

const getListsByUser = async (userId) => {
    const [rows] = await pool.query(
        "SELECT * FROM lists WHERE id_user = ? ORDER BY created_at DESC", 
        [userId]
    );
    return rows;
};

const getListDetails = async (listId) => {
    const [listRows] = await pool.query("SELECT * FROM lists WHERE id_list = ?", [listId]);
    if (listRows.length === 0) return null;

    const list = listRows[0];

    const [gamesRows] = await pool.query(`
        SELECT li.id_item, li.position, li.comment, g.id_game, g.title, g.cover_url, g.slug
        FROM list_items li
        JOIN games g ON li.id_game = g.id_game
        WHERE li.id_list = ?
        ORDER BY li.position ASC
    `, [listId]);

    return { ...list, games: gamesRows };
};

const addGameToList = async (listId, gameId, comment) => {
    const [countRows] = await pool.query("SELECT COUNT(*) as count FROM list_items WHERE id_list = ?", [listId]);
    const position = countRows[0].count + 1;

    const [result] = await pool.query(
        "INSERT INTO list_items (id_list, id_game, position, comment) VALUES (?, ?, ?, ?)",
        [listId, gameId, position, comment]
    );
    return result.insertId;
};

const deleteList = async (listId, userId) => {
    const [result] = await pool.query(
        "DELETE FROM lists WHERE id_list = ? AND id_user = ?",
        [listId, userId]
    );
    return result.affectedRows > 0;
};

export { createList, getListsByUser, getListDetails, addGameToList, deleteList };