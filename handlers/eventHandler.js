/**
 * Event handler: loads every file in events/** and registers it on the client.
 * Each file exports { name, once, run(client, ...args) }.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');

function loadEvents(client) {
  const base = path.resolve(__dirname, '..', 'events');
  if (!fs.existsSync(base)) return 0;
  let count = 0;
  for (const file of fs.readdirSync(base)) {
    if (!file.endsWith('.js')) continue;
    const mod = require(path.join(base, file));
    if (!mod?.name || typeof mod.run !== 'function') {
      logger.warn(`Skipping invalid event: ${file}`);
      continue;
    }
    const handler = (...args) => {
      try {
        mod.run(client, ...args);
      } catch (err) {
        logger.error(`Event ${mod.name} error: ${err.stack || err.message}`);
      }
    };
    if (mod.once) client.once(mod.name, handler);
    else client.on(mod.name, handler);
    count++;
  }
  logger.info(`Loaded ${count} events`);
  return count;
}

module.exports = { loadEvents };
