/**
 * guildMemberUpdate: nickname + role-change logging.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'guildMemberUpdate',
  run(client, oldMember, newMember) {
    if (newMember.user.bot) return;
    if (oldMember.nickname !== newMember.nickname) {
      logService.sendLog(newMember.guild, 'nickname', {
        color: Colors.info,
        title: 'Nickname Changed',
        description: `${newMember.user}`,
        fields: [
          { name: 'Before', value: oldMember.nickname || newMember.user.username, inline: true },
          { name: 'After', value: newMember.nickname || newMember.user.username, inline: true },
        ],
        footer: { text: `ID: ${newMember.id}` },
      });
    }

    // Role changes (add/remove).
    const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    if (added.size || removed.size) {
      const fields = [];
      if (added.size) fields.push({ name: 'Added', value: [...added.values()].map((r) => r.toString()).join(', ') });
      if (removed.size) fields.push({ name: 'Removed', value: [...removed.values()].map((r) => r.toString()).join(', ') });
      logService.sendLog(newMember.guild, 'member', {
        color: Colors.info,
        title: 'Member Roles Updated',
        description: `${newMember.user}`,
        fields,
        footer: { text: `ID: ${newMember.id}` },
      });
    }
  },
};
