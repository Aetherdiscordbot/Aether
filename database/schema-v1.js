/**
 * Schema migration v1: Core tables.
 */
module.exports = {
  version: 1,
  name: 'core',
  up: `
    CREATE TABLE IF NOT EXISTS premium_servers (
      guild_id      TEXT PRIMARY KEY,
      plan          TEXT NOT NULL DEFAULT 'premium',
      status        TEXT NOT NULL DEFAULT 'active',
      activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at    TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS premium_memberships (
      id            BIGSERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active',
      whop_user_id  TEXT,
      whop_membership_id TEXT,
      activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at    TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_pm_guild ON premium_memberships (guild_id);
    CREATE INDEX IF NOT EXISTS idx_pm_user ON premium_memberships (user_id);

    CREATE TABLE IF NOT EXISTS settings (
      guild_id      TEXT NOT NULL,
      key           TEXT NOT NULL,
      value         JSONB NOT NULL DEFAULT '{}',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, key)
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
};