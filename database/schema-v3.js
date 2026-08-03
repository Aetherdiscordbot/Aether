/**
 * Schema migration v3: Leveling, reputation, automod, logging.
 */
module.exports = {
  version: 3,
  name: 'leveling-reputation-automod-logging',
  up: `
    CREATE TABLE IF NOT EXISTS xp (
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      xp            BIGINT NOT NULL DEFAULT 0,
      level         INTEGER NOT NULL DEFAULT 0,
      total_xp      BIGINT NOT NULL DEFAULT 0,
      last_message  TIMESTAMPTZ,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_xp_leaderboard ON xp (guild_id, xp DESC);

    CREATE TABLE IF NOT EXISTS reputation (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      from_id       TEXT NOT NULL,
      to_id         TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'pos',
      reason        TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rep_to ON reputation (guild_id, to_id);
    CREATE INDEX IF NOT EXISTS idx_rep_from ON reputation (guild_id, from_id);

    CREATE TABLE IF NOT EXISTS automod_config (
      guild_id      TEXT PRIMARY KEY,
      config        JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "words": [],
        "links": {"enabled": false, "blacklist": [], "whitelist": [], "allowDiscord": true},
        "caps": {"enabled": true, "minLength": 8, "maxPercent": 70, "action": "delete"},
        "mentions": {"enabled": true, "max": 4, "action": "delete"},
        "emojiSpam": {"enabled": true, "maxEmojis": 10, "action": "delete"},
        "attachments": {"enabled": false, "blockedExtensions": [], "blockedSizeMb": 0}
      }'
    );

    CREATE TABLE IF NOT EXISTS logging_config (
      guild_id      TEXT PRIMARY KEY,
      config        JSONB NOT NULL DEFAULT '{"enabled": false, "channels": {}}'
    );
  `
};