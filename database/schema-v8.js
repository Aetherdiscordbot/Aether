/**
 * Schema migration v8: AFK, Counting, Suggestions, Reminders, Starboard, Skullboard, Giveaways, AutoMod, Custom Commands.
 */
module.exports = {
  version: 8,
  name: 'features-pack',
  up: `
    -- AFK system
    CREATE TABLE IF NOT EXISTS afk (
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      reason        TEXT,
      since         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );

    -- Counting game
    CREATE TABLE IF NOT EXISTS counting (
      guild_id      TEXT PRIMARY KEY,
      channel_id    TEXT NOT NULL,
      current_count INTEGER NOT NULL DEFAULT 0,
      last_user_id  TEXT,
      record        INTEGER NOT NULL DEFAULT 0
    );

    -- Suggestions system
    CREATE TABLE IF NOT EXISTS suggestions (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      content       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      message_id    TEXT,
      votes_up      INTEGER NOT NULL DEFAULT 0,
      votes_down    INTEGER NOT NULL DEFAULT 0,
      reviewed_by   TEXT,
      reviewed_at   TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sug_guild ON suggestions (guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_sug_user ON suggestions (user_id);

    -- Reminders
    CREATE TABLE IF NOT EXISTS reminders (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      content       TEXT NOT NULL,
      remind_at     TIMESTAMPTZ NOT NULL,
      sent          BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rem_pending ON reminders (sent, remind_at);

    -- Starboard
    CREATE TABLE IF NOT EXISTS starboard (
      guild_id      TEXT PRIMARY KEY,
      channel_id    TEXT NOT NULL,
      threshold     INTEGER NOT NULL DEFAULT 5,
      emoji         TEXT NOT NULL DEFAULT '⭐',
      ignored_channels TEXT[] NOT NULL DEFAULT '{}'
    );

    -- Skullboard (like starboard but for 💀)
    CREATE TABLE IF NOT EXISTS skullboard (
      guild_id      TEXT PRIMARY KEY,
      channel_id    TEXT NOT NULL,
      threshold     INTEGER NOT NULL DEFAULT 3,
      emoji         TEXT NOT NULL DEFAULT '💀',
      ignored_channels TEXT[] NOT NULL DEFAULT '{}'
    );

    -- Starboard/Skullboard tracked messages
    CREATE TABLE IF NOT EXISTS board_messages (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      type          TEXT NOT NULL, -- 'star' or 'skull'
      message_id    TEXT NOT NULL,
      board_message_id TEXT,
      count         INTEGER NOT NULL DEFAULT 0,
      UNIQUE (guild_id, type, message_id)
    );

    -- Giveaways
    CREATE TABLE IF NOT EXISTS giveaways (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      message_id    TEXT NOT NULL UNIQUE,
      prize         TEXT NOT NULL,
      winners       INTEGER NOT NULL DEFAULT 1,
      ends_at       TIMESTAMPTZ NOT NULL,
      ended         BOOLEAN NOT NULL DEFAULT FALSE,
      host_id       TEXT NOT NULL,
      requirements  JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_give_pending ON giveaways (ended, ends_at);

    -- Advanced AutoMod
    CREATE TABLE IF NOT EXISTS automod_config (
      guild_id      TEXT PRIMARY KEY,
      config        JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "words": {"enabled": true, "list": [], "action": "delete"},
        "links": {"enabled": true, "allow_discord": true, "action": "delete"},
        "invites": {"enabled": true, "action": "delete"},
        "spam": {"enabled": true, "max_messages": 5, "interval": 5000, "action": "timeout"},
        "caps": {"enabled": true, "min_length": 10, "max_percent": 70, "action": "delete"},
        "mentions": {"enabled": true, "max": 5, "action": "delete"},
        "emojis": {"enabled": true, "max": 10, "action": "delete"},
        "new_accounts": {"enabled": false, "min_age_days": 7, "action": "kick"},
        "banned_words": {"enabled": true, "list": [], "action": "timeout"},
        "regex": {"enabled": false, "patterns": [], "action": "delete"},
        "log_channel": null
      }'
    );

    -- Custom commands (premium: unlimited, free: 5)
    CREATE TABLE IF NOT EXISTS custom_commands (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      name          TEXT NOT NULL,
      content       TEXT NOT NULL,
      embed         JSONB,
      creator_id    TEXT NOT NULL,
      uses          BIGINT NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (guild_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_cc_guild ON custom_commands (guild_id);

    -- Embed templates for premium
    CREATE TABLE IF NOT EXISTS embed_templates (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      name          TEXT NOT NULL,
      template      JSONB NOT NULL,
      creator_id    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (guild_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_et_guild ON embed_templates (guild_id);
  `
};