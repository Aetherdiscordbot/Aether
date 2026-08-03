/**
 * Schema migration v2: Moderation & tickets.
 */
module.exports = {
  version: 2,
  name: 'moderation-tickets',
  up: `
    CREATE TABLE IF NOT EXISTS moderation_cases (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      moderator_id  TEXT NOT NULL,
      type          TEXT NOT NULL,
      reason        TEXT,
      duration      INTERVAL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON moderation_cases (guild_id, user_id);

    CREATE TABLE IF NOT EXISTS warnings (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      moderator_id  TEXT NOT NULL,
      reason        TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guild_id, user_id);

    CREATE TABLE IF NOT EXISTS tickets (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      channel_id    TEXT NOT NULL UNIQUE,
      user_id       TEXT NOT NULL,
      category      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'open',
      claimed_by    TEXT,
      transcript    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at     TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets (guild_id, status);
  `
};