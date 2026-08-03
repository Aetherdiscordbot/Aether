/**
 * Prefix service — per-server customizable prefix (default: ?).
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const DEFAULT_PREFIX = '?';

async function getPrefix(guildId) {
  const { data } = await supabase.from('prefix_config').select('prefix').eq('guild_id', guildId).single();
  return data?.prefix || DEFAULT_PREFIX;
}

async function setPrefix(guildId, prefix) {
  if (prefix.length > 5) return { ok: false, error: 'Prefix must be 5 characters or less.' };
  await supabase.from('prefix_config').upsert({ guild_id: guildId, prefix });
  return { ok: true };
}

async function resetPrefix(guildId) {
  await supabase.from('prefix_config').delete().eq('guild_id', guildId);
  return { ok: true };
}

module.exports = { getPrefix, setPrefix, resetPrefix, DEFAULT_PREFIX };