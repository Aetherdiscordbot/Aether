/**
 * /unban — lift a ban.
 */
const { Colors } = require('discord.js');
const moderation = require('../../services/moderation');
const { errorEmbed } = require('../../utils/discord');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'unban',
  description: 'Unban a member',
  permissions: ['BanMembers'],
  botPermissions: ['BanMembers'],
  options: [
    user('user', 'User to unban', req()),
    str('reason', 'Reason', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const bans = await interaction.guild.bans.fetch().catch(() => null);
    if (!bans?.has(target.id)) {
      return interaction.reply({ embeds: [errorEmbed(`${target.tag} is not banned.`)], ephemeral: true });
    }

    await interaction.guild.bans.remove(target.id, reason);
    const caseId = moderation.createCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'Unban', reason });
    await moderation.logModeration(interaction.guild, { action: 'Unban', target, moderator: interaction.user, reason, color: Colors.success });

    return interaction.reply({ embeds: [moderation.moderationEmbed({ action: 'Unban', target, reason, caseId })], ephemeral: true });
  },
};
