/**
 * Schema migration v6: Ticket AI helper config.
 */
module.exports = {
  version: 6,
  name: 'ticket-ai-helper',
  up: `
    CREATE TABLE IF NOT EXISTS ticket_config (
      guild_id              TEXT PRIMARY KEY,
      category_id           TEXT NOT NULL,
      staff_roles           TEXT[] NOT NULL DEFAULT '{}',
      panel_channel_id      TEXT,
      log_channel_id        TEXT,
      transcript_channel_id TEXT,
      categories            JSONB NOT NULL DEFAULT '[
        {"name": "General", "emoji": "💬"},
        {"name": "Billing", "emoji": "💳"},
        {"name": "Report", "emoji": "🚩"}
      ]'
    );

    CREATE TABLE IF NOT EXISTS ticket_ai_config (
      guild_id      TEXT PRIMARY KEY,
      enabled       BOOLEAN NOT NULL DEFAULT FALSE,
      system_prompt TEXT NOT NULL DEFAULT 'You are a helpful support assistant. Answer questions based on the conversation. Be concise and professional.',
      model         TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
      auto_reply    BOOLEAN NOT NULL DEFAULT FALSE,
      staff_only    BOOLEAN NOT NULL DEFAULT TRUE
    );
  `
};