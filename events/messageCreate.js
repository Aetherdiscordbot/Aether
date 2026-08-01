/**
 * messageCreate: leveling XP, security checks, auto-moderation, suggestion
 * handling and guild ping responses.
 */
const settings = require('../services/settings');
const logger = require('../services/logger');
const levelingService = require('../modules/leveling/levelingService');
const securityService = require('../modules/security/securityService');
const automodService = require('../modules/automod/automodService');

module.exports = {
  name: 'messageCreate',
  async run(client, message) {
    if (!message.guild || message.author.bot) return;

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
  },
};
