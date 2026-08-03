/**
 * /ticket — free ticket system.
 */
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const ticketService = require('../../services/tickets');

module.exports = {
  name: 'ticket',
  description: 'Ticket system',
  options: [
    {
      name: 'setup',
      description: 'Configure the ticket system (free)',
      type: 1,
      options: [
        { name: 'category', description: 'Category for tickets', type: 7, required: true, channel_types: [ChannelType.GuildCategory] },
        { name: 'staff_roles', description: 'Roles that can manage tickets', type: 8, required: true },
        { name: 'panel_channel', description: 'Channel for the ticket panel', type: 7, required: false, channel_types: [ChannelType.GuildText] },
        { name: 'log_channel', description: 'Channel for ticket logs', type: 7, required: false, channel_types: [ChannelType.GuildText] },
      ],
    },
    {
      name: 'create',
      description: 'Open a new ticket (free)',
      type: 1,
      options: [
        { name: 'category', description: 'Ticket category', type: 3, required: true, choices: [
          { name: 'General', value: 'General' },
          { name: 'Billing', value: 'Billing' },
          { name: 'Report', value: 'Report' },
        ]},
      ],
    },
    {
      name: 'close',
      description: 'Close the current ticket (free)',
      type: 1,
      options: [
        { name: 'reason', description: 'Reason for closing', type: 3, required: false },
      ],
    },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    try {
      if (sub === 'setup') {
        const category = interaction.options.getChannel('category');
        const staffRoles = interaction.options.getRole('staff_roles');
        const panelChannel = interaction.options.getChannel('panel_channel');
        const logChannel = interaction.options.getChannel('log_channel');

        await ticketService.setConfig(interaction.guildId, {
          category_id: category.id,
          staff_roles: [staffRoles.id],
          panel_channel_id: panelChannel?.id || null,
          log_channel_id: logChannel?.id || null,
        });

        // Send panel if panel_channel provided
        if (panelChannel) {
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
          await panelChannel.send({ embeds: [embed], components: [row] });
        }

        return interaction.reply({ content: '✅ Ticket system configured.', ephemeral: true });
      }

      if (sub === 'create') {
        const category = interaction.options.getString('category');
        await interaction.deferReply({ ephemeral: true });
        const channel = await ticketService.createTicket(guild, interaction.user, category);
        return interaction.editReply({ content: `✅ Ticket created: <#${channel.id}>` });
      }

      if (sub === 'close') {
        const reason = interaction.options.getString('reason');
        const { data: ticket } = await require('../../database/db').supabase
          .from('tickets').select('*').eq('channel_id', interaction.channelId).eq('status', 'open').single();
        if (!ticket) return interaction.reply({ content: 'Not an open ticket channel.', ephemeral: true });

        await ticketService.closeTicket(guild, interaction.channel, interaction.user, reason);
        return interaction.reply({ content: '🔒 Ticket closed.' });
      }
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};