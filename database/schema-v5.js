/**
 * Schema migration v5: AI usage tracking + conversation memory.
 */
module.exports = {
  version: 5,
  name: 'ai-usage-memory',
  up: `
    CREATE TABLE IF NOT EXISTS ai_usage (
      guild_id      TEXT NOT NULL,
      day           DATE NOT NULL,
      prompts       BIGINT NOT NULL DEFAULT 0,
      images        BIGINT NOT NULL DEFAULT 0,
      tokens        BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_au_guild ON ai_usage (guild_id, day);

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id            BIGSERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      messages      JSONB NOT NULL DEFAULT '[]',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ac_guild_user ON ai_conversations (guild_id, user_id);
  `
};