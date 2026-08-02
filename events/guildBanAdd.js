/**
 * guildBanAdd → moderation log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'guildBanAdd',
  run(client, ban) {
    // Activity tracking (premium analytics).
    require('../services/analytics').recordMemberEvent(ban.guild.id, 'ban', ban.user.id);

    logService.sendLog(ban.guild, 'moderation', {
      color: Colors.error,
      title: 'User Banned',
      description: `${ban.user} (${ban.user.tag})`,
      fields: [{ name: 'Reason', value: ban.reason || 'No reason provided' }],
      footer: { text: `ID: ${ban.user.id}` },
    });
  },
};
