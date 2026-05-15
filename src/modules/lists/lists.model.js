import pool from '../../config/db.js';

const createList = async (listData) => {
    const { id_user, title, description, is_public, list_type } = listData;
    const [result] = await pool.query(
        "INSERT INTO lists (id_user, title, description, is_public, list_type) VALUES (?, ?, ?, ?, ?)",
        [id_user, title, description, is_public ?? true, list_type || 'collection']
    );
    return result.insertId;
};

const getListsByUser = async (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
        "SELECT * FROM lists WHERE id_user = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [userId, limit, offset]
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

const getPopularLists = async (limit = 6) => {
    const [rows] = await pool.query(`
        SELECT
            l.id_list,
            l.title,
            l.description,
            l.list_type,
            l.id_user,
            u.username,
            u.avatar_url,
            COUNT(DISTINCT lk.id_like) AS like_count,
            COUNT(DISTINCT li.id_item) AS game_count,
            GROUP_CONCAT(DISTINCT g.cover_url ORDER BY li.position ASC SEPARATOR '||') AS cover_urls
        FROM lists l
        JOIN users u ON l.id_user = u.id_user
        LEFT JOIN likes lk ON lk.id_list = l.id_list
            AND lk.created_at >= NOW() - INTERVAL 7 DAY
        LEFT JOIN list_items li ON li.id_list = l.id_list
        LEFT JOIN games g ON li.id_game = g.id_game
        WHERE l.is_public = TRUE
        GROUP BY l.id_list, l.title, l.description, l.list_type, l.id_user, u.username, u.avatar_url
        HAVING like_count > 0
        ORDER BY like_count DESC, l.created_at DESC
        LIMIT ?
    `, [limit]);

    return rows.map(row => ({
        ...row,
        like_count: Number(row.like_count),
        game_count: Number(row.game_count),
        covers: row.cover_urls ? row.cover_urls.split('||').filter(Boolean).slice(0, 5) : [],
        cover_urls: undefined,
    }));
};

const removeListItem = async (listId, itemId, userId) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[item]] = await conn.query(`
            SELECT li.position
            FROM list_items li
            JOIN lists l ON li.id_list = l.id_list
            WHERE li.id_item = ? AND li.id_list = ? AND l.id_user = ?
        `, [itemId, listId, userId]);

        if (!item) {
            await conn.rollback();
            return { success: false, reason: 'not_found_or_forbidden' };
        }

        await conn.query('DELETE FROM list_items WHERE id_item = ?', [itemId]);

        await conn.query(`
            UPDATE list_items
            SET position = position - 1
            WHERE id_list = ? AND position > ?
        `, [listId, item.position]);

        await conn.commit();
        return { success: true };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const reorderListItems = async (listId, userId, orderedItems) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[listRow]] = await conn.query(
            'SELECT id_user FROM lists WHERE id_list = ?',
            [listId]
        );
        if (!listRow) {
            await conn.rollback();
            return { success: false, reason: 'not_found' };
        }
        if (listRow.id_user !== userId) {
            await conn.rollback();
            return { success: false, reason: 'forbidden' };
        }

        const [currentItems] = await conn.query(
            'SELECT id_item FROM list_items WHERE id_list = ?',
            [listId]
        );
        const currentIds = new Set(currentItems.map(r => r.id_item));
        const incomingIds = new Set(orderedItems.map(o => o.id_item));

        if (currentIds.size !== incomingIds.size ||
            ![...currentIds].every(id => incomingIds.has(id))) {
            await conn.rollback();
            return { success: false, reason: 'mismatch' };
        }

        const positions = orderedItems.map(o => o.position).sort((a, b) => a - b);
        const expected = Array.from({ length: positions.length }, (_, i) => i + 1);
        if (JSON.stringify(positions) !== JSON.stringify(expected)) {
            await conn.rollback();
            return { success: false, reason: 'invalid_positions' };
        }

        for (const { id_item, position } of orderedItems) {
            await conn.query(
                'UPDATE list_items SET position = ? WHERE id_item = ? AND id_list = ?',
                [position, id_item, listId]
            );
        }

        await conn.commit();
        return { success: true };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

export { createList, getListsByUser, getListDetails, addGameToList, deleteList, getPopularLists, removeListItem, reorderListItems };