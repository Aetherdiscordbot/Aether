/**
 * guildBanRemove → moderation log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'guildBanRemove',
  run(client, ban) {
    // Activity tracking (premium analytics).
    require('../services/analytics').recordMemberEvent(ban.guild.id, 'unban', ban.user.id);

    logService.sendLog(ban.guild, 'moderation', {
      color: Colors.success,
      title: 'User Unbanned',
      description: `${ban.user} (${ban.user.tag})`,
      footer: { text: `ID: ${ban.user.id}` },
    });
  },
};
