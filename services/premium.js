/**
 * Premium fulfillment service.
 *
 * Source of truth for "is a server premium?" and for applying/removing the
 * Aether Premium role. Fulfillment is normally driven by Whop webhooks
 * (fully automatic) and is made resilient by a pending queue that retries
 * until the bot can resolve the guild/member (e.g. bot was not in the server
 * at purchase time).
 *
 * Role grant target: the Aether Premium role (buyer badge) is granted on the
 * bot's MAIN server (config.mainGuildId), regardless of which server the buyer
 * activates Premium on. The buyer's chosen server still receives Premium
 * features. When mainGuildId is empty (dev/test), it falls back to granting on
 * the buyer's chosen server.
 */
const db = require('../database/db');
const config = require('../config/config');
const logger = require('./logger');
const whop = require('./whop');

/** Discord client reference, injected once the bot logs in. */
let client = null;

function setClient(c) {
  client = c;
}

// ── Event mapping (webhook → action) ─────────────────────────────────────
const VALID_EVENTS = new Set([
  'membership.went_valid',
  'membership.went_invalid',
  'membership.activated',
  'membership.deactivated',
]);

const GRANT_EVENTS = new Set(['membership.went_valid', 'membership.activated']);
const REVOKE_EVENTS = new Set(['membership.went_invalid', 'membership.deactivated']);

/**
 * Entry point for a verified webhook event.
 * Fast, never throws to the HTTP layer for recoverable issues.
 */
function handleWebhookEvent(event) {
  if (!VALID_EVENTS.has(event.type)) {
    logger.debug(`Ignoring non-premium webhook event: ${event.type}`);
    return;
  }

  const membership = event.data || event.payload || {};
  const { discordUsername, discordServerId } = whop.extractCheckoutFields(membership);
  const guildId = discordServerId || membership.guild_id || null;
  const plan = whop.getPlanLabel(membership);

  const record = {
    membership_id: membership.id || event.id,
    discord_username: discordUsername,
    guild_id: guildId,
    whop_customer_id: membership.user?.id || null,
    plan,
    status: whop.isActiveStatus(membership.status) ? 'active' : 'inactive',
    data: JSON.stringify(membership),
    activated_at: membership.activated_at || membership.created_at || new Date().toISOString(),
    expires_at: membership.renewal_period_end || null,
  };

  if (GRANT_EVENTS.has(event.type)) {
    grantPremium(record);
  } else if (REVOKE_EVENTS.has(event.type)) {
    revokePremium(record.membership_id, record);
  }
}

/**
 * Upsert the membership row and try to fulfill the grant.
 * If the bot can't reach the guild/member yet, the row stays pending and
 * processPending() retries it later.
 */
function grantPremium(record) {
  upsertMembership({ ...record, status: record.status || 'active' });

  if (!client?.isReady()) return;

  const targetGuildId = config.mainGuildId || record.guild_id;
  const guild = targetGuildId ? client.guilds.cache.get(targetGuildId) : null;
  if (!guild) {
    logger.warn(`Premium grant deferred (bot not in guild ${targetGuildId}) for ${record.membership_id}`);
    return;
  }

  fulfillGrant(record).catch((err) => {
    logger.error(`Premium grant failed for ${record.membership_id}: ${err.message}`);
  });
}

/**
 * Fulfill a grant:
 *  - grant the Aether Premium role (and set the bot nickname) on the MAIN
 *    server as the buyer badge,
 *  - mark the buyer's chosen server as Premium (features).
 */
async function fulfillGrant(record) {
  const chosenServerId = record.guild_id;
  let member = null;

  if (config.mainGuildId) {
    const mainGuild = client.guilds.cache.get(config.mainGuildId);
    if (!mainGuild) throw new Error(`Main guild ${config.mainGuildId} not found`);
    member = await resolveMember(mainGuild, record.discord_user_id, record.discord_username);
    if (!member) throw new Error(`Could not resolve buyer in main guild ${mainGuild.name}`);

    const role = await ensurePremiumRole(mainGuild);
    if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Aether Premium purchase (Whop)');

    // Bot nickname on the main server.
    if (mainGuild.members.me?.manageable) {
      await mainGuild.members.me.setNickname('Aether Premium', 'Aether Premium active').catch(() => {});
    }
  } else {
    // Dev/test fallback: grant on the buyer's chosen server.
    const guild = client.guilds.cache.get(chosenServerId);
    if (!guild) throw new Error(`Guild ${chosenServerId} not found`);
    member = await resolveMember(guild, record.discord_user_id, record.discord_username);
    if (!member) throw new Error(`Could not resolve buyer in guild ${guild.name}`);
    const role = await ensurePremiumRole(guild);
    if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Aether Premium purchase (Whop)');
  }

  if (chosenServerId) {
    setServerPremium({
      guild_id: chosenServerId,
      owner_id: record.whop_customer_id || null,
      whop_customer_id: record.whop_customer_id,
      membership_id: record.membership_id,
      plan: record.plan || 'premium',
      expires_at: record.expires_at,
    });
  }

  markMembershipFulfilled(record.membership_id, member.id);
  const serverGuild = chosenServerId ? client.guilds.cache.get(chosenServerId) : null;
  logger.info(
    `Premium granted: ${member.user.tag} (badge on main server) · ${serverGuild?.name || chosenServerId} now Premium (${record.membership_id})`
  );

  try {
    await member
      .send(
        `**Aether Premium activated!**\n` +
          `Your server **${serverGuild?.name || 'selected server'}** now has Premium. Thank you for supporting Aether.`
      )
      .catch(() => {});
  } catch {
    /* DM disabled - not fatal */
  }
}

/**
 * Remove premium from a server + strip the role from the buyer.
 */
function revokePremium(membershipId, record = {}) {
  const existing = db
    .prepare('SELECT * FROM premium_memberships WHERE membership_id = ?')
    .get(membershipId);
  const guildId = record.guild_id || existing?.guild_id || null;

  upsertMembership({ ...record, membership_id: membershipId, status: record.status || 'inactive' });
  if (guildId) setServerPremium({ guild_id: guildId, status: 'inactive', membership_id: membershipId });

  if (!client?.isReady()) return;

  // Remove the buyer badge from the main server (or the chosen server in dev fallback).
  const targetGuildId = config.mainGuildId || guildId;
  const guild = targetGuildId ? client.guilds.cache.get(targetGuildId) : null;
  if (!guild) return;

  removePremiumRole(guild, existing?.discord_user_id, record.discord_username || existing?.discord_username).catch(
    (err) => logger.error(`Premium revoke failed for ${membershipId}: ${err.message}`)
  );
  logger.info(`Premium revoked for membership ${membershipId}`);
}

async function removePremiumRole(guild, discordUserId, discordUsername) {
  const member = await resolveMember(guild, discordUserId, discordUsername);
  if (!member) return;
  const role = guild.roles.cache.find((r) => r.name === config.premium.roleName);
  if (role && member.roles.cache.has(role.id)) {
    await member.roles.remove(role, 'Aether Premium cancelled (Whop)');
  }
}

/** Retry all pending (unfulfilled) premium grants. Runs on an interval. */
async function processPending() {
  if (!client?.isReady()) return;
  const rows = db
    .prepare(
      `SELECT * FROM premium_memberships
       WHERE status = 'active' AND fulfilled = 0
       ORDER BY updated_at ASC LIMIT 25`
    )
    .all();

  for (const row of rows) {
    try {
      const record = { ...row, data: row.data ? JSON.parse(row.data) : undefined };
      await fulfillGrant({
        membership_id: row.membership_id,
        guild_id: row.guild_id,
        discord_username: row.discord_username,
        discord_user_id: row.discord_user_id,
        plan: row.plan,
        expires_at: row.expires_at,
        whop_customer_id: row.whop_customer_id,
      });
    } catch (err) {
      logger.debug(`Deferred grant ${row.membership_id}: ${err.message}`);
    }
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────
function upsertMembership(r) {
  db.prepare(
    `INSERT INTO premium_memberships
       (membership_id, discord_user_id, discord_username, guild_id, whop_customer_id,
        plan, status, fulfilled, data, activated_at, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(membership_id) DO UPDATE SET
       discord_user_id = excluded.discord_user_id,
       discord_username = excluded.discord_username,
       guild_id = excluded.guild_id,
       whop_customer_id = excluded.whop_customer_id,
       plan = excluded.plan,
       status = excluded.status,
       data = excluded.data,
       activated_at = excluded.activated_at,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`
  ).run(
    r.membership_id,
    r.discord_user_id || null,
    r.discord_username || null,
    r.guild_id || null,
    r.whop_customer_id || null,
    r.plan || 'premium',
    r.status || 'pending',
    r.fulfilled || 0,
    r.data || null,
    r.activated_at || new Date().toISOString(),
    r.expires_at || null,
    new Date().toISOString()
  );
}

function markMembershipFulfilled(membershipId, discordUserId) {
  db.prepare(
    `UPDATE premium_memberships
     SET fulfilled = 1, discord_user_id = COALESCE(?, discord_user_id), updated_at = ?
     WHERE membership_id = ?`
  ).run(discordUserId || null, new Date().toISOString(), membershipId);
}

/**
 * Upsert a server's premium status. `whitelisted` servers never expire.
 */
function setServerPremium({ guild_id, status = 'active', whitelisted = 0, ...rest }) {
  const existing = db.prepare('SELECT * FROM premium_servers WHERE guild_id = ?').get(guild_id);
  const activatedAt = existing?.activated_at || new Date().toISOString();

  db.prepare(
    `INSERT INTO premium_servers
       (guild_id, owner_id, whop_customer_id, membership_id, plan, status, whitelisted, activated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       owner_id = excluded.owner_id,
       whop_customer_id = excluded.whop_customer_id,
       membership_id = excluded.membership_id,
       plan = excluded.plan,
       status = excluded.status,
       whitelisted = excluded.whitelisted,
       activated_at = excluded.activated_at,
       expires_at = excluded.expires_at`
  ).run(
    guild_id,
    rest.owner_id || null,
    rest.whop_customer_id || null,
    rest.membership_id || null,
    rest.plan || 'premium',
    status,
    whitelisted,
    activatedAt,
    rest.expires_at || null
  );
}

/** Admin: mark a server premium without payment (testing/special cases). */
function whitelistServer(guildId, actorId) {
  setServerPremium({ guild_id: guildId, status: 'active', whitelisted: 1, owner_id: actorId });
}

/** Admin: remove premium from a server entirely. */
function removeServerPremium(guildId) {
  db.prepare('DELETE FROM premium_servers WHERE guild_id = ?').run(guildId);
}

/**
 * A server is premium when it has an active row OR is whitelisted.
 */
function isPremium(guildId) {
  const row = db.prepare('SELECT * FROM premium_servers WHERE guild_id = ?').get(guildId);
  if (!row) return false;
  if (row.whitelisted) return row.status === 'active';
  if (row.status !== 'active') return false;
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return false;
  return true;
}

function getPremiumServer(guildId) {
  return db.prepare('SELECT * FROM premium_servers WHERE guild_id = ?').get(guildId) || null;
}

function countPremiumServers() {
  return db.prepare('SELECT COUNT(*) AS n FROM premium_servers WHERE status = ?').get('active').n;
}

function listPremiumServers() {
  return db.prepare('SELECT * FROM premium_servers ORDER BY activated_at DESC').all();
}

// ── Discord helpers ───────────────────────────────────────────────────────
/** Find the Aether Premium role, creating it if needed (gold, below everyone). */
async function ensurePremiumRole(guild) {
  let role = guild.roles.cache.find((r) => r.name === config.premium.roleName);
  if (!role) {
    role = await guild.roles.create({
      name: config.premium.roleName,
      color: config.premium.roleColor,
      hoist: false,
      permissions: [],
      reason: 'Aether Premium role (created automatically)',
    });
  }
  return role;
}

/**
 * Resolve a member by Discord ID first, then by username.
 * Handles legacy "name#1234" and "@handle" input formats.
 */
async function resolveMember(guild, userId, username) {
  if (userId) {
    const byId = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
    if (byId) return byId;
  }
  if (!username) return null;

  const normalized = String(username).replace(/^@/, '').split('#')[0].toLowerCase();
  if (!normalized) return null;

  const cached = guild.members.cache.find((m) => m.user.username.toLowerCase() === normalized);
  if (cached) return cached;

  try {
    const fetched = await guild.members.fetch();
    return fetched.find((m) => m.user.username.toLowerCase() === normalized) || null;
  } catch {
    return null;
  }
}

/** Re-scan pending grants that mention a now-available guild. */
function syncMembershipGrantedFromDiscord(guild) {
  // In main-server mode, the badge is applied on the main guild, so a join
  // elsewhere can't fulfill anything. In dev fallback, only the joined guild
  // can fulfill its own pending rows.
  if (config.mainGuildId && guild.id !== config.mainGuildId) return;

  const scope = config.mainGuildId
    ? "status = 'active' AND fulfilled = 0"
    : "status = 'active' AND fulfilled = 0 AND guild_id = ?";
  const args = config.mainGuildId ? [] : [guild.id];
  const rows = db.prepare(`SELECT * FROM premium_memberships WHERE ${scope}`).all(...args);
  for (const row of rows) {
    fulfillGrant(row).catch(() => {});
  }
}

/**
 * Keep the bot's branding on the main server: nickname "Aether Premium".
 * Runs at startup and whenever the bot joins/returns to the main guild.
 */
async function ensureMainGuildBranding() {
  if (!client?.isReady() || !config.mainGuildId) return;
  const guild = client.guilds.cache.get(config.mainGuildId);
  if (!guild) return;
  if (guild.members.me?.manageable) {
    await guild.members.me.setNickname('Aether Premium', 'Aether branding').catch(() => {});
  }
}

module.exports = {
  setClient,
  handleWebhookEvent,
  grantPremium,
  revokePremium,
  processPending,
  syncMembershipGrantedFromDiscord,
  ensureMainGuildBranding,
  ensurePremiumRole,
  resolveMember,
  isPremium,
  getPremiumServer,
  countPremiumServers,
  listPremiumServers,
  setServerPremium,
  whitelistServer,
  removeServerPremium,
};
