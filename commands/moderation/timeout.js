/**
 * /timeout — temporarily mute a member in chat & voice.
 */
const { Colors } = require('discord.js');
const moderation = require('../../services/moderation');
const permissions = require('../../services/permissions');
const { errorEmbed } = require('../../utils/discord');
const { parseDuration, formatDuration } = require('../../utils/time');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'timeout',
  description: 'Timeout a member (e.g. /timeout user:"@x" duration:"10m")',
  permissions: ['ModerateMembers'],
  botPermissions: ['ModerateMembers'],
  options: [
    user('user', 'Member to timeout', req()),
    str('duration', 'How long (e.g. "30m", "2h", "1d")', req()),
    str('reason', 'Reason', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const duration = parseDuration(interaction.options.getString('duration'));
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!duration || duration <= 0) {
      return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use something like `30m`, `2h` or `1d`.')], ephemeral: true });
    }
    if (duration > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ embeds: [errorEmbed('Timeouts cannot exceed 28 days.')], ephemeral: true });
    }

    const member = interaction.guild.members.cache.get(target.id) || (await interaction.guild.members.fetch(target.id).catch(() => null));
    if (!member) return interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    if (!permissions.canActOn(interaction.member, member)) {
      return interaction.reply({ embeds: [errorEmbed('You cannot timeout that member.')], ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({ embeds: [errorEmbed('I cannot timeout that member. Check my role position.')], ephemeral: true });
    }

    await member.timeout(duration, reason);
    const caseId = moderation.createCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'Timeout', reason, duration: formatDuration(duration) });
    await moderation.logModeration(interaction.guild, { action: 'Timeout', target, moderator: interaction.user, reason, duration, color: Colors.warning });

    const embed = moderation.moderationEmbed({ action: 'Timeout', target, reason, caseId, duration });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
