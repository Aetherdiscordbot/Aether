/**
 * AFK service.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function setAFK(guildId, userId, reason = 'AFK') {
  await supabase.from('afk').upsert({ guild_id: guildId, user_id: userId, reason, since: new Date().toISOString() });
}

async function removeAFK(guildId, userId) {
  const { data } = await supabase.from('afk').select('reason, since').eq('guild_id', guildId).eq('user_id', userId).single();
  await supabase.from('afk').delete().eq('guild_id', guildId).eq('user_id', userId);
  return data;
}

async function getAFK(guildId, userId) {
  const { data } = await supabase.from('afk').select('*').eq('guild_id', guildId).eq('user_id', userId).single();
  return data;
}

async function getAllAFK(guildId) {
  const { data } = await supabase.from('afk').select('*').eq('guild_id', guildId);
  return data || [];
}

module.exports = { setAFK, removeAFK, getAFK, getAllAFK };