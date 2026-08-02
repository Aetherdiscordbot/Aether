/**
 * /stats — server statistics overview.
 */
const { baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'stats',
  description: 'Server statistics',
  cooldown: 15,
  async run(client, interaction) {
    const guild = interaction.guild;
    const members = guild.members.cache;
    const humans = members.filter((m) => !m.user.bot).size;
    const bots = members.filter((m) => m.user.bot).size;
    const online = members.filter((m) => m.presence?.status === 'online').size;
    const voice = members.filter((m) => m.voice.channelId).size;
    const boosters = guild.premiumSubscriptionCount || 0;
    const level = guild.premiumTier || 0;

    const embed = baseEmbed({
      color: Colors.primary,
      title: `📊 ${guild.name} — Stats`,
      fields: [
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '🧑 Humans', value: `${humans}`, inline: true },
        { name: '🤖 Bots', value: `${bots}`, inline: true },
        { name: '🟢 Online', value: `${online}`, inline: true },
        { name: '🔊 In voice', value: `${voice}`, inline: true },
        { name: '📁 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '💎 Boosts', value: `${boosters} (level ${level})`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      ],
    });
    return interaction.reply({ embeds: [embed] });
  },
};
