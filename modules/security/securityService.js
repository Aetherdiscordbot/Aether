/**
 * Security service: anti-raid, anti-spam, anti-mention/invite/webhook abuse,
 * account-age screening and join protection.
 * Configuration under the `security` settings key.
 */
const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const settings = require('../../services/settings');
const logger = require('../../services/logger');
const logService = require('../../services/logService');
const { baseEmbed, Colors } = require('../../utils/discord');

const DEFAULT_CONFIG = {
  enabled: true,
  antiRaid: { enabled: true, maxJoinsPerMin: 5, action: 'lock' }, // lock | kick | off
  antiSpam: { enabled: true, maxMessages: 6, withinSec: 5, action: 'timeout', timeoutDuration: '10m' },
  antiMentionSpam: { enabled: true, maxMentions: 5, action: 'timeout', timeoutDuration: '10m' },
  antiInviteSpam: { enabled: true, action: 'delete', whitelist: [] }, // whitelist: invite codes / server ids
  antiWebhook: { enabled: true, action: 'delete' },
  minAccountAgeDays: 0, // 0 = disabled; else kick/ban accounts younger than this
  accountAgeAction: 'kick',
  joinLock: { active: false, lockedAt: null, until: null },
  whitelistedUsers: [],
  whitelistedRoles: [],
  logViolations: true,
};

const joinLog = new Map(); // guildId -> [{ time }]

function getConfig(guildId) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), settings.getSetting(guildId, 'security', {}));
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'security', { ...getConfig(guildId), ...partial });
}

function deepMerge(base, extra) {
  for (const key of Object.keys(extra || {})) {
    if (extra[key] && typeof extra[key] === 'object' && !Array.isArray(extra[key]) && base[key] && typeof base[key] === 'object') {
      deepMerge(base[key], extra[key]);
    } else {
      base[key] = extra[key];
    }
  }
  return base;
}

function isWhitelisted(member) {
  const cfg = getConfig(member.guild.id);
  if (cfg.whitelistedUsers.includes(member.id)) return true;
  return cfg.whitelistedRoles.some((r) => member.roles.cache.has(r));
}

async function alert(guild, title, description, color = Colors.error) {
  if (guild.members?.me?.id === guild.id) return;
  await logService.sendLog(guild, 'security', baseEmbed({ color, title, description }));
}

/** Joined-member screening: account age + anti-raid window + join lock. */
async function checkMemberJoin(member) {
  const cfg = getConfig(member.guild.id);
  if (!cfg.enabled || member.user.bot && cfg.whitelistedUsers.includes(member.id)) return;
  if (isWhitelisted(member)) return;
  if (cfg.whitelistedUsers.includes(member.id)) return;

  // Join lock active?
  if (cfg.joinLock.active && cfg.joinLock.until && Date.now() < Date.parse(cfg.joinLock.until)) {
    try {
      await member.kick('Aether: server join-locked (anti-raid)');
      await alert(member.guild, '🚫 Join Blocked', `${member.user} was removed while the server is join-locked.`);
    } catch { /* ignore */ }
    return;
  }

  // Account age check.
  const minAgeDays = Number(cfg.minAccountAgeDays);
  if (minAgeDays > 0) {
    const ageMs = Date.now() - member.user.createdTimestamp;
    if (ageMs < minAgeDays * 24 * 60 * 60 * 1000) {
      const action = cfg.accountAgeAction || 'kick';
      try {
        if (action === 'ban') await member.ban({ reason: 'Aether: account too new' });
        else await member.kick('Aether: account too new');
        await alert(
          member.guild,
          '🛡️ Account Age Violation',
          `${member.user} joined with an account younger than ${minAgeDays} days and was **${action === 'ban' ? 'banned' : 'kicked'}**.`
        );
      } catch { /* ignore */ }
      return;
    }
  }

  // Anti-raid join-rate check.
  if (cfg.antiRaid.enabled) {
    const now = Date.now();
    const log = (joinLog.get(member.guild.id) || []).filter((t) => now - t < 60_000);
    log.push(now);
    joinLog.set(member.guild.id, log);

    if (log.length > cfg.antiRaid.maxJoinsPerMin) {
      await triggerRaidProtection(member);
    }
  }
}

/** Lock the server from new joins (or kick the burst member). */
async function triggerRaidProtection(member) {
  const cfg = getConfig(member.guild.id);
  try {
    if (cfg.antiRaid.action === 'kick') {
      await member.kick('Aether: raid protection');
    }
  } catch { /* ignore */ }

  // Lock invites for 10 minutes.
  const until = new Date(Date.now() + 10 * 60 * 1000);
  setConfig(member.guild.id, { joinLock: { active: true, lockedAt: new Date().toISOString(), until: until.toISOString() } });

  try {
    for (const invite of member.guild.invites.cache.values()) {
      await invite.delete('Aether: raid protection').catch(() => {});
    }
  } catch { /* ignore */ }

  await alert(
    member.guild,
    '🚨 **Raid Detected**',
    `More than ${cfg.antiRaid.maxJoinsPerMin} members joined within a minute. Invites have been deleted and joins are locked for 10 minutes. Use \`/security unlock\` to restore access.`,
    Colors.error
  );
  logger.warn(`Raid protection triggered in guild ${member.guild.id}`);
}

/** Message-based checks (spam / mentions / invites / links). */
async function checkMessage(message) {
  if (!message.guild || message.author.bot) return;
  const cfg = getConfig(message.guild.id);
  if (!cfg.enabled) return;
  if (cfg.whitelistedUsers.includes(message.author.id)) return;

  // Spam detection.
  if (cfg.antiSpam.enabled) {
    const key = `spam:${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const history = (recentMessages.get(key) || []).filter((t) => now - t < cfg.antiSpam.withinSec * 1000);
    history.push(now);
    recentMessages.set(key, history);
    if (history.length > cfg.antiSpam.maxMessages) {
      await applyMessageAction(message, 'anti-spam', cfg.antiSpam);
      return;
    }
  }

  // Mention spam.
  if (cfg.antiMentionSpam.enabled && message.mentions.users.size > cfg.antiMentionSpam.maxMentions) {
    await applyMessageAction(message, 'mention spam', cfg.antiMentionSpam);
    return;
  }

  // Invite spam.
  if (cfg.antiInviteSpam.enabled) {
    const invitePattern = /(?:discord\.(?:gg|com|app)\/(?:invite\/)?|discord\.me\/|dsc\.gg\/|disboard\.org\/)([\w-]+)/gi;
    const matches = [...message.content.matchAll(invitePattern)].map((m) => m[1].toLowerCase());
    if (matches.length) {
      const allowed = (cfg.antiInviteSpam.whitelist || []).map((c) => c.toLowerCase());
      const flagged = matches.filter((c) => !allowed.includes(c));
      if (flagged.length) {
        if (cfg.antiInviteSpam.action === 'timeout') await applyMessageAction(message, 'invite spam', cfg.antiInviteSpam);
        else await deleteAndLog(message, 'invite spam');
        return;
      }
    }
  }
}

const recentMessages = new Map(); // "guild:user" -> [timestamps]

async function applyMessageAction(message, label, rule) {
  try {
    await message.delete().catch(() => {});
    if (rule.action === 'timeout') {
      const dur = require('../../utils/time').parseDuration(rule.timeoutDuration);
      if (dur && message.member) {
        await message.member.timeout(dur, `Aether: ${label}`).catch(() => {});
      }
    } else if (rule.action === 'kick') {
      await message.member.kick(`Aether: ${label}`).catch(() => {});
    }
  } catch { /* ignore */ }

  await alert(
    message.guild,
    `⚠️ ${label.toUpperCase()}`,
    `${message.author} triggered **${label}** in ${message.channel}.\n> ${require('../../utils/discord').truncate(message.content, 200) || '*no text*'}`
  );
}

async function deleteAndLog(message, label) {
  await message.delete().catch(() => {});
  await alert(message.guild, `⚠️ ${label.toUpperCase()}`, `${message.author} posted an invite in ${message.channel}.`);
}

/** Webhook-created message check (abuse prevention). */
function checkWebhookMessage(message) {
  if (!message.guild || !message.webhookId) return false;
  const cfg = getConfig(message.guild.id);
  if (!cfg.enabled || !cfg.antiWebhook.enabled) return false;
  const key = `webhook:${message.guild.id}:${message.webhookId}`;
  const now = Date.now();
  const log = (webhookLog.get(key) || []).filter((t) => now - t < 60_000);
  log.push(now);
  webhookLog.set(key, log);
  if (log.length > 8) {
    message.delete().catch(() => {});
    alert(message.guild, '⚠️ WEBHOOK SPAM', `A webhook in ${message.channel} exceeded the message rate and was silenced.`).catch(() => {});
    return true;
  }
  return false;
}

const webhookLog = new Map();

/** Unlock a locked server. */
function unlockServer(guildId) {
  setConfig(guildId, { joinLock: { active: false, lockedAt: null, until: null } });
}

function isJoinLocked(guildId) {
  const cfg = getConfig(guildId);
  return Boolean(cfg.joinLock?.active && cfg.joinLock.until && Date.now() < Date.parse(cfg.joinLock.until));
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  checkMemberJoin,
  checkMessage,
  checkWebhookMessage,
  isWhitelisted,
  unlockServer,
  isJoinLocked,
};
