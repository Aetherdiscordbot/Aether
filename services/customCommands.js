/**
 * Custom commands service (premium: unlimited, free: 5 per server).
 */
const { createClient } = require('@supabase/supabase-js');
const premiumService = require('./premium');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const FREE_LIMIT = 5;

async function getCount(guildId) {
  const { count } = await supabase.from('custom_commands').select('*', { count: 'exact', head: true }).eq('guild_id', guildId);
  return count || 0;
}

async function canCreate(guildId) {
  const prem = await premiumService.isPremium(guildId);
  if (prem) return { ok: true };
  const count = await getCount(guildId);
  return { ok: count < FREE_LIMIT, limit: FREE_LIMIT, current: count };
}

async function create(guildId, name, content, embed, creatorId) {
  const check = await canCreate(guildId);
  if (!check.ok) return { ok: false, error: `Free servers limited to ${check.limit} custom commands (${check.current}/${check.limit}).` };
  
  const { data } = await supabase.from('custom_commands').insert({
    guild_id: guildId, name: name.toLowerCase(), content, embed, creator_id: creatorId
  }).select().single();
  return { ok: true, data };
}

async function get(guildId, name) {
  const { data } = await supabase.from('custom_commands').select('*').eq('guild_id', guildId).eq('name', name.toLowerCase()).single();
  return data;
}

async function list(guildId) {
  const { data } = await supabase.from('custom_commands').select('*').eq('guild_id', guildId).order('created_at', { ascending: false });
  return data || [];
}

async function deleteCmd(guildId, name) {
  const { data } = await supabase.from('custom_commands').delete().eq('guild_id', guildId).eq('name', name.toLowerCase()).select().single();
  return data;
}

async function incrementUse(guildId, name) {
  await supabase.rpc('increment_custom_cmd', { p_guild_id: guildId, p_name: name.toLowerCase() });
}

module.exports = { create, get, list, delete: deleteCmd, incrementUse, canCreate };