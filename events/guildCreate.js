/**
 * guildCreate: refresh invite cache + retry deferred premium grants for the
 * newly-available server.
 */
const logger = require('../services/logger');
const config = require('../config/config');
const invites = require('../services/invites');
const premiumService = require('../services/premium');

module.exports = {
  name: 'guildCreate',
  run(client, guild) {
    logger.info(`Added to guild: ${guild.name} (${guild.id})`);
    invites.refreshGuild(guild).catch(() => {});
    premiumService.syncMembershipGrantedFromDiscord(guild);
    if (guild.id === config.mainGuildId) {
      premiumService.ensureMainGuildBranding().catch(() => {});
    }
  },
};
