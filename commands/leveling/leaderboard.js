/**
 * /leaderboard — top XP earners in the server.
 */
const db = require('../../database/db');
const { baseEmbed, Colors } = require('../../utils/discord');
const levelingService = require('../../modules/leveling/levelingService');

module.exports = {
  name: 'leaderboard',
  description: 'Show the server XP leaderboard',
  cooldown: 30,
  async run(client, interaction) {
    const rows = db.prepare('SELECT user_id, xp, level FROM xp WHERE guild_id = ?').all(interaction.guildId);
    if (!rows.length) return interaction.reply({ embeds: [require('../../utils/discord').infoEmbed('No XP data yet — start chatting!')], ephemeral: true });

    const ranked = rows
      .map((r) => ({ ...r, total: levelingService.totalXp(interaction.guildId, r.user_id) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const lines = ranked.map((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const user = interaction.guild.members.cache.get(r.user_id)?.user || null;
      return `${medal} **${user ? user.username : r.user_id}** — Level ${r.level} · ${r.total.toLocaleString()} XP`;
    });

    return interaction.reply({
      embeds: [
        baseEmbed({
          color: Colors.primary,
          title: '🏆 XP Leaderboard',
          description: lines.join('\n'),
          footer: { text: interaction.guild.name, iconURL: interaction.guild.iconURL() },
        }),
      ],
    });
  },
};
