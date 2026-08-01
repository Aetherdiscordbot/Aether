/**
 * /kick — remove a member from the server (they can rejoin).
 */
const { Colors } = require('discord.js');
const moderation = require('../../services/moderation');
const permissions = require('../../services/permissions');
const { errorEmbed } = require('../../utils/discord');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'kick',
  description: 'Kick a member from this server',
  permissions: ['KickMembers'],
  botPermissions: ['KickMembers'],
  options: [
    user('user', 'Member to kick', req()),
    str('reason', 'Reason for the kick', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = interaction.guild.members.cache.get(target.id) || (await interaction.guild.members.fetch(target.id).catch(() => null));
    if (!member) return interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    if (!permissions.canActOn(interaction.member, member)) {
      return interaction.reply({ embeds: [errorEmbed('You cannot kick that member.')], ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ embeds: [errorEmbed('I cannot kick that member. Check my role position.')], ephemeral: true });
    }

    await member.kick(reason);
    const caseId = moderation.createCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'Kick', reason });
    await moderation.logModeration(interaction.guild, { action: 'Kick', target, moderator: interaction.user, reason, color: Colors.warning });

    return interaction.reply({ embeds: [moderation.moderationEmbed({ action: 'Kick', target, reason, caseId })], ephemeral: true });
  },
};
