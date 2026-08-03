/**
 * Counting game service.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getConfig(guildId) {
  const { data } = await supabase.from('counting').select('*').eq('guild_id', guildId).single();
  return data;
}

async function setConfig(guildId, channelId) {
  await supabase.from('counting').upsert({ guild_id: guildId, channel_id: channelId, current_count: 0, last_user_id: null, record: 0 });
}

async function handleCount(guildId, userId, number) {
  const cfg = await getConfig(guildId);
  if (!cfg) return { valid: false, reason: 'Not configured' };

  if (cfg.last_user_id === userId) return { valid: false, reason: 'You cannot count twice in a row!' };

  if (number !== cfg.current_count + 1) {
    await supabase.from('counting').update({ current_count: 0, last_user_id: null }).eq('guild_id', guildId);
    return { valid: false, reason: `Wrong number! Expected ${cfg.current_count + 1}. Count reset to 0.` };
  }

  const newCount = cfg.current_count + 1;
  const newRecord = newCount > cfg.record ? newCount : cfg.record;
  await supabase.from('counting').update({ current_count: newCount, last_user_id: userId, record: newRecord }).eq('guild_id', guildId);
  return { valid: true, count: newCount, record: newRecord };
}

module.exports = { getConfig, setConfig, handleCount };