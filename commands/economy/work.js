/**
 * /work — earn some currency.
 */
const economyService = require('../../modules/economy/economyService');
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { formatDuration } = require('../../utils/time');

const JOBS = [
  'worked a shift at the Aether café',
  'fixed a leaky pipe',
  'delivered some packages',
  'helped a friend move',
  'walked some dogs',
  'wrote some code',
  'mowed a lawn',
  'sold some lemonade',
];

module.exports = {
  name: 'work',
  description: 'Work to earn some currency',
  cooldown: 5,
  async run(client, interaction) {
    const cfg = economyService.getConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ embeds: [errorEmbed('The economy is disabled here.')], ephemeral: true });
    const result = economyService.work(interaction.guildId, interaction.user.id);
    if (result.error) {
      return interaction.reply({
        embeds: [errorEmbed(`You are tired. You can work again in **${formatDuration(result.retryInMs)}**.`)],
        ephemeral: true,
      });
    }
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    return interaction.reply({
      embeds: [successEmbed(`You ${job} and earned **${cfg.currency}${result.amount.toLocaleString()}**! New balance: **${cfg.currency}${result.balance.toLocaleString()}**.`)],
    });
  },
};
