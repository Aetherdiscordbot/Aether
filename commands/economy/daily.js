/**
 * /daily — claim your daily reward.
 */
const economyService = require('../../modules/economy/economyService');
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { formatDuration } = require('../../utils/time');

module.exports = {
  name: 'daily',
  description: 'Claim your daily reward',
  cooldown: 5,
  async run(client, interaction) {
    const cfg = economyService.getConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ embeds: [errorEmbed('The economy is disabled here.')], ephemeral: true });
    const result = economyService.claimDaily(interaction.guildId, interaction.user.id);
    if (result.error) {
      return interaction.reply({
        embeds: [errorEmbed(`You can claim your daily again in **${formatDuration(result.retryInMs)}**.`)],
        ephemeral: true,
      });
    }
    return interaction.reply({
      embeds: [successEmbed(`You claimed **${cfg.currency}${result.amount.toLocaleString()}**! New balance: **${cfg.currency}${result.balance.toLocaleString()}**.`)],
    });
  },
};
