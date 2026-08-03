/**
 * XP service — text and voice XP with leaderboards.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const XP_PER_MESSAGE = 15;
const XP_PER_VOICE_MINUTE = 10;
const COOLDOWN_MS = 60000;

async function addTextXP(guildId, userId) {
  const { data } = await supabase.from('xp').select('*').eq('guild_id', guildId).eq('user_id', userId).single();
  const now = Date.now();
  if (data?.last_text_msg && now - new Date(data.last_text_msg).getTime() < COOLDOWN_MS) return;
  
  const newXP = (data?.text_xp || 0) + XP_PER_MESSAGE;
  const newLevel = Math.floor(Math.sqrt(newXP / 100));
  await supabase.from('xp').upsert({
    guild_id: guildId,
    user_id: userId,
    text_xp: newXP,
    text_level: newLevel,
    total_xp: (data?.total_xp || 0) + XP_PER_MESSAGE,
    last_text_msg: new Date().toISOString(),
  });
  return { xp: newXP, level: newLevel, leveledUp: newLevel > (data?.text_level || 0) };
}

async function addVoiceXP(guildId, userId, minutes) {
  const xpGain = minutes * XP_PER_VOICE_MINUTE;
  const { data } = await supabase.from('xp').select('*').eq('guild_id', guildId).eq('user_id', userId).single();
  
  const newXP = (data?.voice_xp || 0) + xpGain;
  const newLevel = Math.floor(Math.sqrt(newXP / 100));
  await supabase.from('xp').upsert({
    guild_id: guildId,
    user_id: userId,
    voice_xp: newXP,
    voice_level: newLevel,
    total_xp: (data?.total_xp || 0) + xpGain,
    last_voice: new Date().toISOString(),
  });
  return { xp: newXP, level: newLevel };
}

async function getXP(guildId, userId) {
  const { data } = await supabase.from('xp').select('*').eq('guild_id', guildId).eq('user_id', userId).single();
  return data || { text_xp: 0, voice_xp: 0, text_level: 0, voice_level: 0, total_xp: 0 };
}

async function leaderboard(guildId, type = 'total', limit = 10) {
  const col = type === 'text' ? 'text_xp' : type === 'voice' ? 'voice_xp' : 'total_xp';
  const { data } = await supabase
    .from('xp')
    .select('user_id, text_xp, voice_xp, text_level, voice_level, total_xp')
    .eq('guild_id', guildId)
    .order(col, { ascending: false })
    .limit(limit);
  return data || [];
}

module.exports = { addTextXP, addVoiceXP, getXP, leaderboard };