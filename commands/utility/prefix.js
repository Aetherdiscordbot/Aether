/**
 * /prefix — Change the server's command prefix.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const prefixService = require('../../services/prefix');

module.exports = {
  name: 'prefix',
  description: 'Change the server prefix',
  permissions: ['ManageGuild'],
  options: [
    { name: 'set', description: 'Set a new prefix', type: 1, options: [
      { name: 'prefix', description: 'New prefix (max 5 chars)', type: 3, required: true },
    ]},
    { name: 'reset', description: 'Reset to default (?)', type: 1, options: [] },
    { name: 'show', description: 'Show current prefix', type: 1, options: [] },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const prefix = interaction.options.getString('prefix');
      const result = await prefixService.setPrefix(interaction.guildId, prefix);
      if (!result.ok) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(result.error)], ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setTitle('✅ Prefix Updated').setDescription(`New prefix: \`${prefix}\``).setTimestamp()] });
    }
    if (sub === 'reset') {
      await prefixService.resetPrefix(interaction.guildId);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Prefix reset to `?`')] });
    }
    if (sub === 'show') {
      const prefix = await prefixService.getPrefix(interaction.guildId);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🔧 Current Prefix').setDescription(`\`${prefix}\``).setTimestamp()] });
    }
  },
};