/**
 * /rank — View your XP rank.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const xp = require('../../services/xp');

module.exports = {
  name: 'rank',
  description: 'View your XP and level',
  options: [
    { name: 'user', description: 'User to check', type: 6, required: false },
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = await xp.getXP(interaction.guildId, target.id);
    
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`📊 ${target.username}'s Rank`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '💬 Text', value: `Level **${data.text_level}** (${data.text_xp.toLocaleString()} XP)`, inline: true },
        { name: '🔊 Voice', value: `Level **${data.voice_level}** (${data.voice_xp.toLocaleString()} XP)`, inline: true },
        { name: '🏆 Total', value: `${data.total_xp.toLocaleString()} XP`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};