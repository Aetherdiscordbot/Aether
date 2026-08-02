/**
 * /ticket — ticket system management.
 */
const { successEmbed, errorEmbed } = require('../../utils/discord');
const ticketService = require('../../modules/tickets/ticketService');
const premiumService = require('../../services/premium');
const { str, channel, role, sub, req, mention } = require('../../utils/commandBuilder');

module.exports = {
  name: 'ticket',
  description: 'Ticket system',
  permissions: [],
  subPermissions: {
    setup: ['ManageGuild'],
    panel: ['ManageGuild'],
  },
  options: [
    sub('setup', 'Configure the ticket system', [
      channel('category', 'Category to create tickets under', req({ channel_types: [4] })),
      mention('staff_roles', 'Staff role that can manage tickets', req()),
      channel('log_channel', 'Channel for ticket logs', { channel_types: [0] }),
      channel('transcript_channel', 'Channel to post transcripts', { channel_types: [0] }),
      str('welcome_message', 'Welcome message shown when a ticket opens', {}),
    ]),
    sub('panel', 'Send the ticket panel to a channel', [
      channel('channel', 'Channel to send the panel to', req({ channel_types: [0] })),
    ]),
    sub('close', 'Close the current ticket channel', [str('reason', 'Reason for closing', {})]),
    sub('claim', 'Claim the current ticket channel'),
    sub('add', 'Add a user to the current ticket channel', [mention('user', 'User to add', req())]),
    sub('remove', 'Remove a user from the current ticket channel', [mention('user', 'User to remove', req())]),
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    switch (sub) {
      case 'setup':
        return setup(client, interaction);
      case 'panel':
        return panel(client, interaction);
      case 'close':
        return close(client, interaction);
      case 'claim':
        return claim(client, interaction);
      case 'add':
        return addUser(client, interaction);
      case 'remove':
        return removeUser(client, interaction);
    }
  },
};

async function setup(client, interaction) {
  const category = interaction.options.getChannel('category');
  const staffRole = interaction.options.getMentionable('staff_roles');
  const logChannel = interaction.options.getChannel('log_channel');
  const transcriptChannel = interaction.options.getChannel('transcript_channel');
  const welcome = interaction.options.getString('welcome_message');

  if (staffRole && !staffRole.id) return interaction.reply({ embeds: [errorEmbed('Please provide a staff **role**.')], ephemeral: true });

  const cfg = ticketService.getConfig(interaction.guildId);
  const staffRoles = new Set(cfg.staffRoles);
  if (staffRole) staffRoles.add(staffRole.id);

  ticketService.setConfig(interaction.guildId, {
    categoryId: category.id,
    staffRoles: [...staffRoles],
    logChannelId: logChannel?.id || cfg.logChannelId,
    transcriptChannelId: transcriptChannel?.id || cfg.transcriptChannelId,
    welcomeMessage: welcome || cfg.welcomeMessage,
  });

  return interaction.reply({
    embeds: [
      successEmbed(
        `Ticket system configured.\n**Category:** ${category}\n**Staff:** ${[...staffRoles].map((id) => `<@&${id}>`).join(', ')}\n**Logs:** ${logChannel || 'not set'}`
      ),
    ],
    ephemeral: true,
  });
}

async function panel(client, interaction) {
  const channel = interaction.options.getChannel('channel');
  await ticketService.sendPanel(interaction.guild, channel);
  return interaction.reply({ embeds: [successEmbed(`Ticket panel sent to ${channel}.`)], ephemeral: true });
}

async function close(client, interaction) {
  const reason = interaction.options.getString('reason') || '';
  const result = await ticketService.closeTicket(interaction.guild, interaction.channel, interaction.user, reason, client);
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed('Ticket closed.')], ephemeral: true });
}

async function claim(client, interaction) {
  const result = await ticketService.claimTicket(interaction.guild, interaction.channel, interaction.user);
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed('Ticket claimed.')], ephemeral: true });
}

async function addUser(client, interaction) {
  const target = interaction.options.getMentionable('user');
  if (!target.id) return interaction.reply({ embeds: [errorEmbed('Provide a valid user.')], ephemeral: true });
  const result = await ticketService.addUserToTicket(interaction.guild, interaction.channel, target, interaction.user);
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed(`${target} added.`)], ephemeral: true });
}

async function removeUser(client, interaction) {
  const target = interaction.options.getMentionable('user');
  if (!target.id) return interaction.reply({ embeds: [errorEmbed('Provide a valid user.')], ephemeral: true });
  const result = await ticketService.removeUserFromTicket(interaction.guild, interaction.channel, target, interaction.user);
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed(`${target} removed.`)], ephemeral: true });
}
