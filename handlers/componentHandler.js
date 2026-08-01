/**
 * Component handler: discovers buttons, select menus and modals from their
 * directories and dispatches interactions by the first `customId` segment.
 *
 * A component file exports { id, type, run } where `id` is matched against
 * `customId.split(':')[0]`.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');

const buttons = new Map();
const selectMenus = new Map();
const modals = new Map();

const DIRS = [
  { dir: 'buttons', map: buttons, type: 'button' },
  { dir: 'selectMenus', map: selectMenus, type: 'select' },
  { dir: 'modals', map: modals, type: 'modal' },
];

function loadComponents() {
  for (const { dir, map, type } of DIRS) {
    map.clear();
    const base = path.resolve(__dirname, '..', dir);
    if (!fs.existsSync(base)) continue;
    for (const file of fs.readdirSync(base)) {
      if (!file.endsWith('.js')) continue;
      const mod = require(path.join(base, file));
      if (!mod?.id || typeof mod.run !== 'function') {
        logger.warn(`Skipping invalid component: ${dir}/${file}`);
        continue;
      }
      map.set(mod.id, mod);
    }
    logger.info(`Loaded ${map.size} ${type} components`);
  }
}

function resolve(map, customId) {
  if (!customId) return null;
  const key = String(customId).split(':')[0];
  return map.get(key) || null;
}

async function dispatchButton(client, interaction) {
  const component = resolve(buttons, interaction.customId);
  if (component) await safeRun(client, interaction, component);
}

async function dispatchSelect(client, interaction) {
  const component = resolve(selectMenus, interaction.customId);
  if (component) await safeRun(client, interaction, component);
}

async function dispatchModal(client, interaction) {
  const component = resolve(modals, interaction.customId);
  if (component) await safeRun(client, interaction, component);
}

async function safeRun(client, interaction, component) {
  try {
    await component.run(client, interaction);
  } catch (err) {
    logger.error(`Component ${component.id} failed: ${err.stack || err.message}`);
    const reply = {
      content: '⚠️ Something went wrong processing that interaction.',
      ephemeral: true,
    };
    if (!interaction.replied && !interaction.deferred) await interaction.reply(reply).catch(() => {});
    else await interaction.followUp(reply).catch(() => {});
  }
}

module.exports = { loadComponents, dispatchButton, dispatchSelect, dispatchModal, buttons, selectMenus, modals };
