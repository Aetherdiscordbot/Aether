/**
 * Schema migration v7: Economy, XP, Logging.
 */
module.exports = {
  version: 7,
  name: 'economy-xp-logging',
  up: `
    -- Economy
    CREATE TABLE IF NOT EXISTS economy (
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      balance       BIGINT NOT NULL DEFAULT 0,
      bank          BIGINT NOT NULL DEFAULT 0,
      last_daily    TIMESTAMPTZ,
      last_work     TIMESTAMPTZ,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_econ_guild ON economy (guild_id);

    -- XP (text + voice)
    CREATE TABLE IF NOT EXISTS xp (
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      text_xp       BIGINT NOT NULL DEFAULT 0,
      voice_xp      BIGINT NOT NULL DEFAULT 0,
      text_level    INTEGER NOT NULL DEFAULT 0,
      voice_level   INTEGER NOT NULL DEFAULT 0,
      total_xp      BIGINT NOT NULL DEFAULT 0,
      last_text_msg TIMESTAMPTZ,
      last_voice    TIMESTAMPTZ,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_xp_text ON xp (guild_id, text_xp DESC);
    CREATE INDEX IF NOT EXISTS idx_xp_voice ON xp (guild_id, voice_xp DESC);

    -- Logging config (free + premium)
    CREATE TABLE IF NOT EXISTS logging_config (
      guild_id      TEXT PRIMARY KEY,
      enabled       BOOLEAN NOT NULL DEFAULT FALSE,
      channels      JSONB NOT NULL DEFAULT '{}',
      premium_only  BOOLEAN NOT NULL DEFAULT FALSE,
      ignored_channels TEXT[] NOT NULL DEFAULT '{}',
      ignored_roles TEXT[] NOT NULL DEFAULT '{}'
    );

    -- Shop items
    CREATE TABLE IF NOT EXISTS shop_items (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      price         BIGINT NOT NULL,
      role_id       TEXT,
      type          TEXT NOT NULL DEFAULT 'role',
      stock         INTEGER DEFAULT -1,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shop_guild ON shop_items (guild_id);
  `
};