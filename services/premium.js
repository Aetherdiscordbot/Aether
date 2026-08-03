/**
 * Premium service — Whop-backed premium with simple command gating.
 * Add `premium: true` to any command module to make it premium-only.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const logger = require('./logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const WHOP_API = 'https://api.whop.com';
const WHOP_HEADERS = {
  'Authorization': `Bearer ${config.whop.apiKey}`,
  'Content-Type': 'application/json',
};

async function whopRequest(path, opts = {}) {
  const res = await fetch(`${WHOP_API}${path}`, { ...opts, headers: WHOP_HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whop ${res.status}: ${text}`);
  }
  return res.json();
}

/** Check if a guild has active premium. */
async function isPremium(guildId) {
  // Main server is always premium (owner)
  if (guildId === config.mainGuildId) return true;

  const { data } = await supabase
    .from('premium_servers')
    .select('status, expires_at')
    .eq('guild_id', guildId)
    .single();
  if (!data) return false;
  if (data.status !== 'active') return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await supabase.from('premium_servers').update({ status: 'expired' }).eq('guild_id', guildId);
    return false;
  }
  return true;
}

/** Grant premium role in main server to a user. */
async function grantMainServerRole(userId) {
  try {
    const client = require('../bot/bot').client;
    const mainGuildId = config.mainGuildId;
    if (!mainGuildId) return;
    
    const mainGuild = client.guilds.cache.get(mainGuildId);
    if (!mainGuild) return;
    
    const premiumRoleId = '1533210783926849548';
    const premiumRole = mainGuild.roles.cache.get(premiumRoleId);
    if (!premiumRole) return;
    
    const member = await mainGuild.members.fetch(userId).catch(() => null);
    if (member && !member.roles.cache.has(premiumRoleId)) {
      await member.roles.add(premiumRoleId, 'Aether Premium subscription');
      logger.info(`Granted Aether Premium role to ${userId} in main server`);
    }
  } catch (e) {
    logger.error(`Failed to grant main server premium role: ${e.message}`);
  }
}

/** Remove premium role in main server from a user. */
async function removeMainServerRole(userId) {
  try {
    const client = require('../bot/bot').client;
    const mainGuildId = config.mainGuildId;
    if (!mainGuildId) return;
    
    const mainGuild = client.guilds.cache.get(mainGuildId);
    if (!mainGuild) return;
    
    const premiumRoleId = '1533210783926849548';
    const premiumRole = mainGuild.roles.cache.get(premiumRoleId);
    if (!premiumRole) return;
    
    const member = await mainGuild.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.has(premiumRoleId)) {
      await member.roles.remove(premiumRoleId, 'Aether Premium subscription expired/cancelled');
      logger.info(`Removed Aether Premium role from ${userId} in main server`);
    }
  } catch (e) {
    logger.error(`Failed to remove main server premium role: ${e.message}`);
  }
}

/** Grant premium to a guild (called by Whop webhook). */
async function grantPremium(guildId, plan = 'premium', expiresAt = null) {
  await supabase.from('premium_servers').upsert({
    guild_id: guildId,
    plan,
    status: 'active',
    activated_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
  logger.info(`Premium granted to ${guildId} (${plan})`);
}

/** Revoke premium from a guild. */
async function revokePremium(guildId) {
  await supabase.from('premium_servers').update({ status: 'revoked' }).eq('guild_id', guildId);
  logger.info(`Premium revoked from ${guildId}`);
}

/** Process a Whop webhook event. */
async function handleWebhookEvent(event) {
  if (event.type === 'membership.created' || event.type === 'membership.renewed') {
    const membership = event.data;
    const guildId = membership.metadata?.discord_guild_id || membership.custom_fields?.discord_server_id;
    const userId = membership.user_id;
    if (!guildId) return;

    const plan = membership.plan_id || 'premium';
    const expiresAt = membership.ends_at ? new Date(membership.ends_at).toISOString() : null;

    await grantPremium(guildId, plan, expiresAt);
    await grantMainServerRole(userId);
    await supabase.from('premium_memberships').upsert({
      user_id: userId,
      guild_id: guildId,
      status: 'active',
      whop_user_id: membership.user_id,
      whop_membership_id: membership.id,
      expires_at: expiresAt,
    });
  } else if (event.type === 'membership.cancelled' || event.type === 'membership.expired') {
    const membership = event.data;
    const guildId = membership.metadata?.discord_guild_id || membership.custom_fields?.discord_server_id;
    const userId = membership.user_id;
    if (guildId) await revokePremium(guildId);
    if (userId) await removeMainServerRole(userId);
  }
}

module.exports = { isPremium, grantPremium, revokePremium, handleWebhookEvent, grantMainServerRole, removeMainServerRole };