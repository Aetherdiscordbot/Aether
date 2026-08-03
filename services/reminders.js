/**
 * Reminders service.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function create(guildId, userId, channelId, content, remindAt) {
  const { data } = await supabase.from('reminders').insert({
    guild_id: guildId, user_id: userId, channel_id: channelId, content, remind_at: remindAt
  }).select().single();
  return data;
}

async function getUserReminders(guildId, userId) {
  const { data } = await supabase.from('reminders').select('*').eq('guild_id', guildId).eq('user_id', userId).eq('sent', false).order('remind_at');
  return data || [];
}

async function getDue() {
  const now = new Date().toISOString();
  const { data } = await supabase.from('reminders').select('*').eq('sent', false).lte('remind_at', now);
  return data || [];
}

async function markSent(id) {
  await supabase.from('reminders').update({ sent: true }).eq('id', id);
}

async function cancel(id, userId) {
  const { data } = await supabase.from('reminders').delete().eq('id', id).eq('user_id', userId).select().single();
  return data;
}

module.exports = { create, getUserReminders, getDue, markSent, cancel };