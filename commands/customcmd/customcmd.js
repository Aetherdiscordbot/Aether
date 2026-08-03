/**
 * /customcmd — Custom commands (premium: unlimited, free: 5).
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const customCmd = require('../../services/customCommands');

module.exports = {
  name: 'customcmd',
  description: 'Manage custom commands',
  options: [
    { name: 'create', description: 'Create a custom command', type: 1, options: [
      { name: 'name', description: 'Command name', type: 3, required: true },
      { name: 'response', description: 'Response text', type: 3, required: true },
    ]},
    { name: 'delete', description: 'Delete a custom command', type: 1, options: [
      { name: 'name', description: 'Command name', type: 3, required: true },
    ]},
    { name: 'list', description: 'List custom commands', type: 1, options: [] },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const name = interaction.options.getString('name').toLowerCase();
      const response = interaction.options.getString('response');
      const result = await customCmd.create(interaction.guildId, name, response, null, interaction.user.id);
      if (!result.ok) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(result.error)], ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Custom command \`${name}\` created.`)] });
    }
    if (sub === 'delete') {
      const name = interaction.options.getString('name').toLowerCase();
      await customCmd.delete(interaction.guildId, name);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Custom command deleted.`)] });
    }
    if (sub === 'list') {
      const list = await customCmd.list(interaction.guildId);
      if (!list.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('No custom commands.')], ephemeral: true });
      const lines = list.map(c => `\`${c.name}\` — ${c.content.slice(0, 50)}`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('⚙️ Custom Commands').setDescription(lines.slice(0, 4000)).setTimestamp()], ephemeral: true });
    }
  },
};