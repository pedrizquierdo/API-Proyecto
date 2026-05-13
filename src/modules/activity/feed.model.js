import pool from '../../config/db.js';

// Runtime migration — same pattern as notifications.model.js.
//
// UNIQUE KEY uq_feed_item (id_user, event_type, id_reference) serves two purposes:
//   1. Idempotency: broker redeliveries run ON DUPLICATE KEY UPDATE instead of
//      inserting a duplicate, so the fan-out is safe to replay.
//   2. Activity updates: when a user re-logs the same game with a new status,
//      the next fan-out replaces the old payload in each follower's feed so
//      followers see the latest state rather than a stale entry.
//
// idx_user_feed_item (id_user, id_feed_item) drives the keyset-paginated read
// path in getFeedFor() — O(1) seek + O(limit) scan regardless of feed depth.
pool.query(`
    CREATE TABLE IF NOT EXISTS feed_items (
        id_feed_item BIGINT PRIMARY KEY AUTO_INCREMENT,
        id_user      INT NOT NULL,
        id_actor     INT NOT NULL,
        event_type   ENUM('activity','review') NOT NULL,
        id_reference INT NOT NULL,
        id_game      INT,
        payload_json JSON,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_feed_item (id_user, event_type, id_reference),
        INDEX idx_user_created  (id_user, created_at DESC),
        INDEX idx_user_feed_item (id_user, id_feed_item),
        INDEX idx_reference     (event_type, id_reference)
    )
`).catch(err => {
    if (process.env.NODE_ENV !== 'production')
        console.warn('[Feed] feed_items init:', err.message);
});

// Bulk-insert feed rows. Uses ON DUPLICATE KEY UPDATE so the same fan-out
// message can be delivered more than once without creating duplicates.
const insertFeedItems = async (rows) => {
    if (rows.length === 0) return;

    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const values = rows.flatMap(r => [
        r.id_user,
        r.id_actor,
        r.event_type,
        r.id_reference,
        r.id_game ?? null,
        typeof r.payload_json === 'string' ? r.payload_json : JSON.stringify(r.payload_json),
    ]);

    await pool.query(
        `INSERT INTO feed_items
             (id_user, id_actor, event_type, id_reference, id_game, payload_json)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
             payload_json = VALUES(payload_json),
             created_at   = NOW()`,
        values
    );
};

// Keyset-paginated feed read. Pass beforeId (id_feed_item of the last item
// seen) to get the next page. Returns payload_json already parsed to an object.
const getFeedFor = async (userId, limit = 20, beforeId = null) => {
    const cursor = beforeId ? 'AND id_feed_item < ?' : '';
    const params = beforeId ? [userId, beforeId, limit] : [userId, limit];

    const [rows] = await pool.query(
        `SELECT id_feed_item, event_type, id_reference, id_game,
                payload_json, created_at, id_actor
         FROM feed_items
         WHERE id_user = ? ${cursor}
         ORDER BY id_feed_item DESC
         LIMIT ?`,
        params
    );

    return rows.map(r => ({
        ...r,
        payload: typeof r.payload_json === 'string'
            ? JSON.parse(r.payload_json)
            : r.payload_json,
        payload_json: undefined,
    }));
};

// Returns true when the user has at least one pre-computed feed row.
// Used by the controller to decide whether to fall back to getFriendsFeed.
const hasFeedItemsFor = async (userId) => {
    const [[row]] = await pool.query(
        'SELECT 1 FROM feed_items WHERE id_user = ? LIMIT 1',
        [userId]
    );
    return !!row;
};

// Removes feed_items for a deleted event.
// For activities: pass actorId so only that actor's activity rows are removed
// (id_reference = id_game is shared across actors for the same game).
// For reviews: id_reference = id_review is globally unique, so actorId is optional.
const deleteFeedItemsByReference = async (eventType, referenceId, actorId = null) => {
    if (actorId !== null) {
        await pool.query(
            'DELETE FROM feed_items WHERE event_type = ? AND id_reference = ? AND id_actor = ?',
            [eventType, referenceId, actorId]
        );
    } else {
        await pool.query(
            'DELETE FROM feed_items WHERE event_type = ? AND id_reference = ?',
            [eventType, referenceId]
        );
    }
};

// Deletes feed_items older than 90 days in batches to avoid long-running
// transactions. Returns the total number of rows removed.
const CLEANUP_DAYS = 90;

const cleanupOldFeedItems = async (batchSize = 10_000) => {
    let totalDeleted = 0;
    let deleted;
    do {
        const [result] = await pool.query(
            'DELETE FROM feed_items WHERE created_at < NOW() - INTERVAL ? DAY LIMIT ?',
            [CLEANUP_DAYS, batchSize]
        );
        deleted = result.affectedRows;
        totalDeleted += deleted;
    } while (deleted === batchSize);
    return totalDeleted;
};

export {
    insertFeedItems,
    getFeedFor,
    hasFeedItemsFor,
    deleteFeedItemsByReference,
    cleanupOldFeedItems,
};
