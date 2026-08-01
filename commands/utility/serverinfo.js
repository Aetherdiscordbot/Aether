/**
 * /serverinfo — detailed server information.
 */
const { baseEmbed, Colors } = require('../../utils/discord');
const { formatDate } = require('../../utils/time');

module.exports = {
  name: 'serverinfo',
  description: 'Show server information',
  aliases: ['server'],
  cooldown: 10,
  async run(client, interaction) {
    const guild = interaction.guild;
    const boostCount = guild.premiumSubscriptionCount || 0;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const channels = guild.channels.cache;
    const emojis = guild.emojis.cache;

    return interaction.reply({
      embeds: [
        baseEmbed({
          color: Colors.primary,
          title: guild.name,
          thumbnail: guild.iconURL({ size: 256 }),
          fields: [
            { name: '🆔 ID', value: guild.id, inline: true },
            { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: '📅 Created', value: formatDate(guild.createdAt), inline: true },
            { name: '👥 Members', value: `${guild.memberCount} (${bots} bots)`, inline: true },
            { name: '💬 Channels', value: `${channels.filter((c) => c.type === 0).size} text · ${channels.filter((c) => c.type === 2).size} voice`, inline: true },
            { name: '🎭 Roles', value: String(guild.roles.cache.size), inline: true },
            { name: '😀 Emojis', value: String(emojis.size), inline: true },
            { name: '✨ Boosts', value: `${boostCount} (Level ${guild.premiumTier})`, inline: true },
            { name: '📅 You joined', value: formatDate(interaction.member.joinedAt), inline: true },
          ],
          footer: { text: `Shard ${guild.shardId ?? 0} · ${guild.verificationLevel}` },
        }),
      ],
    });
  },
};
