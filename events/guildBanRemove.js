/**
 * guildBanRemove → moderation log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'guildBanRemove',
  run(client, ban) {
    logService.sendLog(ban.guild, 'moderation', {
      color: Colors.success,
      title: 'User Unbanned',
      description: `${ban.user} (${ban.user.tag})`,
      footer: { text: `ID: ${ban.user.id}` },
    });
  },
};
