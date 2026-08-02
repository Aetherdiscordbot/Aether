/**
 * /nick — set or clear a member's nickname (free) or mass-rename (premium).
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { user, str, sub, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'nick',
  description: 'Set or clear a member\'s nickname',
  permissions: ['ManageNicknames'],
  botPermissions: ['ManageNicknames'],
  subPermissions: {
    mass: ['Administrator'],
  },
  options: [
    sub('set', 'Set a member\'s nickname', [user('user', 'Member to change', req()), str('nickname', 'New nickname (leave empty to clear)', {})]),
    sub('mass', 'Set a nickname for many members (premium)', [
      str('nickname', 'New nickname', req()),
      str('target', 'Who to rename: all, humans, bots', req({ choices: [
        { name: 'All members', value: 'all' },
        { name: 'Humans only', value: 'humans' },
        { name: 'Bots only', value: 'bots' },
      ] })),
    ]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'mass') {
      await interaction.deferReply({ ephemeral: true });
      const nickname = interaction.options.getString('nickname');
      const target = interaction.options.getString('target');

      await interaction.guild.members.fetch().catch(() => {});
      let members = [...interaction.guild.members.cache.values()];
      if (target === 'humans') members = members.filter((m) => !m.user.bot);
      if (target === 'bots') members = members.filter((m) => m.user.bot);

      let done = 0;
      for (const member of members) {
        if (!member.manageable) continue;
        try {
          await member.setNickname(nickname, `Mass rename by ${interaction.user.tag}`);
          done++;
        } catch {
          /* skip unmanageable */
        }
      }
      return interaction.editReply({
        embeds: [successEmbed(`Set nickname **${nickname}** on **${done}** member(s) (${target}).`)],
      });
    }

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
