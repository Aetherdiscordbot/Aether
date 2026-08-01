/**
 * Leveling service: XP gain (message + voice), levels, role rewards and
 * leaderboards. Configuration under the `leveling` settings key.
 */
const db = require('../../database/db');
const settings = require('../../services/settings');
const logger = require('../../services/logger');
const { baseEmbed, Colors, errorEmbed, infoEmbed } = require('../../utils/discord');

const DEFAULT_CONFIG = {
  enabled: true,
  xpPerMessage: [15, 25],
  voiceXpPerMinute: 4,
  messageCooldownSec: 60,
  announcement: 'channel', // 'channel' | 'dm' | 'none'
  announceChannel: null,
  ignoreChannels: [],
  ignoreRoles: [],
};

const cooldowns = new Map();

function getConfig(guildId) {
  return { ...DEFAULT_CONFIG, ...settings.getSetting(guildId, 'leveling', {}) };
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'leveling', { ...getConfig(guildId), ...partial });
}

function getXp(guildId, userId) {
  return (
    db.prepare('SELECT * FROM xp WHERE guild_id = ? AND user_id = ?').get(guildId, userId) || {
      guild_id: guildId,
      user_id: userId,
      xp: 0,
      level: 0,
    }
  );
}

/** XP required to reach a given level (quadratic growth). */
function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

/** Total XP the user has earned (used for correct leaderboards). */
function totalXp(guildId, userId) {
  const row = getXp(guildId, userId);
  let total = row.xp;
  for (let l = 1; l < row.level; l++) total += xpForLevel(l);
  return total;
}

/** Grant XP and return { leveledUp, oldLevel, newLevel } if a level changed. */
function addXp(guildId, userId, amount) {
  const row = getXp(guildId, userId);
  let newLevel = row.level;
  let xp = row.xp + amount;

  while (xp >= xpForLevel(newLevel)) {
    xp -= xpForLevel(newLevel);
    newLevel++;
  }
  // Never lose progress on a partial level-up carry-over.
  if (newLevel === row.level && xp >= xpForLevel(newLevel)) {
    xp = 0;
    newLevel++;
  }

  db.prepare(
    `INSERT INTO xp (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = excluded.xp, level = excluded.level`
  ).run(guildId, userId, xp, newLevel);

  return { leveledUp: newLevel > row.level, oldLevel: row.level, newLevel };
}

/** Handle XP from a message, respecting cooldown. */
function handleMessage(message) {
  const cfg = getConfig(message.guild.id);
  if (!cfg.enabled) return null;
  if (message.author.bot) return null;
  if (cfg.ignoreChannels.includes(message.channel.id)) return null;
  if (cfg.ignoreRoles.some((r) => message.member?.roles.cache.has(r))) return null;

  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;
  const last = cooldowns.get(key) || 0;
  if (now - last < cfg.messageCooldownSec * 1000) return null;
  cooldowns.set(key, now);

  const [min, max] = cfg.xpPerMessage;
  const amount = min + Math.floor(Math.random() * (max - min + 1));
  return addXp(message.guild.id, message.author.id, amount);
}

/** Voice XP: call once per member when they enter a VC (handled by accumulator). */
function handleVoiceXp(guildId, userId, minutes) {
  const cfg = getConfig(guildId);
  if (!cfg.enabled) return null;
  if (minutes <= 0) return null;
  return addXp(guildId, userId, cfg.voiceXpPerMinute * minutes);
}

/** Get the reward role for a level, if configured. */
function getRewardRole(guild, level) {
  const row = db.prepare('SELECT * FROM level_rewards WHERE guild_id = ? AND level = ?').get(guild.id, level);
  if (!row) return null;
  return guild.roles.cache.get(row.role_id) || null;
}

/** Add/remove reward roles on level-up. */
async function applyRewards(member, newLevel) {
  const role = getRewardRole(member.guild, newLevel);
  if (!role) return;
  try {
    if (!member.roles.cache.has(role.id)) await member.roles.add(role, `Aether level ${newLevel} reward`);
  } catch {
    /* ignore role errors */
  }
}

/** Build the /rank embed. */
function buildRankEmbed(member) {
  const row = getXp(member.guild.id, member.id);
  const xpNeeded = xpForLevel(row.level);
  const percent = Math.min(100, Math.round((row.xp / xpNeeded) * 100));
  const bar = progressBar(percent);

  const all = db
    .prepare('SELECT user_id, xp, level FROM xp WHERE guild_id = ? ORDER BY (xp + level * 0) DESC')
    .all(member.guild.id);
  const ranked = all
    .map((r) => ({ ...r, total: totalXp(member.guild.id, r.user_id) }))
    .sort((a, b) => b.total - a.total)
    .findIndex((r) => r.user_id === member.id);

  return baseEmbed({
    color: Colors.primary,
    author: { name: member.user.username, iconURL: member.user.displayAvatarURL() },
    title: `${member.user.username}'s Rank`,
    description:
      `**Level:** ${row.level}\n` +
      `**XP:** ${row.xp.toLocaleString()} / ${xpNeeded.toLocaleString()}\n` +
      `**Progress:** ${bar} \`${percent}%\`\n` +
      `**Server Rank:** #${ranked === -1 ? '?' : ranked + 1}`,
    footer: { text: 'Earn XP by chatting' },
  });
}

function progressBar(percent, size = 12) {
  const filled = Math.round((percent / 100) * size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  getXp,
  xpForLevel,
  totalXp,
  addXp,
  handleMessage,
  handleVoiceXp,
  applyRewards,
  buildRankEmbed,
};
