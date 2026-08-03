/**
 * /pay — Transfer money to another user.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

module.exports = {
  name: 'pay',
  description: 'Pay another user',
  options: [
    { name: 'user', description: 'User to pay', type: 6, required: true },
    { name: 'amount', description: 'Amount to pay', type: 10, required: true, min_value: 1 },
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (target.bot) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Cannot pay bots.')], ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Cannot pay yourself.')], ephemeral: true });
    
    const ok = await economy.transfer(interaction.guildId, interaction.user.id, target.id, amount);
    if (!ok) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Insufficient funds.')], ephemeral: true });
    
    const embed = new EmbedBuilder()
      .setColor(0x44ff44)
      .setTitle('💸 Payment Sent')
      .setDescription(`Paid **${amount.toLocaleString()}** coins to ${target}`)
      .addFields(
        { name: 'From', value: interaction.user.tag, inline: true },
        { name: 'To', value: target.tag, inline: true },
        { name: 'Amount', value: amount.toLocaleString(), inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};