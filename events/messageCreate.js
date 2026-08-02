/**
 * messageCreate: leveling XP, security checks, auto-moderation, suggestion
 * handling and guild ping responses.
 */
const settings = require('../services/settings');
const logger = require('../services/logger');
const permissions = require('../services/permissions');
const levelingService = require('../modules/leveling/levelingService');
const securityService = require('../modules/security/securityService');
const automodService = require('../modules/automod/automodService');
const autoResponses = require('../services/autoResponses');
const analytics = require('../services/analytics');
const { errorEmbed } = require('../utils/discord');

/** Owner-only prefix commands (kept out of slash registration). */
const PREFIX = '?';
const prefixCommands = {
  setupserver: require('../handlers/setupserver'),
};

module.exports = {
  name: 'messageCreate',
  async run(client, message) {
    if (!message.guild || message.author.bot) return;

    // ── Owner-only prefix commands (?setupserver) ─────────────────────────
    if (message.content.startsWith(PREFIX)) {
      const [name] = message.content.slice(PREFIX.length).trim().split(/\s+/);
      const cmd = prefixCommands[name?.toLowerCase()];
      if (cmd) {
        if (!permissions.isOwner(message.author)) return;
        try {
          await cmd.run(client, message);
        } catch (err) {
          logger.error(`?${cmd.name} failed: ${err.stack || err.message}`);
          message.channel.send({ embeds: [errorEmbed('Something went wrong running that command.')] }).catch(() => {});
        }
        return;
      }
    }

    // Activity tracking (premium analytics).
    analytics.recordMessage(message.guild.id);

    // XP (async fire-and-forget so level announcements never block the pipeline).
    try {
      const result = levelingService.handleMessage(message);
      if (result?.leveledUp && message.member) {
        const cfg = levelingService.getConfig(message.guild.id);
        levelingService.applyRewards(message.member, result.newLevel).catch(() => {});
        if (cfg.announcement !== 'none') {
          const text = `🎉 ${message.author} reached **level ${result.newLevel}**!`;
          if (cfg.announcement === 'dm') {
            message.author.send(text).catch(() => {});
          } else if (cfg.announceChannel) {
            message.guild.channels.cache.get(cfg.announceChannel)?.send(text).catch(() => {});
          } else {
            message.channel.send(text).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.debug(`Leveling error: ${err.message}`);
    }

    // Webhook abuse check.
    if (message.webhookId && securityService.checkWebhookMessage(message)) return;

    // Security checks (spam/mention/invite).
    try {
      await securityService.checkMessage(message);
    } catch { /* handled upstream */ }

    // Auto-moderation.
    try {
      await automodService.checkMessage(message);
    } catch (err) {
      logger.debug(`Auto-mod error: ${err.message}`);
    }

    // Auto-responses.
    try {
      autoResponses.check(message);
    } catch (err) {
      logger.debug(`Auto-response error: ${err.message}`);
    }
  },
};
