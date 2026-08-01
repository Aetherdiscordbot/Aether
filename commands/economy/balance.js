/**
 * /balance — check a user's balance.
 */
const economyService = require('../../modules/economy/economyService');
const { user } = require('../../utils/commandBuilder');
const { baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'balance',
  description: 'Check your (or another user\'s) balance',
  aliases: ['bal'],
  cooldown: 5,
  options: [user('user', 'User to check', {})],
  async run(client, interaction) {
    const cfg = economyService.getConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ embeds: [require('../../utils/discord').errorEmbed('The economy is disabled here.')], ephemeral: true });
    const target = interaction.options.getUser('user') || interaction.user;
    const balance = economyService.getBalance(interaction.guildId, target.id).balance;
    return interaction.reply({
      embeds: [
        baseEmbed({
          color: Colors.primary,
          title: `${target.username}'s Wallet`,
          description: `${cfg.currency} **${balance.toLocaleString()}**`,
          thumbnail: target.displayAvatarURL(),
        }),
      ],
    });
  },
};
