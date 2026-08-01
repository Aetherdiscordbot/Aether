/**
 * /rank — show a user's level, XP and server rank.
 */
const levelingService = require('../../modules/leveling/levelingService');
const { user, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'rank',
  description: 'Show your (or another user\'s) rank',
  cooldown: 10,
  options: [user('user', 'User to check', {})],
  async run(client, interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    return interaction.reply({ embeds: [levelingService.buildRankEmbed(member)] });
  },
};
