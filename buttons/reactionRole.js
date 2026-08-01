/**
 * Reaction-role button — toggle a role for the clicker.
 */
const { errorEmbed, successEmbed } = require('../utils/discord');
const reactionRoleService = require('../modules/reactionroles/reactionRoleService');

module.exports = {
  id: 'reaction',
  type: 'button',
  async run(client, interaction) {
    const [, , messageId, roleId] = interaction.customId.split(':');
    const result = await reactionRoleService.toggleRole(interaction.member, messageId, roleId);
    if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    return interaction.reply({
      embeds: [successEmbed(`${result.action === 'added' ? 'You received' : 'You no longer have'} the role **${result.role.name}**.`)],
      ephemeral: true,
    });
  },
};
