/**
 * Embed templates service (premium only - unlimited).
 */
const { createClient } = require('@supabase/supabase-js');
const premiumService = require('./premium');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function create(guildId, name, template, creatorId) {
  const prem = await premiumService.isPremium(guildId);
  if (!prem) return { ok: false, error: 'Embed templates require Aether Premium.' };
  
  const { data } = await supabase.from('embed_templates').insert({
    guild_id: guildId, name: name.toLowerCase(), template, creator_id: creatorId
  }).select().single();
  return { ok: true, data };
}

async function get(guildId, name) {
  const { data } = await supabase.from('embed_templates').select('*').eq('guild_id', guildId).eq('name', name.toLowerCase()).single();
  return data;
}

async function list(guildId) {
  const { data } = await supabase.from('embed_templates').select('*').eq('guild_id', guildId).order('created_at', { ascending: false });
  return data || [];
}

async function deleteTpl(guildId, name) {
  const { data } = await supabase.from('embed_templates').delete().eq('guild_id', guildId).eq('name', name.toLowerCase()).select().single();
  return data;
}

module.exports = { create, get, list, delete: deleteTpl };