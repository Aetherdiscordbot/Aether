/**
 * /suggest — post a suggestion.
 */
const { successEmbed } = require('../../utils/discord');
const suggestionService = require('../../modules/suggestions/suggestionService');

module.exports = {
  name: 'suggest',
  description: 'Submit a suggestion to the server',
  cooldown: 60,
  options: [{ type: 3, name: 'suggestion', description: 'Your suggestion', required: true, max_length: 2000 }],
  async run(client, interaction) {
    const content = interaction.options.getString('suggestion');
    const result = await suggestionService.submitSuggestion(client, interaction.guild, interaction.user, content);
    if (result.error) return interaction.reply({ embeds: [require('../../utils/discord').errorEmbed(result.error)], ephemeral: true });
    return interaction.reply({
      embeds: [successEmbed(`Your suggestion was posted → ${result.channel}`)],
      ephemeral: true,
    });
  },
};
