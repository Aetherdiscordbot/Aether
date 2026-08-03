/**
 * Ticket service — free ticket system.
 */
const { createClient } = require('@supabase/supabase-js');
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getConfig(guildId) {
  const { data } = await supabase.from('ticket_config').select('*').eq('guild_id', guildId).single();
  return data;
}

async function setConfig(guildId, patch) {
  await supabase.from('ticket_config').upsert({ guild_id: guildId, ...patch });
}

function ticketButtons(ticketId, isClaimed = false, isClosed = false) {
  const row = new ActionRowBuilder();
  if (!isClosed) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`).setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('📋').setDisabled(isClaimed),
      new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId(`ticket:delete:${ticketId}`).setLabel('Delete').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
      new ButtonBuilder().setCustomId(`ticket:transcript:${ticketId}`).setLabel('Transcript').setStyle(ButtonStyle.Primary).setEmoji('📄')
    );
  }
  return row;
}

async function sendTicketEmbed(channel, ticket, isClosed = false) {
  const embed = new EmbedBuilder()
    .setColor(isClosed ? 0x999999 : 0x8b5cf6)
    .setTitle(isClosed ? `🔒 Ticket Closed — ${ticket.category}` : `🎫 Ticket — ${ticket.category}`)
    .setDescription(isClosed 
      ? `Closed by <@${ticket.closed_by}>\n${ticket.close_reason ? `Reason: ${ticket.close_reason}` : ''}`
      : `Created by <@${ticket.user_id}>\nStaff will assist you shortly.`)
    .setFooter({ text: `Ticket ID: ${ticket.id}` })
    .setTimestamp();
  
  await channel.send({ embeds: [embed], components: [ticketButtons(ticket.id, ticket.claimed_by ? true : false, isClosed)] });
}

/** Create a ticket channel. */
async function createTicket(guild, user, category) {
  const cfg = await getConfig(guild.id);
  if (!cfg) throw new Error('Ticket system not configured. Run /ticket setup.');

  const categoryChannel = guild.channels.cache.get(cfg.category_id);
  if (!categoryChannel) throw new Error('Ticket category not found.');

  const staffRoles = cfg.staff_roles || [];
  const overwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];
  for (const roleId of staffRoles) {
    overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }

  const channel = await guild.channels.create({
    name: `ticket-${user.username}`,
    type: ChannelType.GuildText,
    parent: categoryChannel.id,
    permissionOverwrites: overwrites,
    reason: `Ticket created by ${user.tag}`,
  });

  const ticketData = {
    guild_id: guild.id,
    channel_id: channel.id,
    user_id: user.id,
    category,
    status: 'open',
    claimed_by: null,
    created_at: new Date().toISOString(),
  };
  const { data: ticket } = await supabase.from('tickets').insert(ticketData).select().single();

  await sendTicketEmbed(channel, { ...ticket, category });
  return channel;
}

/** Close a ticket with transcript. */
async function closeTicket(guild, channel, user, reason) {
  const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', channel.id).eq('status', 'open').single();
  if (!ticket) return;

  // Generate transcript
  const messages = await channel.messages.fetch({ limit: 100 });
  const transcript = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`)
    .join('\n');

  await supabase.from('tickets').update({
    status: 'closed',
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    close_reason: reason || 'No reason provided',
    transcript,
  }).eq('channel_id', channel.id);

  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { ViewChannel: false });
  await channel.setName(`closed-${channel.name}`);

  // Send updated embed with transcript button
  await supabase.from('tickets').update({ transcript }).eq('channel_id', channel.id);
  await sendTicketEmbed(channel, { ...ticket, closed_by: user.id, close_reason: reason }, true);

  // Log to log channel
  const cfg = await getConfig(guild.id);
  if (cfg?.log_channel_id) {
    const logChannel = guild.channels.cache.get(cfg.log_channel_id);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🔒 Ticket Closed')
        .addFields(
          { name: 'Ticket', value: `<#${channel.id}> (${ticket.category})`, inline: true },
          { name: 'Opened by', value: `<@${ticket.user_id}>`, inline: true },
          { name: 'Closed by', value: `<@${user.id}>`, inline: true },
          { name: 'Reason', value: reason || 'No reason', inline: false },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  }
}

/** Claim a ticket. */
async function claimTicket(guild, channel, user) {
  const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', channel.id).eq('status', 'open').single();
  if (!ticket) return false;

  if (ticket.claimed_by) return false;

  await supabase.from('tickets').update({ claimed_by: user.id }).eq('channel_id', channel.id);

  const cfg = await getConfig(guild.id);
  if (cfg?.log_channel_id) {
    const logChannel = guild.channels.cache.get(cfg.log_channel_id);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x44ff44)
        .setTitle('📋 Ticket Claimed')
        .addFields(
          { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
          { name: 'Claimed by', value: `<@${user.id}>`, inline: true },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  }

  await sendTicketEmbed(channel, { ...ticket, claimed_by: user.id });
  return true;
}

/** Delete a closed ticket channel. */
async function deleteTicket(channel) {
  await channel.delete('Ticket deleted after closure');
  await supabase.from('tickets').update({ status: 'deleted' }).eq('channel_id', channel.id);
}

/** Create ticket panel in channel. */
async function sendPanel(guild, channel) {
  const cfg = await getConfig(guild.id);
  if (!cfg) throw new Error('Ticket system not configured.');

  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('🎫 Support Tickets')
    .setDescription('Click a button below to open a ticket.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:create:General').setLabel('General').setStyle(ButtonStyle.Primary).setEmoji('💬'),
    new ButtonBuilder().setCustomId('ticket:create:Billing').setLabel('Billing').setStyle(ButtonStyle.Success).setEmoji('💳'),
    new ButtonBuilder().setCustomId('ticket:create:Report').setLabel('Report').setStyle(ButtonStyle.Danger).setEmoji('🚩')
  );
  await channel.send({ embeds: [embed], components: [row] });
}

module.exports = {
  getConfig, setConfig,
  createTicket, closeTicket, claimTicket, deleteTicket,
  sendPanel, sendTicketEmbed,
};