/**
 * /suggest — Create a suggestion.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const suggestions = require('../../services/suggestions');

module.exports = {
  name: 'suggest',
  description: 'Submit a suggestion',
  options: [
    { name: 'content', description: 'Your suggestion', type: 3, required: true },
  ],
  async run(client, interaction) {
    const content = interaction.options.getString('content');
    const suggestion = await suggestions.create(interaction.guildId, interaction.user.id, content, '');
    
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('💡 New Suggestion')
      .setDescription(content)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: `Suggestion #${suggestion.id}` })
      .setTimestamp();
    
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await suggestions.vote(interaction.guildId, suggestion.id, interaction.user.id, true);
    await msg.react('⬆️');
    await msg.react('⬇️');
  },
};