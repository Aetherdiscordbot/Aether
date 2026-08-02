/**
 * Aether — premium all-in-one Discord bot.
 *
 * Startup order:
 *   1. Validate environment
 *   2. Connect + migrate database
 *   3. Start the Whop payment webhook server (fulfillment works even before login)
 *   4. Build the Discord client, load commands/events/components
 *   5. Register slash commands and log in
 */
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config/config');
const logger = require('./services/logger');
const db = require('./database/db');
const chalk = require('chalk');

async function main() {
  const missing = config.getMissingEnv();
  if (missing.length) {
    logger.error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill in the values.`
    );
    process.exit(1);
  }

  // 1) Database.
  db.migrate();
  logger.info(`Database connected: ${config.dbPath}`);

  // 2) Payment server — bring the premium pipeline online first.
  const webhookServer = require('./webhooks/server');
  await webhookServer.start();

  // 3) Discord client.
  const client = new Client({ intents: config.client.intents, partials: config.client.partials, allowedMentions: config.client.allowedMentions });

  const premiumService = require('./services/premium');
  premiumService.setClient(client);
  webhookServer.setClient(client);

  // 4) Load handlers.
  const commandHandler = require('./handlers/commandHandler');
  const componentHandler = require('./handlers/componentHandler');
  const eventHandler = require('./handlers/eventHandler');

  commandHandler.loadCommands();
  componentHandler.loadComponents();
  eventHandler.loadEvents(client);

  // 5) Register commands + login.
  if (!config.skipCommandSync) {
    await commandHandler.registerCommands(client);
  } else {
    logger.info('SKIP_COMMAND_SYNC=true — skipping slash command registration');
  }

  client
    .login(config.token)
    .then(() => logger.info('Connected to Discord gateway'))
    .catch((err) => {
      logger.error(`Failed to log in: ${err.message}`);
      process.exit(1);
    });

  // Clean shutdown.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down…`);
      webhookServer.stop();
      require('./services/scheduler').stopAll();
      db.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  logger.error(`Startup failed: ${err.stack || err.message}`);
  process.exit(1);
});
