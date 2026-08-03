/**
 * Giveaways service.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function create(guildId, channelId, prize, winners, endsAt, hostId, requirements = {}) {
  const { data } = await supabase.from('giveaways').insert({
    guild_id: guildId, channel_id: channelId, prize, winners, ends_at: endsAt, host_id: hostId, requirements
  }).select().single();
  return data;
}

async function get(guildId, id) {
  const { data } = await supabase.from('giveaways').select('*').eq('guild_id', guildId).eq('id', id).single();
  return data;
}

async function getByMessage(guildId, messageId) {
  const { data } = await supabase.from('giveaways').select('*').eq('guild_id', guildId).eq('message_id', messageId).single();
  return data;
}

async function getActive(guildId) {
  const { data } = await supabase.from('giveaways').select('*').eq('guild_id', guildId).eq('ended', false).order('ends_at');
  return data || [];
}

async function end(guildId, id) {
  await supabase.from('giveaways').update({ ended: true }).eq('guild_id', guildId).eq('id', id);
}

async function getDue() {
  const now = new Date().toISOString();
  const { data } = await supabase.from('giveaways').select('*').eq('ended', false).lte('ends_at', now);
  return data || [];
}

module.exports = { create, get, getByMessage, getActive, end, getDue };