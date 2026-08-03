/**
 * Economy service — balance, bank, daily, work, shop, transfers.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const logger = require('./logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getBalance(guildId, userId) {
  const { data } = await supabase.from('economy').select('balance, bank').eq('guild_id', guildId).eq('user_id', userId).single();
  return data || { balance: 0, bank: 0 };
}

async function addMoney(guildId, userId, amount, toBank = false) {
  const col = toBank ? 'bank' : 'balance';
  await supabase.from('economy').upsert({
    guild_id: guildId,
    user_id: userId,
    [col]: amount,
    balance: toBank ? 0 : amount,
    bank: toBank ? amount : 0,
  }, { onConflict: 'guild_id,user_id', ignoreDuplicates: false });
  // Use RPC for atomic increment
  await supabase.rpc('increment_economy', { p_guild_id: guildId, p_user_id: userId, p_col: col, p_val: amount });
}

async function removeMoney(guildId, userId, amount, fromBank = false) {
  const col = fromBank ? 'bank' : 'balance';
  const { data: current } = await supabase.from('economy').select(col).eq('guild_id', guildId).eq('user_id', userId).single();
  if (!current || current[col] < amount) return false;
  await supabase.rpc('increment_economy', { p_guild_id: guildId, p_user_id: userId, p_col: col, p_val: -amount });
  return true;
}

async function transfer(guildId, fromId, toId, amount) {
  const ok = await removeMoney(guildId, fromId, amount);
  if (!ok) return false;
  await addMoney(guildId, toId, amount);
  return true;
}

async function deposit(guildId, userId, amount) {
  const { data } = await supabase.from('economy').select('balance').eq('guild_id', guildId).eq('user_id', userId).single();
  if (!data || data.balance < amount) return false;
  await supabase.rpc('increment_economy', { p_guild_id: guildId, p_user_id: userId, p_col: 'balance', p_val: -amount });
  await supabase.rpc('increment_economy', { p_guild_id: guildId, p_user_id: userId, p_col: 'bank', p_val: amount });
  return true;
}

async function withdraw(guildId, userId, amount) {
  const { data } = await supabase.from('economy').select('bank').eq('guild_id', guildId).eq('user_id', userId).single();
  if (!data || data.bank < amount) return false;
  await supabase.rpc('increment_economy', { p_guild_id: guildId, p_user_id: userId, p_col: 'bank', p_val: -amount });
  await supabase.rpc('increment_economy', { p_guild_id: guildId, p_user_id: userId, p_col: 'balance', p_val: amount });
  return true;
}

async function daily(guildId, userId, amount = 500) {
  const { data } = await supabase.from('economy').select('last_daily').eq('guild_id', guildId).eq('user_id', userId).single();
  if (data?.last_daily) {
    const last = new Date(data.last_daily);
    const now = new Date();
    if (now - last < 864e5) return { ok: false, remaining: 864e5 - (now - last) };
  }
  await addMoney(guildId, userId, amount);
  await supabase.from('economy').update({ last_daily: new Date().toISOString() }).eq('guild_id', guildId).eq('user_id', userId);
  return { ok: true, amount };
}

async function work(guildId, userId, amount = 200) {
  const { data } = await supabase.from('economy').select('last_work').eq('guild_id', guildId).eq('user_id', userId).single();
  if (data?.last_work) {
    const last = new Date(data.last_work);
    const now = new Date();
    if (now - last < 3600e3) return { ok: false, remaining: 3600e3 - (now - last) };
  }
  await addMoney(guildId, userId, amount);
  await supabase.from('economy').update({ last_work: new Date().toISOString() }).eq('guild_id', guildId).eq('user_id', userId);
  return { ok: true, amount };
}

async function leaderboard(guildId, limit = 10, type = 'balance') {
  const col = type === 'bank' ? 'bank' : 'balance';
  const { data } = await supabase
    .from('economy')
    .select('user_id, balance, bank')
    .eq('guild_id', guildId)
    .order(col, { ascending: false })
    .limit(limit);
  return data || [];
}

module.exports = { getBalance, addMoney, removeMoney, transfer, deposit, withdraw, daily, work, leaderboard };