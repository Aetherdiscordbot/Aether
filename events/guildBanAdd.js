/**
 * guildBanAdd → moderation log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'guildBanAdd',
  run(client, ban) {
    logService.sendLog(ban.guild, 'moderation', {
      color: Colors.error,
      title: 'User Banned',
      description: `${ban.user} (${ban.user.tag})`,
      fields: [{ name: 'Reason', value: ban.reason || 'No reason provided' }],
      footer: { text: `ID: ${ban.user.id}` },
    });
  },
};
