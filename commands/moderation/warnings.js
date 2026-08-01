/**
 * /warnings — list a member's warnings (or all server warnings).
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moderation = require('../../services/moderation');
const { baseEmbed, Colors, infoEmbed } = require('../../utils/discord');
const { user, str, req, int } = require('../../utils/commandBuilder');
const { formatDate } = require('../../utils/time');

module.exports = {
  name: 'warnings',
  description: 'View a member\'s warnings',
  permissions: ['ModerateMembers'],
  options: [
    user('user', 'Member to inspect', {}),
    str('all', 'Show all warnings? "true" to ignore the user filter', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const all = interaction.options.getString('all') === 'true';

    let rows;
    if (all) {
      rows = interaction.guild.members.cache
        .map((m) => moderation.getWarnings(interaction.guildId, m.id))
        .flat();
    } else if (target) {
      rows = moderation.getWarnings(interaction.guildId, target.id);
    } else {
      return interaction.reply({ embeds: [infoEmbed('Specify a user with the `user` option, or pass `all: true`.' )], ephemeral: true });
    }

    if (!rows.length) {
      return interaction.reply({ embeds: [infoEmbed(target ? `${target.tag} has no warnings.` : 'No warnings in this server.')], ephemeral: true });
    }

    const embed = baseEmbed({
      color: Colors.warning,
      title: target ? `Warnings — ${target.tag}` : 'Server Warnings',
      description: rows
        .slice(0, 15)
        .map((w) => `\`#${w.id}\` **${formatDate(w.created_at)}** — <@${w.moderator_id}>${w.reason ? `\n> ${w.reason}` : ''}`)
        .join('\n\n'),
      footer: { text: `${rows.length} warning${rows.length > 1 ? 's' : ''}` },
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
