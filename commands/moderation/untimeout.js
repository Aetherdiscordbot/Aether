/**
 * /untimeout — remove a member's timeout.
 */
const { Colors } = require('discord.js');
const moderation = require('../../services/moderation');
const { errorEmbed } = require('../../utils/discord');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'untimeout',
  description: 'Remove a timeout from a member',
  permissions: ['ModerateMembers'],
  botPermissions: ['ModerateMembers'],
  options: [
    user('user', 'Member to release', req()),
    str('reason', 'Reason', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = interaction.guild.members.cache.get(target.id) || (await interaction.guild.members.fetch(target.id).catch(() => null));
    if (!member) return interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    if (!member.communicationDisabledUntil) {
      return interaction.reply({ embeds: [errorEmbed(`${target.tag} is not timed out.`)], ephemeral: true });
    }

    await member.timeout(null, reason);
    const caseId = moderation.createCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'Untimeout', reason });
    await moderation.logModeration(interaction.guild, { action: 'Untimeout', target, moderator: interaction.user, reason, color: Colors.success });

    return interaction.reply({ embeds: [moderation.moderationEmbed({ action: 'Untimeout', target, reason, caseId })], ephemeral: true });
  },
};
