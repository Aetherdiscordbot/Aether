/**
 * Verification service: button-based member verification.
 * Configuration under the `verification` settings key.
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const settings = require('../../services/settings');
const logService = require('../../services/logService');
const { baseEmbed, Colors } = require('../../utils/discord');

const DEFAULT_CONFIG = {
  enabled: false,
  channelId: null,
  messageId: null,
  roleId: null,
  message: 'Click the button below to verify yourself and gain access to the server.',
};

function getConfig(guildId) {
  return { ...structuredClone(DEFAULT_CONFIG), ...settings.getSetting(guildId, 'verification', {}) };
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'verification', { ...getConfig(guildId), ...partial });
}

/** Send (or update) the verification message with the button. */
async function publishPanel(guild, channel) {
  const cfg = getConfig(guild.id);
  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify:click').setLabel('Verify').setStyle(ButtonStyle.Success).setEmoji('✅')
  );
  const embed = baseEmbed({
    color: Colors.primary,
    title: '🔐 Verification',
    description: cfg.message,
  });

  if (cfg.messageId) {
    const old = await channel.messages.fetch(cfg.messageId).catch(() => null);
    if (old) return old.edit({ embeds: [embed], components: [button] });
  }
  const message = await channel.send({ embeds: [embed], components: [button] });
  setConfig(guild.id, { messageId: message.id, channelId: channel.id });
  return message;
}

/** Grant the verified role (unless already verified). */
async function verifyMember(member) {
  const cfg = getConfig(member.guild.id);
  if (!cfg.enabled || !cfg.roleId) return { error: 'Verification is not configured.' };
  const role = member.guild.roles.cache.get(cfg.roleId);
  if (!role) return { error: 'The verified role no longer exists.' };
  if (member.roles.cache.has(cfg.roleId)) return { error: 'You are already verified.' };

  const me = member.guild.members.me;
  if (me.roles.highest.position <= role.position) return { error: 'I cannot assign that role (role is higher than mine).' };

  await member.roles.add(role, 'Aether verification');
  await logService.sendLog(member.guild, 'verification', {
    color: Colors.success,
    title: 'Member Verified',
    description: `${member.user} verified and received ${role}.`,
  });
  return { role };
}

module.exports = { DEFAULT_CONFIG, getConfig, setConfig, publishPanel, verifyMember };
