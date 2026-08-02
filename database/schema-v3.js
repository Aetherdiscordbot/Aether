/**
 * Schema migration v3: reputation system.
 */
module.exports = {
  version: 3,
  name: 'reputation',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reputation (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        from_id    TEXT NOT NULL,
        to_id      TEXT NOT NULL,
        reason     TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rep_to ON reputation (guild_id, to_id);
      CREATE INDEX IF NOT EXISTS idx_rep_from ON reputation (guild_id, from_id);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS auto_responses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        trigger     TEXT NOT NULL,
        response    TEXT NOT NULL,
        match_type  TEXT NOT NULL DEFAULT 'exact',
        cooldown    INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        UNIQUE (guild_id, trigger)
      );
      CREATE INDEX IF NOT EXISTS idx_ar_guild ON auto_responses (guild_id);
    `);
  },
};
