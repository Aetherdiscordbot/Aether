/**
 * /remind — Set a reminder.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const reminders = require('../../services/reminders');

module.exports = {
  name: 'remind',
  description: 'Set a reminder',
  options: [
    { name: 'time', description: 'When to remind (e.g., 1h, 30m, 1d)', type: 3, required: true },
    { name: 'message', description: 'What to remind you about', type: 3, required: true },
  ],
  async run(client, interaction) {
    const timeStr = interaction.options.getString('time');
    const message = interaction.options.getString('message');
    
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Invalid time format. Use: 1s, 5m, 1h, 2d')], ephemeral: true });
    
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const remindAt = new Date(Date.now() + parseInt(match[1]) * multipliers[match[2]]).toISOString();
    
    await reminders.create(interaction.guildId, interaction.user.id, interaction.channelId, message, remindAt);
    
    const embed = new EmbedBuilder()
      .setColor(0x44ff44)
      .setTitle('⏰ Reminder Set')
      .setDescription(`I'll remind you in **${timeStr}**`)
      .addFields({ name: 'Reminder', value: message })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};