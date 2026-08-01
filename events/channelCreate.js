/**
 * Channel lifecycle events → channel log.
 */
const logService = require('../services/logService');
const { Colors, truncate } = require('../utils/discord');

function channelLabel(channel) {
  if (channel.isThread()) return `Thread ${channel.name}`;
  if (channel.isVoiceBased()) return `Voice ${channel.name}`;
  return `Channel #${channel.name}`;
}

module.exports = {
  name: 'channelCreate',
  run(client, channel) {
    if (!channel.guild) return;
    logService.sendLog(channel.guild, 'channel', {
      color: Colors.success,
      title: 'Channel Created',
      description: `${channelLabel(channel)}`,
      footer: { text: `ID: ${channel.id}` },
    });
  },
};
