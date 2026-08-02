/**
 * /rep — give reputation and view the leaderboard.
 * Free: give + basic leaderboard. Premium: weekly reset + custom awards.
 */
const { baseEmbed, Colors, errorEmbed, successEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const reputation = require('../../services/reputation');
const { sub, user, str, req } = require('../../utils/commandBuilder');

const WEEK = 7 * 24 * 60 * 60 * 1000;

module.exports = {
  name: 'rep',
  description: 'Reputation system',
  cooldown: 10,
  options: [
    sub('give', 'Give reputation to a member', [
      user('user', 'Member to give reputation to', req()),
      str('reason', 'Why?', req({ max_length: 200 })),
    ]),
    sub('leaderboard', 'Top reputation holders', [user('user', 'Check a specific member', {})]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'give') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const err = reputation.giveRep({
        guildId: interaction.guildId,
        fromId: interaction.user.id,
        toId: target.id,
        reason,
      });
      if (err) return interaction.reply({ embeds: [errorEmbed(err)], ephemeral: true });
      const total = reputation.countFor(interaction.guildId, target.id);
      return interaction.reply({
        embeds: [successEmbed(`Gave reputation to ${target.tag}. They now have **${total}** point${total === 1 ? '' : 's'}.`)],
      });
    }

    const target = interaction.options.getUser('user');
    const premium = premiumService.isPremium(interaction.guildId);
    const limit = premium ? 20 : 10;

    if (target) {
      const total = reputation.countFor(interaction.guildId, target.id);
      return interaction.reply({
        embeds: [baseEmbed({ color: Colors.primary, title: `⭐ ${target.tag}`, description: `**${total}** reputation point${total === 1 ? '' : 's'}` })],
      });
    }

    const rows = reputation.leaderboard(interaction.guildId, limit);
    if (!rows.length) {
      return interaction.reply({ embeds: [errorEmbed('No reputation given yet.')], ephemeral: true });
    }

    const members = await interaction.guild.members.fetch().catch(() => new Map());
    const lines = rows.map((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const name = members.get(r.to_id)?.user?.username || r.to_id;
      return `${medal} **${name}** — ${r.n}`;
    });

    const embed = baseEmbed({
      color: Colors.primary,
      title: '⭐ Reputation Leaderboard',
      description: lines.join('\n'),
      footer: { text: premium ? 'Top 20' : 'Top 10 · Premium shows top 20' },
    });
    return interaction.reply({ embeds: [embed] });
  },
};
