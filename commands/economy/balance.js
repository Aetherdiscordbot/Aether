/**
 * /balance — Check your wallet/bank balance.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

module.exports = {
  name: 'balance',
  description: 'Check your balance',
  options: [],
  async run(client, interaction) {
    const { balance, bank } = await economy.getBalance(interaction.guildId, interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('💰 Balance')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '💵 Wallet', value: balance.toLocaleString(), inline: true },
        { name: '🏦 Bank', value: bank.toLocaleString(), inline: true },
        { name: '💎 Total', value: (balance + bank).toLocaleString(), inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};