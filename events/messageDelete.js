/**
 * messageDelete: deleted-message logging with content from the cache.
 */
const logService = require('../services/logService');
const { Colors, truncate } = require('../utils/discord');

module.exports = {
  name: 'messageDelete',
  run(client, message) {
    if (!message.guild || message.author?.bot) return;

    // Only log messages we actually have cached (not bulk/auto-deletes).
    if (!message.content && !message.attachments.size) return;

    logService.sendLog(message.guild, 'messageDelete', {
      color: Colors.error,
      title: 'Message Deleted',
      description: `${message.author} in ${message.channel}`,
      fields: [
        {
          name: 'Content',
          value: truncate(message.content, 900) || '*no text*',
        },
      ],
      footer: { text: `Message ID: ${message.id}` },
      extra: { author: { name: message.author.username, iconURL: message.author.displayAvatarURL() } },
    });
  },
};
