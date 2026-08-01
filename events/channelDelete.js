/**
 * Channel delete → channel log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'channelDelete',
  run(client, channel) {
    if (!channel.guild) return;
    logService.sendLog(channel.guild, 'channel', {
      color: Colors.error,
      title: 'Channel Deleted',
      description: `#${channel.name || 'unknown'}${channel.isVoiceBased() ? ' (voice)' : ''}`,
      footer: { text: `ID: ${channel.id}` },
    });
  },
};
