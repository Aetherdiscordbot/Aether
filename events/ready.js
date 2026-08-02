/**
 * Fires once when the bot is ready. Displays the startup banner and wires up
 * background jobs that depend on the ready client.
 */
const config = require('../config/config');
const db = require('../database/db');
const logger = require('../services/logger');
const scheduler = require('../services/scheduler');
const premiumService = require('../services/premium');
const commandHandler = require('../handlers/commandHandler');
const chalk = require('chalk');

module.exports = {
  name: 'clientReady',
  once: true,
  run(client) {
    premiumService.setClient(client);
    client.user.setPresence(config.client.presence);

    // Main-server branding: nickname "Aether Premium".
    premiumService.ensureMainGuildBranding().catch(() => {});

    const users = new Set();
    for (const guild of client.guilds.cache.values()) {
      guild.members.cache.forEach((m) => users.add(m.id));
    }

    const banner = `
${chalk.hex('#8b5cf6').bold('  ┌─────────────────────────────────────────────┐')}
${chalk.hex('#8b5cf6').bold('  │')}  ${chalk.white.bold('Aether Online')}${' '.repeat(38 - 'Aether Online'.length)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  ├─────────────────────────────────────────────┤')}
${chalk.hex('#8b5cf6').bold('  │')}  Servers:           ${String(client.guilds.cache.size).padEnd(27)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  │')}  Users:             ${String(users.size).padEnd(27)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  │')}  Commands Loaded:   ${String(commandHandler.commands.size).padEnd(27)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  │')}  Modules Loaded:    ${String(countModules()).padEnd(27)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  │')}  Database:          ${chalk.green('Connected').padEnd(27)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  │')}  Premium System:    ${chalk.yellow('Online').padEnd(27)}${chalk.hex('#8b5cf6').bold('│')}
${chalk.hex('#8b5cf6').bold('  └─────────────────────────────────────────────┘')}`;

    logger.info(`\n${banner}\n`);
    logger.info(`Logged in as ${client.user.tag}`);

    // ── Background jobs ──────────────────────────────────────────────────
    // Retry deferred premium grants every 45s.
    scheduler.interval(45_000, () => premiumService.processPending(), 'premium-pending-grants');

    // Check due reminders every 20s.
    const reminderService = require('../services/reminders');
    scheduler.interval(20_000, () => reminderService.processDue(client), 'reminders');

    // Advance + finish giveaways every 15s.
    const giveawayService = require('../modules/giveaways/giveawayService');
    scheduler.interval(15_000, () => giveawayService.processGiveaways(client), 'giveaways');

    // Close timed polls.
    const pollService = require('../services/polls');
    scheduler.interval(20_000, () => pollService.processDue(client), 'polls');

    // Fire scheduled tasks (slowmode releases, scheduled messages).
    const scheduledTasks = require('../services/scheduledTasks');
    scheduler.interval(15_000, () => scheduledTasks.processDue(client), 'scheduled-tasks');

    // Prune expired premium rows periodically.
    scheduler.interval(6 * 60 * 60 * 1000, pruneExpiredPremium, 'premium-expiry-prune');

    // Keep analytics + task history small.
    const analyticsService = require('../services/analytics');
    scheduler.interval(24 * 60 * 60 * 1000, () => {
      analyticsService.prune();
      scheduledTasks.prune();
    }, 'analytics-prune');

    // Daily database backup (VACUUM INTO snapshot, retention 7 days).
    const backupService = require('../services/backup');
    scheduler.schedule('0 4 * * *', () => backupService.createBackup(), 'db-daily-backup');

    scheduler.startAll();
  },
};

function countModules() {
  const fs = require('fs');
  const path = require('path');
  const dir = path.resolve(__dirname, '..', 'modules');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).length;
}

function pruneExpiredPremium() {
  const rows = db.prepare('SELECT guild_id, expires_at FROM premium_servers WHERE whitelisted = 0').all();
  const now = Date.now();
  for (const row of rows) {
    if (row.expires_at && Date.parse(row.expires_at) < now) {
      db.prepare("UPDATE premium_servers SET status = 'inactive' WHERE guild_id = ?").run(row.guild_id);
      logger.info(`Premium expired for guild ${row.guild_id}`);
    }
  }
}
