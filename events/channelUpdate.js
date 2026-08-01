/**
 * Channel update (name/topic changes) → channel log.
 */
const logService = require('../services/logService');
const { Colors, truncate } = require('../utils/discord');

module.exports = {
  name: 'channelUpdate',
  run(client, oldChannel, newChannel) {
    if (!newChannel.guild) return;
    if (oldChannel.name !== newChannel.name || oldChannel.topic !== newChannel.topic) {
      logService.sendLog(newChannel.guild, 'channel', {
        color: Colors.warning,
        title: 'Channel Updated',
        description: `#${newChannel.name}`,
        fields: [
          {
            name: 'Changes',
            value:
              (oldChannel.name !== newChannel.name ? `• Name: **${oldChannel.name}** → **${newChannel.name}**\n` : '') +
              (oldChannel.topic !== newChannel.topic ? `• Topic: ${truncate(oldChannel.topic || '*none*', 200)} → ${truncate(newChannel.topic || '*none*', 200)}` : ''),
          },
        ],
        footer: { text: `ID: ${newChannel.id}` },
      });
    }
  },
};
