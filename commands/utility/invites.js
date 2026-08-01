/**
 * /invites — show who has invited the most members.
 */
const db = require('../../database/db');
const { baseEmbed, Colors } = require('../../utils/discord');
const { user } = require('../../utils/commandBuilder');

module.exports = {
  name: 'invites',
  description: 'Show invite statistics',
  cooldown: 10,
  options: [user('user', 'Check a specific user\'s invites', {})],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');

    if (target) {
      const rows = db.prepare('SELECT code, uses, channel_id FROM invite_cache WHERE guild_id = ? AND inviter_id = ?').all(interaction.guildId, target.id);
      const total = rows.reduce((sum, r) => sum + r.uses, 0);
      if (!rows.length) return interaction.reply({ embeds: [require('../../utils/discord').infoEmbed(`${target.username} has no tracked invites yet.`)], ephemeral: true });
      const lines = rows.map((r) => `discord.gg/${r.code} → **${r.uses}** uses`).join('\n');
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: Colors.primary,
            title: `${target.username}'s Invites`,
            description: `**Total: ${total}**\n\n${lines}`,
          }),
        ],
      });
    }

    const rows = db.prepare('SELECT inviter_id, SUM(uses) AS total FROM invite_cache WHERE guild_id = ? AND inviter_id IS NOT NULL GROUP BY inviter_id ORDER BY total DESC LIMIT 10').all(interaction.guildId);
    if (!rows.length) return interaction.reply({ embeds: [require('../../utils/discord').infoEmbed('No invite data yet.')], ephemeral: true });

    const lines = rows.map((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const inviter = interaction.guild.members.cache.get(r.inviter_id)?.user || null;
      return `${medal} **${inviter ? inviter.username : r.inviter_id}** — ${r.total} invite${r.total === 1 ? '' : 's'}`;
    });

    return interaction.reply({
      embeds: [baseEmbed({ color: Colors.primary, title: '🏆 Top Inviters', description: lines.join('\n') })],
    });
  },
};
