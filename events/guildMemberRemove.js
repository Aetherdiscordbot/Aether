/**
 * guildMemberRemove: leave messages + leave logs.
 */
const settings = require('../services/settings');
const logService = require('../services/logService');
const { baseEmbed, Colors } = require('../utils/discord');
const { timestamp } = require('../utils/time');
const { renderTemplate } = require('./guildMemberAdd');

module.exports = {
  name: 'guildMemberRemove',
  run(client, member) {
    const guild = member.guild;
    const cfg = settings.getSetting(guild.id, 'welcome', { enabled: false, leaveChannelId: null, leaveMessage: 'Goodbye {user}, we will miss you.', leaveEmbed: null });

    const channel = cfg.leaveChannelId ? guild.channels.cache.get(cfg.leaveChannelId) : null;
    if (channel?.isTextBased()) {
      const embed = cfg.leaveEmbed
        ? baseEmbed({
            color: cfg.leaveEmbed.color || Colors.error,
            title: cfg.leaveEmbed.title ? renderTemplate(cfg.leaveEmbed.title, member) : undefined,
            description: cfg.leaveEmbed.description ? renderTemplate(cfg.leaveEmbed.description, member) : renderTemplate(cfg.leaveMessage, member),
            thumbnail: cfg.leaveEmbed.thumbnail || member.user.displayAvatarURL({ size: 256 }),
          })
        : baseEmbed({
            color: Colors.error,
            description: renderTemplate(cfg.leaveMessage || 'Goodbye {user}, we will miss you.', member),
            thumbnail: member.user.displayAvatarURL({ size: 256 }),
          });
      channel.send({ embeds: [embed] }).catch(() => {});
    }

    logService.sendLog(guild, 'leave', {
      color: Colors.error,
      title: 'Member Left',
      description: `${member.user} (${member.user.tag})`,
      fields: [{ name: 'Joined', value: member.joinedAt ? timestamp(member.joinedAt) : 'Unknown', inline: true }],
      footer: { text: `ID: ${member.id}` },
      extra: { author: { name: member.user.username, iconURL: member.user.displayAvatarURL() } },
    });
  },
};
