/**
 * /membercount — current member count breakdown.
 */
const { baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'membercount',
  description: 'Show the server member count',
  aliases: ['mc', 'members'],
  cooldown: 15,
  async run(client, interaction) {
    const guild = interaction.guild;
    const members = guild.members.cache;
    const humans = members.filter((m) => !m.user.bot).size;
    const bots = members.filter((m) => m.user.bot).size;
    const online = members.filter((m) => m.presence?.status === 'online').size;

    const embed = baseEmbed({
      color: Colors.primary,
      title: `👥 ${guild.name}`,
      description: [
        `**Total:** ${guild.memberCount}`,
        `**Humans:** ${humans}`,
        `**Bots:** ${bots}`,
        `**Online:** ${online}`,
      ].join('\n'),
    });
    return interaction.reply({ embeds: [embed] });
  },
};
