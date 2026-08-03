/**
 * /starboard — Configure starboard.
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const boards = require('../../services/boards');

module.exports = {
  name: 'starboard',
  description: 'Configure starboard',
  permissions: ['ManageGuild'],
  options: [
    { name: 'setup', description: 'Set up starboard', type: 1, options: [
      { name: 'channel', description: 'Starboard channel', type: 7, required: true, channel_types: [ChannelType.GuildText] },
      { name: 'threshold', description: 'Stars needed (default 5)', type: 4, required: false },
      { name: 'emoji', description: 'Emoji to use (default ⭐)', type: 3, required: false },
    ]},
    { name: 'disable', description: 'Disable starboard', type: 1, options: [] },
    { name: 'config', description: 'View current config', type: 1, options: [] },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const threshold = interaction.options.getInteger('threshold') || 5;
      const emoji = interaction.options.getString('emoji') || '⭐';
      await boards.setStarConfig(interaction.guildId, channel.id, threshold, emoji);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setTitle('✅ Starboard Enabled').setDescription(`Channel: ${channel}\nThreshold: ${threshold}\nEmoji: ${emoji}`).setTimestamp()] });
    }
    if (sub === 'disable') {
      await boards.setStarConfig(interaction.guildId, '', 0, '⭐');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Starboard disabled.')] });
    }
    if (sub === 'config') {
      const cfg = await boards.getStarConfig(interaction.guildId);
      if (!cfg) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Starboard not configured.')], ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('⭐ Starboard Config').addFields({ name: 'Channel', value: `<#${cfg.channel_id}>` }, { name: 'Threshold', value: cfg.threshold.toString() }, { name: 'Emoji', value: cfg.emoji }).setTimestamp()] });
    }
  },
};