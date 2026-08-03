/**
 * /leaderboard — Economy leaderboard.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../../services/economy');

module.exports = {
  name: 'leaderboard',
  description: 'View the economy leaderboard',
  options: [
    { name: 'type', description: 'Balance type', type: 3, required: false, choices: [
      { name: 'Wallet', value: 'balance' },
      { name: 'Bank', value: 'bank' },
      { name: 'Total', value: 'total' },
    ]},
  ],
  async run(client, interaction) {
    const type = interaction.options.getString('type') || 'total';
    const lb = await economy.leaderboard(interaction.guildId, 10, type === 'total' ? 'balance' : type);
    if (!lb.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('No data yet.')], ephemeral: true });
    
    const lines = lb.map((u, i) => {
      const val = type === 'bank' ? u.bank : type === 'total' ? (u.balance + u.bank) : u.balance;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} <@${u.user_id}> — **${val.toLocaleString()}**`;
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`🏆 ${type === 'bank' ? 'Bank' : type === 'total' ? 'Total' : 'Wallet'} Leaderboard`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Top 10 • ${type}` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};