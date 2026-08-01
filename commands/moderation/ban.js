/**
 * /ban — permanently ban a member.
 */
const { Colors } = require('discord.js');
const moderation = require('../../services/moderation');
const permissions = require('../../services/permissions');
const { errorEmbed, baseEmbed } = require('../../utils/discord');
const { user, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'ban',
  description: 'Ban a member from this server',
  permissions: ['BanMembers'],
  botPermissions: ['BanMembers'],
  options: [
    user('user', 'Member to ban', req()),
    str('reason', 'Reason for the ban', {}),
    str('duration', 'Optional evidence duration (e.g. "7d")', {}),
  ],
  async run(client, interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = interaction.guild.members.cache.get(target.id) || (await interaction.guild.members.fetch(target.id).catch(() => null));
    if (member && !permissions.canActOn(interaction.member, member)) {
      return interaction.reply({ embeds: [errorEmbed('You cannot ban that member — they are higher ranked than you.')], ephemeral: true });
    }
    if (member && !member.bannable) {
      return interaction.reply({ embeds: [errorEmbed('I cannot ban that member. Check my role position.')], ephemeral: true });
    }

    await interaction.deferReply();

    const caseId = moderation.createCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'Ban', reason });

    let evidenceDeleted = 0;
    if (member && interaction.options.getString('duration')) {
      const { parseDuration } = require('../../utils/time');
      const ms = parseDuration(interaction.options.getString('duration'));
      if (ms) {
        const after = new Date(Date.now() - ms);
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const toDelete = messages.filter((m) => m.author.id === target.id && m.createdAt > after);
        evidenceDeleted = toDelete.size;
        await interaction.channel.bulkDelete(toDelete).catch(() => {});
      }
    }

    await interaction.guild.bans.create(target.id, { reason: `${reason} — by ${interaction.user.tag} (case #${caseId})` });

    await moderation.logModeration(interaction.guild, {
      action: 'Ban',
      target,
      moderator: interaction.user,
      reason,
      color: Colors.error,
    });

    const embed = moderation.moderationEmbed({ action: 'Ban', target, reason, caseId });
    if (evidenceDeleted) embed.addFields({ name: 'Evidence', value: `${evidenceDeleted} message(s) purged` });
    return interaction.editReply({ embeds: [embed] });
  },
};
