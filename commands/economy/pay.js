/**
 * /pay — send currency to another user.
 */
const economyService = require('../../modules/economy/economyService');
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { user, int, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'pay',
  description: 'Send currency to another user',
  cooldown: 10,
  options: [user('user', 'User to pay', req()), int('amount', 'Amount to send', req({ min_value: 1 }))],
  async run(client, interaction) {
    const cfg = economyService.getConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ embeds: [errorEmbed('The economy is disabled here.')], ephemeral: true });
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (target.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed('You cannot pay yourself.')], ephemeral: true });
    const result = economyService.transfer(interaction.guildId, interaction.user.id, target.id, amount);
    if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    return interaction.reply({
      embeds: [successEmbed(`You sent **${cfg.currency}${amount.toLocaleString()}** to ${target}.`)],
    });
  },
};
