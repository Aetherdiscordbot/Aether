/**
 * Schema migration v10: RPC functions for atomic increments.
 */
module.exports = {
  version: 10,
  name: 'rpc-functions',
  up: `
    -- Economy increment
    CREATE OR REPLACE FUNCTION increment_economy(p_guild_id TEXT, p_user_id TEXT, p_col TEXT, p_val BIGINT)
    RETURNS VOID LANGUAGE plpgsql AS $$
    BEGIN
      EXECUTE format('
        INSERT INTO economy (guild_id, user_id, %I)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, user_id) DO UPDATE SET
          %I = economy.%I + $3
      ', p_col, p_col, p_col)
      USING p_guild_id, p_user_id, p_val;
    END;
    $$;

    -- AI usage increment
    CREATE OR REPLACE FUNCTION increment_ai_usage(p_guild_id TEXT, p_day DATE, p_col TEXT, p_tokens BIGINT)
    RETURNS VOID LANGUAGE plpgsql AS $$
    BEGIN
      EXECUTE format('
        INSERT INTO ai_usage (guild_id, day, %I, tokens)
        VALUES ($1, $2, 1, $3)
        ON CONFLICT (guild_id, day) DO UPDATE SET
          %I = ai_usage.%I + 1,
          tokens = ai_usage.tokens + $3
      ', p_col, p_col)
      USING p_guild_id, p_day, p_tokens;
    END;
    $$;

    -- Suggestion votes
    CREATE OR REPLACE FUNCTION increment_suggestion_votes(p_id BIGINT, p_col TEXT)
    RETURNS VOID LANGUAGE plpgsql AS $$
    BEGIN
      EXECUTE format('
        UPDATE suggestions SET %I = %I + 1 WHERE id = $1
      ', p_col, p_col)
      USING p_id;
    END;
    $$;

    -- Custom command uses
    CREATE OR REPLACE FUNCTION increment_custom_cmd(p_guild_id TEXT, p_name TEXT)
    RETURNS VOID LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE custom_commands SET uses = uses + 1 WHERE guild_id = $1 AND name = $2;
    END;
    $$ LANGUAGE sql;
  `
};