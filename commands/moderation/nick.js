/**
 * /nick — set or clear a member's nickname.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'nick',
  description: 'Set or clear a member\'s nickname',
  permissions: ['ManageNicknames'],
  botPermissions: ['ManageNicknames'],
  options: [
    user('user', 'Member to change', req()),
    str('nickname', 'New nickname (leave empty to clear)', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');

    const member = interaction.guild.members.cache.get(target.id) || (await interaction.guild.members.fetch(target.id).catch(() => null));
    if (!member) return interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    if (!member.manageable) return interaction.reply({ embeds: [errorEmbed('I cannot change that member\'s nickname.')], ephemeral: true });

    const newNick = nickname || null;
    await member.setNickname(newNick, `Changed by ${interaction.user.tag}`);

    return interaction.reply({
      embeds: [successEmbed(`${target.tag}\'s nickname is now **${newNick || target.username}**.`)],
      ephemeral: true,
    });
  },
};
