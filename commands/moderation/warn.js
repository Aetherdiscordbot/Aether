/**
 * /warn — issue a formal warning (tracked per member).
 */
const { Colors } = require('discord.js');
const moderation = require('../../services/moderation');
const permissions = require('../../services/permissions');
const { errorEmbed } = require('../../utils/discord');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'warn',
  description: 'Warn a member for rule-breaking',
  permissions: ['ModerateMembers'],
  options: [
    user('user', 'Member to warn', req()),
    str('reason', 'Reason for the warning', req()),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const member = interaction.guild.members.cache.get(target.id);
    if (member && !permissions.canActOn(interaction.member, member)) {
      return interaction.reply({ embeds: [errorEmbed('You cannot warn that member.')], ephemeral: true });
    }

    const id = moderation.addWarning({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, reason });
    const total = moderation.countWarnings(interaction.guildId, target.id);

    await moderation.logModeration(interaction.guild, { action: 'Warning', target, moderator: interaction.user, reason, color: Colors.warning });

    const embed = moderation.moderationEmbed({ action: 'Warning', target, reason, caseId: id });
    embed.addFields({ name: 'Total Warnings', value: String(total), inline: true });
    await interaction.reply({ embeds: [embed], ephemeral: true });

    target.send(`⚠️ You have received a warning in **${interaction.guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${total}`).catch(() => {});
  },
};
