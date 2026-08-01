/**
 * Suggestion service: submit, vote reactions, staff approve/deny.
 * Configuration under the `suggestions` settings key.
 */
const { randomUUID } = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const settings = require('../../services/settings');
const logService = require('../../services/logService');
const { baseEmbed, Colors, truncate } = require('../../utils/discord');

const DEFAULT_CONFIG = {
  channelId: null,
  deleteOnDeny: false,
};

const UP = '👍';
const DOWN = '👎';

function getConfig(guildId) {
  return { ...structuredClone(DEFAULT_CONFIG), ...settings.getSetting(guildId, 'suggestions', {}) };
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'suggestions', { ...getConfig(guildId), ...partial });
}

function getSuggestion(id) {
  return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id) || null;
}

function suggestionEmbed(row) {
  const statuses = {
    pending: { label: 'Pending', color: Colors.info },
    approved: { label: 'Approved', color: Colors.success },
    denied: { label: 'Denied', color: Colors.error },
  };
  const s = statuses[row.status] || statuses.pending;
  return baseEmbed({
    color: s.color,
    title: `💡 Suggestion — ${s.label}`,
    description: row.content,
    fields: [
      { name: 'Status', value: s.label, inline: true },
      { name: 'Author', value: `<@${row.user_id}>`, inline: true },
      ...(row.reason ? [{ name: 'Reason', value: truncate(row.reason, 1024) }] : []),
    ],
    footer: { text: `ID: ${row.id} · React 👍 / 👎 to vote` },
  });
}

function reviewButtons(row) {
  const approve = new ButtonBuilder()
    .setCustomId(`suggestion:approve:${row.id}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');
  const deny = new ButtonBuilder()
    .setCustomId(`suggestion:deny:${row.id}`)
    .setLabel('Deny')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  return new ActionRowBuilder().addComponents(approve, deny);
}

/** Submit a suggestion; posts to the configured channel with vote reactions. */
async function submitSuggestion(client, guild, user, content) {
  const cfg = getConfig(guild.id);
  const channel = cfg.channelId ? guild.channels.cache.get(cfg.channelId) : null;
  if (!channel?.isTextBased()) return { error: 'No suggestions channel is configured. Run `/suggestions setup`.', cfg };

  const id = randomUUID();
  const row = {
    id,
    guild_id: guild.id,
    channel_id: channel.id,
    message_id: null,
    user_id: user.id,
    content,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO suggestions (id, guild_id, channel_id, message_id, user_id, content, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, guild.id, channel.id, null, user.id, content, row.created_at);

  const message = await channel.send({ embeds: [suggestionEmbed(row)], components: [reviewButtons(row)] });
  await message.react(UP).catch(() => {});
  await message.react(DOWN).catch(() => {});
  db.prepare('UPDATE suggestions SET message_id = ? WHERE id = ?').run(message.id, id);

  return { id, message, channel };
}

/** Approve or deny a suggestion and edit the published message. */
async function reviewSuggestion(client, guild, id, status, reviewer, reason) {
  const row = getSuggestion(id);
  if (!row) return { error: 'Suggestion not found.' };
  if (row.status !== 'pending') return { error: 'This suggestion has already been reviewed.' };

  db.prepare('UPDATE suggestions SET status = ?, reviewed_by = ?, reason = ? WHERE id = ?').run(
    status,
    reviewer.id,
    reason || null,
    id
  );

  const updated = getSuggestion(id);
  const channel = guild.channels.cache.get(row.channel_id);
  if (channel?.isTextBased() && row.message_id) {
    const message = await channel.messages.fetch(row.message_id).catch(() => null);
    if (message) {
      await message.edit({ embeds: [suggestionEmbed(updated)], components: [reviewButtons(updated)] });
    }
  }

  const author = await client.users.fetch(row.user_id).catch(() => null);
  if (author) {
    author
      .send({
        embeds: [
          baseEmbed({
            color: status === 'approved' ? Colors.success : Colors.error,
            title: `Your suggestion was ${status === 'approved' ? 'approved' : 'denied'}`,
            description: row.content + (reason ? `\n\n**Reason:** ${reason}` : ''),
          }),
        ],
      })
      .catch(() => {});
  }

  await logService.sendLog(guild, 'suggestion', {
    color: status === 'approved' ? Colors.success : Colors.error,
    title: `Suggestion ${status === 'approved' ? 'Approved' : 'Denied'}`,
    description: `<@${row.user_id}> → ${truncate(row.content, 200)}\nReviewed by ${reviewer}${reason ? ` — ${reason}` : ''}`,
  });

  return { row: updated };
}

function deleteSuggestion(id) {
  const row = getSuggestion(id);
  if (row) db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
  return row;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  submitSuggestion,
  reviewSuggestion,
  deleteSuggestion,
  getSuggestion,
  suggestionEmbed,
};
