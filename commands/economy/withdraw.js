/**
 * /withdraw — Withdraw money from bank.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

module.exports = {
  name: 'withdraw',
  description: 'Withdraw money from bank',
  options: [
    { name: 'amount', description: 'Amount (or "all")', type: 3, required: true },
  ],
  async run(client, interaction) {
    const input = interaction.options.getString('amount');
    const { bank } = await economy.getBalance(interaction.guildId, interaction.user.id);
    const amount = input === 'all' ? bank : parseInt(input);
    if (isNaN(amount) || amount < 1) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Invalid amount.')], ephemeral: true });
    if (amount > bank) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Insufficient bank balance.')], ephemeral: true });
    
    const ok = await economy.withdraw(interaction.guildId, interaction.user.id, amount);
    if (!ok) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Failed.')], ephemeral: true });
    
    const embed = new EmbedBuilder()
      .setColor(0x44ff44)
      .setTitle('💵 Withdrawn')
      .setDescription(`Withdrew **${amount.toLocaleString()}** coins from your bank.`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};