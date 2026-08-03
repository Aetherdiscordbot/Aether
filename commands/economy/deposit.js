/**
 * /deposit — Deposit money to bank.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

module.exports = {
  name: 'deposit',
  description: 'Deposit money to bank',
  options: [
    { name: 'amount', description: 'Amount (or "all")', type: 3, required: true },
  ],
  async run(client, interaction) {
    const input = interaction.options.getString('amount');
    const { balance } = await economy.getBalance(interaction.guildId, interaction.user.id);
    const amount = input === 'all' ? balance : parseInt(input);
    if (isNaN(amount) || amount < 1) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Invalid amount.')], ephemeral: true });
    if (amount > balance) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Insufficient wallet balance.')], ephemeral: true });
    
    const ok = await economy.deposit(interaction.guildId, interaction.user.id, amount);
    if (!ok) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Failed.')], ephemeral: true });
    
    const embed = new EmbedBuilder()
      .setColor(0x44ff44)
      .setTitle('🏦 Deposited')
      .setDescription(`Deposited **${amount.toLocaleString()}** coins to your bank.`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};