/**
 * /daily — Claim your daily reward.
 */
const { EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

module.exports = {
  name: 'daily',
  description: 'Claim your daily reward',
  options: [],
  async run(client, interaction) {
    const result = await economy.daily(interaction.guildId, interaction.user.id);
    if (!result.ok) {
      const h = Math.floor(result.remaining / 36e5);
      const m = Math.floor((result.remaining % 36e5) / 6e4);
      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('⏳ Daily Cooldown')
        .setDescription(`You've already claimed your daily reward.`)
        .addFields({ name: 'Try again in', value: `${h}h ${m}m` })
        .setColor(0xff4444)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0x44ff44)
      .setTitle('✅ Daily Claimed')
      .setDescription(`You received **${result.amount.toLocaleString()}** coins!`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};