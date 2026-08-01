/**
 * Ticket buttons: claim / close / reopen / rename / add / remove / transcript.
 */
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ticketService = require('../modules/tickets/ticketService');
const premiumService = require('../services/premium');
const { errorEmbed, successEmbed, infoEmbed } = require('../utils/discord');

module.exports = {
  id: 'ticket',
  type: 'button',
  async run(client, interaction) {
    const action = interaction.customId.split(':')[1];
    const cfg = ticketService.getConfig(interaction.guildId);
    const isStaff = interaction.member.roles.cache.hasAny(...cfg.staffRoles) || interaction.member.permissions.has('Administrator');

    switch (action) {
      case 'create':
        return createTicket(client, interaction);
      case 'claim':
        if (!isStaff) return deny(interaction);
        return run(interaction, () => ticketService.claimTicket(interaction.guild, interaction.channel, interaction.user));
      case 'close':
        return run(interaction, () => ticketService.closeTicket(interaction.guild, interaction.channel, interaction.user, '', client));
      case 'reopen':
        if (!premiumService.isPremium(interaction.guildId)) return premiumDeny(interaction);
        if (!isStaff) return deny(interaction);
        return run(interaction, () => ticketService.reopenTicket(interaction.guild, interaction.channel, interaction.user));
      case 'rename':
        if (!isStaff) return deny(interaction);
        return showRenameModal(interaction);
      case 'add':
        if (!isStaff) return deny(interaction);
        return showAddModal(interaction);
      case 'remove':
        if (!isStaff) return deny(interaction);
        return showRemoveModal(interaction);
      case 'transcript': {
        if (!isStaff) return deny(interaction);
        const transcript = await ticketService.generateTranscript(interaction.channel);
        const buffer = Buffer.from(transcript.text, 'utf8');
        return interaction.reply({
          embeds: [infoEmbed('Here is the current transcript.')],
          files: [{ name: `transcript-${interaction.channel.id}.txt`, attachment: buffer }],
          ephemeral: true,
        });
      }
    }
  },
};

async function createTicket(client, interaction) {
  const result = await ticketService.createTicket(interaction.guild, interaction.member, 'General', client);
  if (result.error) {
    return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  }
  return interaction.reply({
    embeds: [successEmbed(`Your ticket is ready → ${result.channel}`)],
    ephemeral: true,
  });
}

async function run(interaction, fn) {
  const result = await fn();
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed('Done.')], ephemeral: true });
}

async function deny(interaction) {
  return interaction.reply({ embeds: [errorEmbed('Only staff can do this.')], ephemeral: true });
}

async function premiumDeny(interaction) {
  const { premiumRequiredEmbed } = require('../utils/discord');
  return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
}

function textInput(customId, label, { placeholder, required = true, value } = {}) {
  return new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(required)
    .setMaxLength(200);
}

async function showRenameModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticketrename:rename')
    .setTitle('Rename Ticket')
    .addComponents(new ActionRowBuilder().addComponents(textInput('name', 'New ticket name', { value: interaction.channel.name })));
  return interaction.showModal(modal);
}

async function showAddModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticketadd:add')
    .setTitle('Add User to Ticket')
    .addComponents(new ActionRowBuilder().addComponents(textInput('user', 'User ID', { placeholder: 'Paste the user\'s Discord ID' })));
  return interaction.showModal(modal);
}

async function showRemoveModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticketremove:remove')
    .setTitle('Remove User from Ticket')
    .addComponents(new ActionRowBuilder().addComponents(textInput('user', 'User ID', { placeholder: 'Paste the user\'s Discord ID' })));
  return interaction.showModal(modal);
}
