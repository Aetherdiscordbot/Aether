/**
 * messageUpdate: edited-message logging (before → after).
 */
const logService = require('../services/logService');
const { Colors, truncate } = require('../utils/discord');

module.exports = {
  name: 'messageUpdate',
  run(client, oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!oldMessage.content && !newMessage.content) return;

    logService.sendLog(newMessage.guild, 'messageUpdate', {
      color: Colors.warning,
      title: 'Message Edited',
      description: `${newMessage.author} in ${newMessage.channel} → [jump](${newMessage.url})`,
      fields: [
        { name: 'Before', value: truncate(oldMessage.content || '*no text*', 800) || '*no text*' },
        { name: 'After', value: truncate(newMessage.content || '*no text*', 800) || '*no text*' },
      ],
      footer: { text: `Message ID: ${newMessage.id}` },
      extra: { author: { name: newMessage.author.username, iconURL: newMessage.author.displayAvatarURL() } },
    });
  },
};
