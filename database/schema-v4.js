/**
 * Schema migration v4: Premium dashboard, analytics, automation, AI.
 */
module.exports = {
  version: 4,
  name: 'premium-dashboard',
  up: `
    CREATE TABLE IF NOT EXISTS member_events (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_me_guild ON member_events (guild_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS activity_daily (
      guild_id      TEXT NOT NULL,
      day           DATE NOT NULL,
      messages      BIGINT NOT NULL DEFAULT 0,
      commands      BIGINT NOT NULL DEFAULT 0,
      joins         BIGINT NOT NULL DEFAULT 0,
      leaves        BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_ad_guild ON activity_daily (guild_id, day);

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      type          TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      payload       JSONB NOT NULL DEFAULT '{}',
      run_at        TIMESTAMPTZ NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_by    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_st_pending ON scheduled_tasks (status, run_at);

    CREATE TABLE IF NOT EXISTS ai_usage (
      guild_id      TEXT NOT NULL,
      day           DATE NOT NULL,
      prompts       BIGINT NOT NULL DEFAULT 0,
      images        BIGINT NOT NULL DEFAULT 0,
      tokens        BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_au_guild ON ai_usage (guild_id, day);

    CREATE TABLE IF NOT EXISTS automation_config (
      guild_id      TEXT NOT NULL,
      key           TEXT NOT NULL,
      value         JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (guild_id, key)
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      message_id    TEXT NOT NULL,
      prize         TEXT NOT NULL,
      winners       INTEGER NOT NULL DEFAULT 1,
      ends_at       TIMESTAMPTZ NOT NULL,
      ended         BOOLEAN NOT NULL DEFAULT FALSE,
      created_by    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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
    CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders (sent, remind_at);
  `
};