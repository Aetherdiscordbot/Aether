/**
 * /counting — Configure the counting game.
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const counting = require('../../services/counting');

module.exports = {
  name: 'counting',
  description: 'Counting game setup',
  permissions: ['ManageGuild'],
  options: [
    { name: 'setup', description: 'Set up counting channel', type: 1, options: [
      { name: 'channel', description: 'Channel for counting', type: 7, required: true, channel_types: [ChannelType.GuildText] },
    ]},
    { name: 'stats', description: 'View counting stats', type: 1, options: [] },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      await counting.setConfig(interaction.guildId, channel.id);
      const embed = new EmbedBuilder()
        .setColor(0x44ff44)
        .setTitle('✅ Counting Configured')
        .setDescription(`Counting channel set to ${channel}`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
    if (sub === 'stats') {
      const cfg = await counting.getConfig(interaction.guildId);
      if (!cfg) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Counting not configured.')], ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🔢 Counting Stats')
        .addFields(
          { name: 'Channel', value: `<#${cfg.channel_id}>`, inline: true },
          { name: 'Current Count', value: cfg.current_count.toString(), inline: true },
          { name: 'Record', value: cfg.record.toString(), inline: true },
          { name: 'Last Counter', value: cfg.last_user_id ? `<@${cfg.last_user_id}>` : 'None', inline: true }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  },
};