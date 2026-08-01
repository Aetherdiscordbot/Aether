/**
 * Reaction-role service: button-based role assignment panels.
 */
const { randomUUID } = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { baseEmbed, Colors } = require('../../utils/discord');

const STYLES = {
  PRIMARY: ButtonStyle.Primary,
  SUCCESS: ButtonStyle.Success,
  DANGER: ButtonStyle.Danger,
  SECONDARY: ButtonStyle.Secondary,
};

function getMessageRows(messageId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? ORDER BY sort_order ASC').all(messageId);
}

function getPanels(guildId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? ORDER BY created_at ASC').all(guildId);
}

function getRoleRow(messageId, roleId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND role_id = ?').get(messageId, roleId);
}

function buildRow(rows) {
  const buttons = rows.map((r) =>
    new ButtonBuilder()
      .setCustomId(`reaction:role:${r.message_id}:${r.role_id}`)
      .setLabel(r.label || '')
      .setEmoji(r.emoji || '🎁')
      .setStyle(STYLES[r.style] || ButtonStyle.Primary)
  );
  return new ActionRowBuilder().addComponents(buttons);
}

/** Find or create the panel message for a name, then add the button. */
async function addRole(client, guild, channel, panelName, roleId, { label, emoji, style }) {
  const role = guild.roles.cache.get(roleId);
  if (!role) return { error: 'Role not found.' };

  const existing = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND panel_name = ? AND role_id = ?').get(guild.id, panelName);
  if (existing) return { error: 'That role is already in this panel.' };

  const panelMsg = db.prepare('SELECT message_id FROM reaction_roles WHERE guild_id = ? AND panel_name = ? LIMIT 1').get(guild.id, panelName);
  let messageId = panelMsg?.message_id;

  const rows = messageId ? getMessageRows(messageId) : [];
  const nextOrder = rows.length;

  if (messageId) {
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (message) {
      const newRows = [...rows, { message_id: messageId, role_id: roleId, label, emoji, style, sort_order: nextOrder }];
      await message.edit({ components: [buildRow(newRows)] });
    } else {
      messageId = null;
    }
  }

  if (!messageId) {
    const message = await channel.send({
      embeds: [baseEmbed({ color: Colors.primary, title: panelName, footer: { text: 'Click a button to receive the role' } })],
      components: [buildRow([{ message_id: 'placeholder', role_id: roleId, label, emoji, style, sort_order: 0 }])],
    });
    messageId = message.id;
    // The placeholder button id must match the stored one; replace the component row.
    await message.edit({ components: [buildRow([{ message_id: messageId, role_id: roleId, label, emoji, style, sort_order: 0 }])] });
  }

  db.prepare(
    `INSERT INTO reaction_roles (guild_id, channel_id, message_id, panel_name, role_id, label, emoji, style, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(guild.id, channel.id, messageId, panelName, roleId, label || null, emoji || null, (style || 'PRIMARY').toUpperCase(), nextOrder, new Date().toISOString());

  return { messageId };
}

/** Remove a role from a panel and re-render buttons. */
async function removeRole(client, guild, messageId, roleId) {
  const row = getRoleRow(messageId, roleId);
  if (!row) return { error: 'Role not found in that panel.' };
  db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND role_id = ?').run(messageId, roleId);
  return { messageId };
}

function listPanels(guildId) {
  const rows = getPanels(guildId);
  const byMessage = new Map();
  for (const r of rows) {
    if (!byMessage.has(r.message_id)) byMessage.set(r.message_id, []);
    byMessage.get(r.message_id).push(r);
  }
  return [...byMessage.values()];
}

/** Toggle a role for the user on button click. */
async function toggleRole(member, messageId, roleId) {
  const row = getRoleRow(messageId, roleId);
  if (!row) return { error: 'That role button no longer exists.' };
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return { error: 'Role no longer exists.' };

  const me = member.guild.members.me;
  if (me.roles.highest.position <= role.position) return { error: 'I cannot manage that role (it is higher than mine).' };

  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(role, 'Aether reaction role');
    return { action: 'removed', role };
  }
  await member.roles.add(role, 'Aether reaction role');
  return { action: 'added', role };
}

module.exports = { addRole, removeRole, listPanels, toggleRole, getMessageRows, buildRow };
