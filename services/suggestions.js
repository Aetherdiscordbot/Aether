/**
 * Suggestions system.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function create(guildId, userId, content, messageId) {
  const { data } = await supabase.from('suggestions').insert({
    guild_id: guildId, user_id: userId, content, message_id: messageId, status: 'pending'
  }).select().single();
  return data;
}

async function get(guildId, id) {
  const { data } = await supabase.from('suggestions').select('*').eq('guild_id', guildId).eq('id', id).single();
  return data;
}

async function list(guildId, status = 'pending', limit = 20) {
  const { data } = await supabase.from('suggestions').select('*').eq('guild_id', guildId).eq('status', status).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

async function vote(guildId, id, userId, up = true) {
  const col = up ? 'votes_up' : 'votes_down';
  await supabase.rpc('increment_suggestion_votes', { p_id: id, p_col: col });
}

async function approve(guildId, id, reviewerId) {
  await supabase.from('suggestions').update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq('guild_id', guildId).eq('id', id);
}

async function deny(guildId, id, reviewerId) {
  await supabase.from('suggestions').update({ status: 'denied', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq('guild_id', guildId).eq('id', id);
}

async function getUserSuggestions(guildId, userId) {
  const { data } = await supabase.from('suggestions').select('*').eq('guild_id', guildId).eq('user_id', userId).order('created_at', { ascending: false });
  return data || [];
}

module.exports = { create, get, list, vote, approve, deny, getUserSuggestions };