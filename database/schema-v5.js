/**
 * Schema migration v5: FiveM bridge.
 * Tables for FiveM server connection, command queue, player snapshots,
 * Discord verify codes, and license-Discord links.
 */
module.exports = {
  version: 5,
  name: 'fivem-bridge',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_config (
        guild_id        TEXT PRIMARY KEY,
        secret          TEXT NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 0,
        framework       TEXT NOT NULL DEFAULT 'none',
        poll_interval   INTEGER NOT NULL DEFAULT 5,
        verified_role   TEXT,
        announce_channel TEXT,
        player_feed_channel TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_commands (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        type        TEXT NOT NULL,
        args        TEXT NOT NULL DEFAULT '{}',
        from_id     TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TEXT NOT NULL,
        acked_at    TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_fc_pending ON fivem_commands (guild_id, status, created_at);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_players (
        guild_id     TEXT NOT NULL,
        player_id    INTEGER NOT NULL,
        name         TEXT NOT NULL,
        ping         INTEGER NOT NULL,
        connected    INTEGER NOT NULL,
        license      TEXT,
        discord      TEXT,
        last_seen    TEXT NOT NULL,
        PRIMARY KEY (guild_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_fp_guild ON fivem_players (guild_id);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_verify (
        code         TEXT PRIMARY KEY,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        expires_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fv_guild ON fivem_verify (guild_id);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_links (
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        license      TEXT NOT NULL,
        player_name  TEXT NOT NULL,
        linked_at    TEXT NOT NULL,
        PRIMARY KEY (guild_id, license)
      );
    `);
  },
};