/**
 * /skullboard — Configure skullboard.
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const boards = require('../../services/boards');

module.exports = {
  name: 'skullboard',
  description: 'Configure skullboard',
  permissions: ['ManageGuild'],
  options: [
    { name: 'setup', description: 'Set up skullboard', type: 1, options: [
      { name: 'channel', description: 'Skullboard channel', type: 7, required: true, channel_types: [ChannelType.GuildText] },
      { name: 'threshold', description: 'Skulls needed (default 3)', type: 4, required: false },
    ]},
    { name: 'disable', description: 'Disable skullboard', type: 1, options: [] },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const threshold = interaction.options.getInteger('threshold') || 3;
      await boards.setSkullConfig(interaction.guildId, channel.id, threshold);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setTitle('✅ Skullboard Enabled').setDescription(`Channel: ${channel}\nThreshold: ${threshold}\nEmoji: 💀`).setTimestamp()] });
    }
    if (sub === 'disable') {
      await boards.setSkullConfig(interaction.guildId, '', 0);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Skullboard disabled.')] });
    }
  },
};