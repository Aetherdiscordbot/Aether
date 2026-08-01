/**
 * Logging service: routes named events to their configured log channels.
 * Configuration lives in per-guild settings under the `logging` key:
 *   { enabled: true, channels: { join: "id", moderation: "id", ... } }
 */
const settings = require('./settings');
const { EmbedBuilder } = require('discord.js');
const { Colors, baseEmbed } = require('../utils/discord');

/** Every loggable event key (also used by /logging setup). */
const EVENT_KEYS = [
  { key: 'join', label: 'Member Joins' },
  { key: 'leave', label: 'Member Leaves' },
  { key: 'messageDelete', label: 'Message Deleted' },
  { key: 'messageUpdate', label: 'Message Edited' },
  { key: 'role', label: 'Role Updates' },
  { key: 'channel', label: 'Channel Updates' },
  { key: 'server', label: 'Server Updates' },
  { key: 'nickname', label: 'Nickname Changes' },
  { key: 'voice', label: 'Voice Activity' },
  { key: 'moderation', label: 'Moderation Actions' },
  { key: 'invite', label: 'Invite Events' },
  { key: 'webhook', label: 'Webhook Abuse' },
  { key: 'member', label: 'Member Role Updates' },
  { key: 'ticket', label: 'Tickets' },
  { key: 'security', label: 'Security Alerts' },
  { key: 'automod', label: 'Auto-Moderation' },
];

const DEFAULT_CHANNELS = EVENT_KEYS.reduce((acc, e) => ((acc[e.key] = null), acc), {});

function getConfig(guildId) {
  const cfg = settings.getSetting(guildId, 'logging', {});
  return {
    enabled: cfg.enabled !== false,
    channels: { ...DEFAULT_CHANNELS, ...(cfg.channels || {}) },
  };
}

function setConfig(guildId, partial) {
  const cfg = getConfig(guildId);
  settings.setSetting(guildId, 'logging', {
    enabled: partial.enabled ?? cfg.enabled,
    channels: { ...cfg.channels, ...(partial.channels || {}) },
  });
}

function getLogChannel(guild, eventKey) {
  const cfg = getConfig(guild.id);
  if (!cfg.enabled) return null;
  const id = cfg.channels[eventKey];
  if (!id) return null;
  return guild.channels.cache.get(id) || null;
}

/**
 * Send a log entry. `options` can be a ready EmbedBuilder or plain embed data.
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function sendLog(guild, eventKey, options = {}) {
  if (!guild || guild.members?.me?.id === guild.id) return null;
  const channel = getLogChannel(guild, eventKey);
  if (!channel) return null;

  const embed =
    options instanceof EmbedBuilder
      ? options
      : baseEmbed({
          color: options.color || Colors.info,
          title: options.title,
          description: options.description,
          fields: options.fields,
          footer: options.footer,
        });

  try {
    return await channel.send({ embeds: [embed], ...(options.extra ? options.extra : {}) });
  } catch (err) {
    return null;
  }
}

/** Convenience: moderation + security action logging with actor info. */
async function logAction(guild, { action, target, moderator, reason, color, eventKey = 'moderation', extraFields = [] }) {
  const embed = baseEmbed({
    color: color || Colors.info,
    title: `${action}`,
    description: `**User:** ${target}\n**Moderator:** ${moderator}\n**Reason:** ${reason || 'No reason provided'}`,
    fields: extraFields,
    footer: { text: `ID: ${target?.id || 'unknown'}` },
  });
  return sendLog(guild, eventKey, embed);
}

module.exports = {
  EVENT_KEYS,
  getConfig,
  setConfig,
  getLogChannel,
  sendLog,
  logAction,
};
