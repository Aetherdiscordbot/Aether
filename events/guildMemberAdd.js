/**
 * guildMemberAdd: welcome messages, auto-roles, security screening,
 * invite tracking and deferred premium fulfillment.
 */
const settings = require('../services/settings');
const logService = require('../services/logService');
const securityService = require('../modules/security/securityService');
const premiumService = require('../services/premium');
const { baseEmbed, Colors } = require('../utils/discord');
const { timestamp } = require('../utils/time');

module.exports = {
  name: 'guildMemberAdd',
  run(client, member) {
    if (member.guild.id === client.user.id) return;

    // Activity tracking (premium analytics).
    require('../services/analytics').recordMemberEvent(member.guild.id, 'join', member.id);

    // 1) Deferred premium fulfillment (purchased before the bot joined).
    premiumService.syncMembershipGrantedFromDiscord(member.guild);

    // 2) Security screening.
    securityService.checkMemberJoin(member).catch(() => {});

    // 3) Welcome + auto-roles.
    welcomeMember(member);

    // 4) Invite tracking.
    require('../services/invites').onJoin(member.guild, member).catch(() => {});
  },
};

async function welcomeMember(member) {
  const guild = member.guild;
  const cfg = settings.getSetting(guild.id, 'welcome', {
    enabled: false,
    channelId: null,
    welcomeMessage: 'Welcome {user} to {server}!',
    welcomeEmbed: null,
    leaveChannelId: null,
    leaveMessage: 'Goodbye {user}, we will miss you.',
    leaveEmbed: null,
    autoroleIds: [],
    autoroleEnabled: true,
  });

  // Auto-roles.
  if (cfg.autoroleEnabled && Array.isArray(cfg.autoroleIds) && cfg.autoroleIds.length) {
    const roles = cfg.autoroleIds.map((id) => guild.roles.cache.get(id)).filter(Boolean);
    const me = guild.members.me;
    const assignable = roles.filter((r) => me.roles.highest.position > r.position);
    if (assignable.length) {
      member.roles.add(assignable, 'Aether auto-role').catch(() => {});
    }
  }

  // Welcome message.
  const channel = cfg.channelId ? guild.channels.cache.get(cfg.channelId) : null;
  if (channel?.isTextBased() && cfg.enabled) {
    const text = renderTemplate(cfg.welcomeMessage, member);
    const embed = cfg.welcomeEmbed
      ? baseEmbed({
          color: cfg.welcomeEmbed.color || Colors.success,
          title: cfg.welcomeEmbed.title ? renderTemplate(cfg.welcomeEmbed.title, member) : undefined,
          description: cfg.welcomeEmbed.description ? renderTemplate(cfg.welcomeEmbed.description, member) : text,
          image: cfg.welcomeEmbed.image || member.user.displayAvatarURL({ size: 512 }),
          thumbnail: cfg.welcomeEmbed.thumbnail || member.user.displayAvatarURL({ size: 256 }),
          footer: cfg.welcomeEmbed.footer ? { text: renderTemplate(cfg.welcomeEmbed.footer, member) } : { text: `Member #${guild.memberCount}` },
        })
      : baseEmbed({
          color: Colors.success,
          description: text,
          thumbnail: member.user.displayAvatarURL({ size: 256 }),
          footer: { text: `Member #${guild.memberCount}` },
        });
    channel.send({ embeds: [embed] }).catch(() => {});
  }

  // Join log.
  logService.sendLog(guild, 'join', {
    color: Colors.success,
    title: 'Member Joined',
    description: `${member.user} (${member.user.tag})`,
    fields: [
      { name: 'Account Created', value: timestamp(member.user.createdAt), inline: true },
      { name: 'Joined', value: timestamp(member.joinedAt), inline: true },
    ],
    footer: { text: `ID: ${member.id}` },
    extra: { author: { name: member.user.username, iconURL: member.user.displayAvatarURL() } },
  });
}

/** Replace {user}, {server}, {mention}, {count} placeholders. */
function renderTemplate(template, member) {
  return String(template || '')
    .replace(/\{user\}/g, member.user.username)
    .replace(/\{mention\}/g, `<@${member.id}>`)
    .replace(/\{tag\}/g, member.user.tag)
    .replace(/\{server\}/g, member.guild.name)
    .replace(/\{count\}/g, member.guild.memberCount);
}

module.exports.renderTemplate = renderTemplate;
