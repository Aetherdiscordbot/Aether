/**
 * Ticket service: config, creation, lifecycle + transcripts.
 * Configuration under the `ticket` settings key.
 */
const { randomUUID } = require('crypto');
const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db');
const settings = require('../../services/settings');
const logService = require('../../services/logService');
const premiumService = require('../../services/premium');
const config = require('../../config/config');
const logger = require('../../services/logger');
const { baseEmbed, Colors, truncate, infoEmbed } = require('../../utils/discord');
const { timestamp } = require('../../utils/time');

const DEFAULT_CONFIG = {
  enabled: true,
  categoryId: null,
  staffRoles: [],
  logChannelId: null,
  transcriptChannelId: null,
  welcomeMessage: 'Welcome {user}!\nA staff member will be with you shortly. Please describe your issue in detail.',
  categories: [], // [{ name, description, emoji }]
  openLimit: 3, // free tier
  premiumOpenLimit: 15,
};

const TICKET_BUTTONS = {
  claim: new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🙋'),
  close: new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
  reopen: new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reopen').setStyle(ButtonStyle.Success).setEmoji('🔓'),
  rename: new ButtonBuilder().setCustomId('ticket:rename').setLabel('Rename').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
  add: new ButtonBuilder().setCustomId('ticket:add').setLabel('Add User').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
  remove: new ButtonBuilder().setCustomId('ticket:remove').setLabel('Remove User').setStyle(ButtonStyle.Secondary).setEmoji('➖'),
  transcript: new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
};

function getConfig(guildId) {
  return { ...structuredClone(DEFAULT_CONFIG), ...settings.getSetting(guildId, 'ticket', {}) };
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'ticket', { ...getConfig(guildId), ...partial });
}

function openLimitFor(guild) {
  const cfg = getConfig(guild.id);
  return premiumService.isPremium(guild.id) ? cfg.premiumOpenLimit : cfg.openLimit;
}

function staffOverwrites(cfg) {
  return [
    { id: cfg.staffRoles, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles] },
  ].filter((o) => o.id?.length);
}

/** Build the ticket channel permission overwrites for a member. */
function permissionOverwrites(guild, member, cfg) {
  const overwrites = [
    {
      id: guild.roles.everyone,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
  ];
  for (const roleId of cfg.staffRoles) {
    overwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages],
    });
  }
  return overwrites;
}

/** Create a ticket channel. */
async function createTicket(guild, member, category, client) {
  const cfg = getConfig(guild.id);

  // Open-ticket limit.
  const open = db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'")
    .get(guild.id, member.id).n;
  const limit = openLimitFor(guild);
  if (open >= limit) {
    return { error: `You already have **${open}** open ticket(s). The limit is ${limit}.` };
  }

  const count = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ?").get(guild.id).n + 1;
  const name = `ticket-${category ? slug(category) + '-' : ''}${count}`;
  const parent = cfg.categoryId ? guild.channels.cache.get(cfg.categoryId) : null;

  const channel = await guild.channels.create({
    name,
    type: 0,
    parent: parent || undefined,
    permissionOverwrites: permissionOverwrites(guild, member, cfg),
    reason: `Ticket created by ${member.user.tag}`,
  });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO tickets (id, guild_id, channel_id, user_id, category, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, guild.id, channel.id, member.id, category || 'General', new Date().toISOString());

  const welcome = baseEmbed({
    color: Colors.primary,
    title: `Ticket ${category ? `— ${category}` : ''}`,
    description: cfg.welcomeMessage.replace('{user}', `<@${member.id}>`),
    fields: [{ name: 'User', value: `${member.user.tag} (${member.id})`, inline: true }],
    footer: { text: 'Staff can use the buttons below to manage this ticket.' },
  });

  await channel.send({ content: `<@${member.id}>`, embeds: [welcome], components: [actionRow('manage')] });

  await logService.sendLog(guild, 'ticket', {
    color: Colors.success,
    title: 'Ticket Opened',
    description: `${member.user} opened a ${category || 'General'} ticket → ${channel}`,
  });

  return { channel, id };
}

function actionRow(kind) {
  if (kind === 'manage') {
    return new ActionRowBuilder().addComponents(
      TICKET_BUTTONS.claim,
      TICKET_BUTTONS.close,
      TICKET_BUTTONS.rename,
      TICKET_BUTTONS.add,
      TICKET_BUTTONS.transcript
    );
  }
  if (kind === 'closed') {
    return new ActionRowBuilder().addComponents(TICKET_BUTTONS.reopen);
  }
  return new ActionRowBuilder();
}

function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId) || null;
}

/** Close a ticket: mark closed, strip perms, send transcript. */
async function closeTicket(guild, channel, actor, reason, client) {
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) return { error: 'This is not a tracked ticket channel.' };
  if (ticket.status === 'closed') return { error: 'This ticket is already closed.' };

  db.prepare("UPDATE tickets SET status = 'closed', closed_at = ?, claimed_by = claimed_by WHERE id = ?").run(new Date().toISOString(), ticket.id);

  const isPremium = premiumService.isPremium(guild.id);
  let transcript = null;
  if (isPremium) {
    transcript = await generateTranscript(channel);
    saveTranscript(ticket.id, transcript);
    await deliverTranscript(guild, channel, ticket, actor, transcript.text, client);
  }

  const embed = baseEmbed({
    color: Colors.error,
    title: 'Ticket Closed',
    description: `Closed by ${actor}${reason ? `\n**Reason:** ${reason}` : ''}${isPremium ? '' : '\n_Transcripts are an Aether Premium feature._'}`,
  });
  await channel.send({ embeds: [embed], components: [actionRow('closed')] });

  await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false });
  for (const roleId of getConfig(guild.id).staffRoles) {
    await channel.permissionOverwrites.edit(roleId, { ViewChannel: true }).catch(() => {});
  }

  await logService.sendLog(guild, 'ticket', {
    color: Colors.error,
    title: 'Ticket Closed',
    description: `${actor} closed ${channel}${reason ? ` — ${reason}` : ''}`,
  });

  setTimeout(() => channel.delete('Ticket closed, auto-cleanup').catch(() => {}), 5000);

  return { ticket, transcript };
}

/** Reopen a closed ticket (premium). */
async function reopenTicket(guild, channel, actor) {
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) return { error: 'This is not a tracked ticket channel.' };
  if (ticket.status !== 'closed') return { error: 'This ticket is not closed.' };

  await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: true });
  db.prepare("UPDATE tickets SET status = 'open', closed_at = NULL WHERE id = ?").run(ticket.id);

  await channel.send({
    embeds: [baseEmbed({ color: Colors.success, title: 'Ticket Reopened', description: `Reopened by ${actor}` })],
  });
  return { ticket };
}

async function claimTicket(guild, channel, actor) {
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) return { error: 'This is not a tracked ticket channel.' };
  if (ticket.status !== 'open') return { error: 'Closed tickets cannot be claimed.' };

  db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ?').run(actor.id, ticket.id);
  await channel.send({
    embeds: [baseEmbed({ color: Colors.info, title: 'Ticket Claimed', description: `${actor} is now handling this ticket.` })],
  });
  return { ticket };
}

async function addUserToTicket(guild, channel, target, actor) {
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) return { error: 'This is not a tracked ticket channel.' };
  await channel.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  await channel.send({ embeds: [baseEmbed({ color: Colors.success, description: `➕ ${target} was added by ${actor}.` })] });
  return { ticket };
}

async function removeUserFromTicket(guild, channel, target, actor) {
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) return { error: 'This is not a tracked ticket channel.' };
  if (target.id === ticket.user_id) return { error: 'You cannot remove the ticket owner.' };
  await channel.permissionOverwrites.delete(target.id).catch(() => {});
  await channel.send({ embeds: [baseEmbed({ color: Colors.warning, description: `➖ ${target} was removed by ${actor}.` })] });
  return { ticket };
}

/** Generate a transcript of a channel: plaintext + structured message data. */
async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const data = sorted.map((m) => ({
    author: {
      id: m.author.id,
      tag: m.author.tag,
      avatarUrl: m.author.displayAvatarURL({ size: 64 }),
    },
    content: m.content || '',
    timestamp: new Date(m.createdTimestamp).toISOString(),
    attachments: m.attachments.map((a) => ({ url: a.url, name: a.name })),
    embeds: m.embeds.length,
  }));
  const lines = sorted.map((m) => {
    const time = new Date(m.createdTimestamp).toLocaleString('en-US');
    const content = m.content || (m.attachments.size ? m.attachments.map((a) => a.url).join(' ') : '*embed/message*');
    return `[${time}] ${m.author.tag} (${m.author.id}): ${content.replace(/\n/g, ' ')}`;
  });
  return {
    text: `Transcript for #${channel.name} (${channel.id})\nGenerated ${new Date().toISOString()}\n\n` + lines.join('\n'),
    data,
    messages: sorted,
  };
}

/** Store a transcript as JSON (text + structured messages). */
function saveTranscript(ticketId, transcript) {
  db.prepare('UPDATE tickets SET transcript = ? WHERE id = ?').run(
    JSON.stringify({ text: transcript.text, data: transcript.data }),
    ticketId
  );
}

/** Load a transcript, tolerating the legacy plaintext format. */
function getTranscript(ticketId) {
  const row = db
    .prepare('SELECT id, guild_id, channel_id, user_id, category, status, created_at, closed_at, transcript FROM tickets WHERE id = ?')
    .get(ticketId);
  if (!row) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(row.transcript);
  } catch {
    parsed = null;
  }
  return {
    ...row,
    text: parsed?.text || row.transcript,
    data: parsed?.data || null,
  };
}

/** Public web URL for a ticket transcript. */
function transcriptUrl(guildId, ticketId) {
  const base = config.web.baseUrl || 'https://aether.ocrp.cc';
  return `${base.replace(/\/+$/, '')}/transcript/${guildId}/${ticketId}`;
}

async function deliverTranscript(guild, channel, ticket, actor, text, client) {
  const buffer = Buffer.from(text, 'utf8');
  const attachment = { name: `transcript-${channel.id}.txt`, attachment: buffer };
  const cfg = getConfig(guild.id);
  const link = transcriptUrl(guild.id, ticket.id);

  // DM to owner (premium).
  const owner = await client.users.fetch(ticket.user_id).catch(() => null);
  if (owner) {
    owner
      .send({
        embeds: [infoEmbed(`📄 Transcript for ${channel}\nView online: ${link}`)],
        files: [attachment],
      })
      .catch(() => {});
  }

  // Copy to configured transcript channel, else ticket log.
  const dest = cfg.transcriptChannelId
    ? guild.channels.cache.get(cfg.transcriptChannelId)
    : cfg.logChannelId
      ? guild.channels.cache.get(cfg.logChannelId)
      : null;
  if (dest?.isTextBased()) {
    await dest
      .send({
        embeds: [infoEmbed(`Transcript for ${channel} (closed by ${actor})\nView online: ${link}`)],
        files: [attachment],
      })
      .catch(() => {});
  }
}

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ticket';
}

/** Build the ticket panel embed + select menu for a guild's config. */
function buildPanel(guild, cfg) {
  const categories = cfg.categories?.length ? cfg.categories : [{ name: 'General', description: 'General support' }];
  const options = categories
    .slice(0, 25)
    .map((c) => ({
      label: c.name,
      value: c.name,
      description: (c.description || '').slice(0, 100) || undefined,
      emoji: c.emoji || undefined,
    }));

  const embed = baseEmbed({
    color: Colors.primary,
    title: '🎫 Support Tickets',
    description:
      'Need help? Open a ticket below and a member of staff will assist you as soon as possible.\n\n' +
      '**Please note:**\n• One ticket per topic\n• Be respectful to staff\n• Do not ping staff unnecessarily',
    footer: { text: 'Select a category to open a ticket' },
  });
  const select = new StringSelectMenuBuilder().setCustomId('ticket:create').setPlaceholder('Choose a category…').addOptions(options);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

/** Send the ticket panel to a channel (used by /ticket panel and the dashboard). */
async function sendPanel(guild, channel) {
  const cfg = getConfig(guild.id);
  const payload = buildPanel(guild, cfg);
  await channel.send(payload);
  return payload;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  createTicket,
  getTicketByChannel,
  closeTicket,
  reopenTicket,
  claimTicket,
  addUserToTicket,
  removeUserFromTicket,
  generateTranscript,
  saveTranscript,
  getTranscript,
  transcriptUrl,
  actionRow,
  openLimitFor,
  buildPanel,
  sendPanel,
};
