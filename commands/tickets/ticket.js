/**
 * /ticket — free ticket system + premium AI helper config.
 */
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const ticketService = require('../../services/tickets');
const premiumService = require('../../services/premium');

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
    {
      name: 'ai',
      description: 'Configure AI ticket helper (premium only)',
      type: 1,
      options: [
        { name: 'enable', description: 'Enable AI helper', type: 1, options: [] },
        { name: 'disable', description: 'Disable AI helper', type: 1, options: [] },
        { name: 'prompt', description: 'Set custom system prompt', type: 1, options: [
          { name: 'text', description: 'System prompt for AI', type: 3, required: true },
        ]},
        { name: 'model', description: 'Set AI model', type: 1, options: [
          { name: 'model', description: 'Model to use', type: 3, required: true, choices: [
            { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
            { name: 'GPT-4o', value: 'openai/gpt-4o' },
            { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
          ]},
        ]},
        { name: 'auto_reply', description: 'Toggle auto-reply to new tickets', type: 1, options: [] },
        { name: 'staff_only', description: 'Toggle staff-only AI trigger', type: 1, options: [] },
        { name: 'status', description: 'View current AI config', type: 1, options: [] },
      ],
    },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // Check premium for AI subcommands
    const isPremium = await premiumService.isPremium(interaction.guildId);
    if (sub === 'ai' && !isPremium) {
      return interaction.reply({ content: '🔒 AI ticket helper requires Aether Premium.', ephemeral: true });
    }

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

      if (sub === 'ai') {
        const aiSub = interaction.options.getSubcommand();
        const ticketServiceModule = require('../../services/tickets');

        if (aiSub === 'enable') {
          await ticketServiceModule.setAIConfig(interaction.guildId, { enabled: true });
          return interaction.reply({ content: '✅ AI helper enabled.', ephemeral: true });
        }
        if (aiSub === 'disable') {
          await ticketServiceModule.setAIConfig(interaction.guildId, { enabled: false });
          return interaction.reply({ content: '✅ AI helper disabled.', ephemeral: true });
        }
        if (aiSub === 'prompt') {
          const text = interaction.options.getString('text');
          await ticketServiceModule.setAIConfig(interaction.guildId, { system_prompt: text });
          return interaction.reply({ content: '✅ System prompt updated.', ephemeral: true });
        }
        if (aiSub === 'model') {
          const model = interaction.options.getString('model');
          await ticketServiceModule.setAIConfig(interaction.guildId, { model });
          return interaction.reply({ content: `✅ Model set to \`${model}\`.`, ephemeral: true });
        }
        if (aiSub === 'auto_reply') {
          const cfg = await ticketServiceModule.getAIConfig(interaction.guildId);
          await ticketServiceModule.setAIConfig(interaction.guildId, { auto_reply: !cfg.auto_reply });
          return interaction.reply({ content: `✅ Auto-reply ${!cfg.auto_reply ? 'enabled' : 'disabled'}.`, ephemeral: true });
        }
        if (aiSub === 'staff_only') {
          const cfg = await ticketServiceModule.getAIConfig(interaction.guildId);
          await ticketServiceModule.setAIConfig(interaction.guildId, { staff_only: !cfg.staff_only });
          return interaction.reply({ content: `✅ Staff-only ${!cfg.staff_only ? 'enabled' : 'disabled'}.`, ephemeral: true });
        }
        if (aiSub === 'status') {
          const cfg = await ticketServiceModule.getAIConfig(interaction.guildId);
          return interaction.reply({
            content: `**AI Ticket Helper**\nEnabled: ${cfg.enabled ? '✅' : '❌'}\nAuto-reply: ${cfg.auto_reply ? '✅' : '❌'}\nStaff-only: ${cfg.staff_only ? '✅' : '❌'}\nModel: \`${cfg.model}\`\nPrompt: ${cfg.system_prompt.slice(0, 200)}...`,
            ephemeral: true,
          });
        }
      }
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};