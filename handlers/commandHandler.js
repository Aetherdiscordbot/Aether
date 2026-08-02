/**
 * Command handler: discovers slash commands from commands/**, builds the
 * application command payloads, registers them, and dispatches interactions.
 */
const fs = require('fs');
const path = require('path');
const { Routes } = require('discord.js');
const { REST } = require('discord.js');
const config = require('../config/config');
const logger = require('../services/logger');
const permissions = require('../services/permissions');
const premiumService = require('../services/premium');
const { premiumRequiredEmbed, errorEmbed } = require('../utils/discord');

const commands = new Map(); // name -> command module
const cooldowns = new Map(); // "user:command" -> timestamp

const ROOT = path.resolve(__dirname, '..', 'commands');

/** Walk a directory recursively and load every .js file. */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function loadCommands() {
  commands.clear();
  const files = walk(ROOT);
  for (const file of files) {
    const mod = require(file);
    if (!mod?.name || !mod?.run) {
      logger.warn(`Skipping invalid command file: ${path.relative(ROOT, file)}`);
      continue;
    }
    commands.set(mod.name, { ...mod, file });
  }
  logger.info(`Loaded ${commands.size} slash commands`);
  return commands;
}

/** Build the payload list sent to Discord for registration. */
function buildCommandData() {
  return [...commands.values()].map((cmd) => {
    const isContextMenu = cmd.type === 'USER' || cmd.type === 'MESSAGE';
    if (isContextMenu) {
      return {
        name: cmd.name,
        type: cmd.type === 'USER' ? 2 : 3,
        dm_permission: false,
      };
    }
    return {
      name: cmd.name,
      description: cmd.description || 'No description.',
      options: cmd.options || [],
      dm_permission: cmd.dm !== true ? false : true,
    };
  });
}

/**
 * Register slash commands with Discord.
 * @param {import('discord.js').Client} client
 * @param {string|null} guildId Optional guild-scoped registration (dev).
 */
async function registerCommands(client, guildId = null) {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const data = buildCommandData();
  if (!data.length) return;

  const target = guildId
    ? Routes.applicationGuildCommands(config.clientId, guildId)
    : Routes.applicationCommands(config.clientId);

  const start = Date.now();
  try {
    const result = await rest.put(target, { body: data });
    logger.info(
      `Registered ${result.length} slash commands ${guildId ? `in guild ${guildId}` : 'globally'} (${Date.now() - start}ms)`
    );
  } catch (err) {
    logger.error(`Failed to register slash commands: ${err.message}`);
  }
}

/** Look up a command by name, optionally traversing subcommands. */
function findCommand(name) {
  return commands.get(name) || null;
}

/** Central dispatch for a chat-input interaction. */
async function dispatch(client, interaction) {
  const command = commands.get(interaction.commandName);
  if (!command) return;

  const isContextMenu = interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand();
  const subName = interaction.options?.getSubcommand?.(false) || null;

  // ── DM guard ───────────────────────────────────────────────────────────
  if (!isContextMenu && command.dm !== true && !interaction.inGuild()) {
    return interaction.reply({ embeds: [errorEmbed('This command must be used in a server.')], ephemeral: true });
  }

  // ── Owner-only commands ────────────────────────────────────────────────
  if (command.ownerOnly && !permissions.isOwner(interaction.member || interaction.user)) {
    return interaction.reply({
      embeds: [errorEmbed('Only the bot owner can use this command.')],
      ephemeral: true,
    });
  }

  // ── Owner-only subcommands ─────────────────────────────────────────────
  if (subName && command.ownerOnlySubcommands?.includes(subName) && !permissions.isOwner(interaction.member || interaction.user)) {
    return interaction.reply({
      embeds: [errorEmbed('Only the bot owner can use this command.')],
      ephemeral: true,
    });
  }

  // ── Permission checks ──────────────────────────────────────────────────
  const member = interaction.member;
  const subPerms = subName ? command.subPermissions?.[subName] : null;
  const requiredPerms = subPerms || command.permissions || [];

  if (!permissions.hasPermissions(member, requiredPerms)) {
    return interaction.reply({
      embeds: [errorEmbed(`You need ${formatPerms(requiredPerms)} to use this command.`)],
      ephemeral: true,
    });
  }

  if (interaction.inGuild() && command.botPermissions?.length) {
    const botMember = interaction.guild.members.me;
    if (!permissions.botHasPermissions(botMember, command.botPermissions)) {
      return interaction.reply({
        embeds: [errorEmbed(`I need ${formatPerms(command.botPermissions)} for this to work.`)],
        ephemeral: true,
      });
    }
  }

  // ── Premium gate ───────────────────────────────────────────────────────
  // Whole-command premium (registry) or premium subcommand (registry).
  const premiumCommands = require('../config/premiumCommands');
  const premiumSub = subName ? premiumCommands.isPremium(command.name, subName) : false;
  if ((premiumCommands.isPremium(command.name) || premiumSub) && interaction.inGuild()) {
    if (!premiumService.isPremium(interaction.guildId)) {
      return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
    }
  }

  // ── Cooldown ───────────────────────────────────────────────────────────
  if (command.cooldown > 0 && !permissions.isAdmin(member)) {
    const key = `${interaction.user.id}:${command.name}`;
    const last = cooldowns.get(key) || 0;
    const remaining = last + command.cooldown * 1000 - Date.now();
    if (remaining > 0) {
      return interaction.reply({
        embeds: [errorEmbed(`Please wait ${Math.ceil(remaining / 1000)}s before using this command again.`)],
        ephemeral: true,
      });
    }
    cooldowns.set(key, Date.now());
  }

  // ── Usage tracking (premium analytics) ─────────────────────────────────
  if (interaction.inGuild()) {
    require('../services/analytics').recordCommand(interaction.guildId);
  }

  try {
    await command.run(client, interaction);
  } catch (err) {
    logger.error(`Command /${command.name} failed: ${err.stack || err.message}`);
    const reply = {
      embeds: [errorEmbed('Something went wrong while running that command.')],
      ephemeral: true,
    };
    if (!interaction.replied && !interaction.deferred) await interaction.reply(reply).catch(() => {});
    else await interaction.followUp(reply).catch(() => {});
  }
}

function formatPerms(perms = []) {
  return perms
    .map((p) => `\`${String(p).replace(/([a-z])([A-Z])/g, '$1 $2')}\``)
    .join(', ') || 'permissions';
}

module.exports = {
  commands,
  loadCommands,
  buildCommandData,
  registerCommands,
  findCommand,
  dispatch,
};
