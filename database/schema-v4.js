/**
 * Schema migration v4: premium dashboard foundations.
 * member_events + activity_daily feed the Analytics tab, scheduled_tasks power
 * the Automation tab (timed slowmode releases, scheduled messages), ai_usage
 * feeds the AI Center tab and automation_config holds per-server key/value
 * settings (e.g. AI enable toggle).
 */
module.exports = {
  version: 4,
  name: 'premium-dashboard',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS member_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        event_type TEXT NOT NULL,            -- join | leave | kick | ban | unban
        user_id    TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_me_guild ON member_events (guild_id, created_at DESC);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_daily (
        guild_id TEXT NOT NULL,
        day      TEXT NOT NULL,              -- YYYY-MM-DD
        messages INTEGER NOT NULL DEFAULT 0,
        commands INTEGER NOT NULL DEFAULT 0,
        joins    INTEGER NOT NULL DEFAULT 0,
        leaves   INTEGER NOT NULL DEFAULT 0,
        UNIQUE (guild_id, day)
      );
      CREATE INDEX IF NOT EXISTS idx_ad_guild ON activity_daily (guild_id, day);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        type       TEXT NOT NULL,            -- slowmode_release | scheduled_message
        channel_id TEXT NOT NULL,
        payload    TEXT NOT NULL DEFAULT '{}',
        run_at     TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending', -- pending | done | cancelled | failed
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_st_pending ON scheduled_tasks (status, run_at);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        guild_id TEXT NOT NULL,
        day      TEXT NOT NULL,              -- YYYY-MM-DD
        prompts  INTEGER NOT NULL DEFAULT 0,
        images   INTEGER NOT NULL DEFAULT 0,
        tokens   INTEGER NOT NULL DEFAULT 0,
        UNIQUE (guild_id, day)
      );
      CREATE INDEX IF NOT EXISTS idx_au_guild ON ai_usage (guild_id, day);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS automation_config (
        guild_id TEXT NOT NULL,
        key      TEXT NOT NULL,
        value    TEXT NOT NULL,              -- JSON
        UNIQUE (guild_id, key)
      );
    `);
  },
};
