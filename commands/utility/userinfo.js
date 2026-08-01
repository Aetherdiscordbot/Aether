/**
 * /userinfo — detailed user information.
 */
const { baseEmbed, Colors } = require('../../utils/discord');
const { formatDate, relativeTimestamp } = require('../../utils/time');
const { user } = require('../../utils/commandBuilder');

module.exports = {
  name: 'userinfo',
  description: 'Show information about a user',
  aliases: ['whois', 'ui'],
  cooldown: 10,
  options: [user('user', 'User to inspect', {})],
  async run(client, interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const roles = member?.roles.cache.filter((r) => r.id !== interaction.guild.id);

    const fields = [
      { name: '🆔 ID', value: target.id, inline: true },
      { name: '🤖 Bot', value: target.bot ? 'Yes' : 'No', inline: true },
      { name: '📅 Account Created', value: `${relativeTimestamp(target.createdAt)} (${formatDate(target.createdAt, false)})`, inline: false },
      ...(member
        ? [
            { name: '📅 Joined', value: `${relativeTimestamp(member.joinedAt)} (${formatDate(member.joinedAt, false)})`, inline: false },
            { name: '🎭 Roles', value: roles?.size ? roles.map((r) => `<@&${r.id}>`).join(' ').slice(0, 1024) : 'None', inline: false },
            { name: '🏅 Top Role', value: member.roles.highest.toString(), inline: true },
            { name: '🔇 Timed out', value: member.communicationDisabledUntil ? 'Yes' : 'No', inline: true },
          ]
        : []),
    ];

    return interaction.reply({
      embeds: [
        baseEmbed({
          color: member?.displayColor || Colors.primary,
          author: { name: target.tag, iconURL: target.displayAvatarURL() },
          thumbnail: target.displayAvatarURL({ size: 256 }),
          fields,
          footer: { text: `Joined ${member?.joinedAt ? formatDate(member.joinedAt, false) : '—'}` },
        }),
      ],
    });
  },
};
