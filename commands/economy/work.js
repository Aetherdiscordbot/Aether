/**
 * /work — Work for money.
 */
const { EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

const jobs = [
  'coded a bot', 'moderated a server', 'designed an embed', 'wrote documentation',
  'fixed a bug', 'deployed an app', 'reviewed code', 'answered tickets'
];

module.exports = {
  name: 'work',
  description: 'Work to earn money',
  options: [],
  async run(client, interaction) {
    const result = await economy.work(interaction.guildId, interaction.user.id);
    if (!result.ok) {
      const m = Math.ceil(result.remaining / 6e4);
      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('😴 On Cooldown')
        .setDescription(`You're tired! Try again in **${m} minute(s)**.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const embed = new EmbedBuilder()
      .setColor(0x44ff44)
      .setTitle('💼 Work Complete')
      .setDescription(`You **${job}** and earned **${result.amount.toLocaleString()}** coins!`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};