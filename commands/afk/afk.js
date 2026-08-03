/**
 * /afk — Set your AFK status.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const afk = require('../../services/afk');

module.exports = {
  name: 'afk',
  description: 'Set or remove your AFK status',
  options: [
    { name: 'reason', description: 'AFK reason', type: 3, required: false },
  ],
  async run(client, interaction) {
    const reason = interaction.options.getString('reason') || 'AFK';
    const existing = await afk.getAFK(interaction.guildId, interaction.user.id);
    
    if (existing) {
      await afk.removeAFK(interaction.guildId, interaction.user.id);
      const embed = new EmbedBuilder()
        .setColor(0x44ff44)
        .setTitle('✅ AFK Removed')
        .setDescription(`Welcome back, ${interaction.user}!`)
        .addFields({ name: 'Was AFK for', value: `<t:${Math.floor(new Date(existing.since).getTime() / 1000)}:R>` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
    
    await afk.setAFK(interaction.guildId, interaction.user.id, interaction.options.getString('reason') || 'AFK');
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('💤 AFK Set')
      .setDescription(`You are now AFK: **${interaction.options.getString('reason') || 'AFK'}**`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};