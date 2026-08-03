/**
 * /suggestions — Manage suggestions.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const suggestions = require('../../services/suggestions');

module.exports = {
  name: 'suggestions',
  description: 'Manage suggestions',
  permissions: ['ManageGuild'],
  options: [
    { name: 'list', description: 'List pending suggestions', type: 1, options: [] },
    { name: 'approve', description: 'Approve a suggestion', type: 1, options: [
      { name: 'id', description: 'Suggestion ID', type: 10, required: true },
    ]},
    { name: 'deny', description: 'Deny a suggestion', type: 1, options: [
      { name: 'id', description: 'Suggestion ID', type: 10, required: true },
    ]},
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      const list = await suggestions.list(interaction.guildId);
      if (!list.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('No pending suggestions.')], ephemeral: true });
      
      const lines = list.map(s => `#${s.id} — ${s.content.slice(0, 100)} (👍 ${s.votes_up} 👎 ${s.votes_down})`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('📋 Pending Suggestions')
        .setDescription(lines.slice(0, 4000))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (sub === 'approve') {
      await suggestions.approve(interaction.guildId, interaction.options.getInteger('id'), interaction.user.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Suggestion approved.')] });
    }
    if (sub === 'deny') {
      await suggestions.deny(interaction.guildId, interaction.options.getInteger('id'), interaction.user.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Suggestion denied.')] });
    }
  },
};