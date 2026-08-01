/**
 * Suggestion review buttons — approve / deny.
 */
const { errorEmbed, successEmbed } = require('../utils/discord');
const suggestionService = require('../modules/suggestions/suggestionService');

module.exports = {
  id: 'suggestion',
  type: 'button',
  async run(client, interaction) {
    const [, action, id] = interaction.customId.split(':');
    const cfg = suggestionService.getConfig(interaction.guildId);

    const canReview = interaction.member.permissions.has('ManageGuild') || interaction.member.permissions.has('ManageMessages');
    if (!canReview) return interaction.reply({ embeds: [errorEmbed('Only staff with Manage Messages can review suggestions.')], ephemeral: true });

    const status = action === 'approve' ? 'approved' : 'denied';
    const result = await suggestionService.reviewSuggestion(client, interaction.guild, id, status, interaction.user, '');
    if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Suggestion ${status}.`)], ephemeral: true });
  },
};
