/**
 * Verify button — grants the verified role.
 */
const verificationService = require('../modules/verification/verificationService');
const { errorEmbed, successEmbed } = require('../utils/discord');

module.exports = {
  id: 'verify',
  type: 'button',
  async run(client, interaction) {
    if (!interaction.customId.startsWith('verify:click')) return;
    const result = await verificationService.verifyMember(interaction.member);
    if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('You are now verified!')], ephemeral: true });
  },
};
