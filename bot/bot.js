/**
 * Discord bot setup with all event handlers.
 */
const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../services/logger');
const premiumService = require('../services/premium');
const permissions = require('../services/permissions');
const prefixService = require('../services/prefix');
const xp = require('../services/xp');
const afk = require('../services/afk');
const counting = require('../services/counting');
const suggestions = require('../services/suggestions');
const reminders = require('../services/reminders');
const boards = require('../services/boards');
const giveaways = require('../services/giveaways');
const automod = require('../services/automod');
const customCmd = require('../services/customCommands');
const tickets = require('../services/tickets');
const aiModeration = require('../services/aiModeration');
const ai = require('../services/ai');
const embedTemplates = require('../services/embedTemplates');
const economy = require('../services/economy');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const commands = new Collection();
const cooldowns = new Collection();
const ROOT = path.resolve(__dirname, '..', 'commands');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function loadCommands() {
  commands.clear();
  for (const file of walk(ROOT)) {
    const mod = require(file);
    if (!mod?.name || !mod?.run) {
      logger.warn(`Skipping invalid command: ${path.relative(ROOT, file)}`);
      continue;
    }
    commands.set(mod.name, { ...mod, file });
  }
  logger.info(`Loaded ${commands.size} slash commands`);
  return commands;
}

function buildCommandData() {
  return [...commands.values()].map(cmd => {
    const isContextMenu = cmd.type === 2 || cmd.type === 3;
    if (isContextMenu) {
      return { name: cmd.name, type: cmd.type, dm_permission: false };
    }
    return {
      name: cmd.name,
      description: cmd.description || 'No description.',
      options: cmd.options || [],
      dm_permission: cmd.dm === true,
    };
  });
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const data = buildCommandData();
  if (!data.length) return;

  if (config.skipCommandSync) {
    logger.info('SKIP_COMMAND_SYNC=true — skipping registration');
    return;
  }

  // Register globally so commands work in all servers
  const target = Routes.applicationCommands(config.clientId);

  try {
    const result = await rest.put(target, { body: data });
    logger.info(`Registered ${result.length} slash commands globally`);
  } catch (e) {
    logger.error(`Failed to register commands: ${e.message}`);
  }
}

/** Remove any guild-scoped commands so global commands don't show twice. */
async function cleanupGuildCommands(client) {
  const rest = new REST({ version: '10' }).setToken(config.token);
  for (const guild of client.guilds.cache.values()) {
    try {
      const existing = await rest.get(Routes.applicationGuildCommands(config.clientId, guild.id));
      if (existing.length) {
        await rest.put(Routes.applicationGuildCommands(config.clientId, guild.id), { body: [] });
        logger.info(`Cleared ${existing.length} guild-scoped commands in ${guild.id}`);
      }
    } catch (e) {
      logger.warn(`Failed to clear guild commands in ${guild.id}: ${e.message}`);
    }
  }
}

const prefixCommands = new Map();

function loadPrefixCommands() {
  prefixCommands.clear();
  for (const file of walk(ROOT)) {
    const mod = require(file);
    if (mod?.name && mod?.run && mod.prefix !== false) {
      prefixCommands.set(mod.name, mod);
    }
  }
}

async function startBot() {
  loadCommands();
  loadPrefixCommands();
  await registerCommands();

  // ── Interaction handler (slash commands + buttons) ──
  client.on('interactionCreate', async interaction => {
    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        const cmd = commands.get(interaction.commandName);
        if (!cmd) return;

        if (cmd.dm !== true && !interaction.inGuild()) {
          return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
        }
        if (cmd.premium && interaction.inGuild()) {
          const prem = await premiumService.isPremium(interaction.guildId);
          if (!prem) return interaction.reply({ content: '🔒 This command requires Aether Premium.', ephemeral: true });
        }
        const perms = cmd.permissions || [];
        if (!permissions.hasPermissions(interaction.member, perms)) {
          return interaction.reply({ content: `Missing permissions: ${perms.join(', ')}`, ephemeral: true });
        }
        if (cmd.cooldown > 0) {
          const key = `${interaction.user.id}:${cmd.name}`;
          const last = cooldowns.get(key) || 0;
          const remaining = last + cmd.cooldown * 1000 - Date.now();
          if (remaining > 0) return interaction.reply({ content: `Wait ${Math.ceil(remaining / 1000)}s.`, ephemeral: true });
          cooldowns.set(key, Date.now());
        }
        try {
          await cmd.run(client, interaction);
        } catch (e) {
          logger.error(`Command /${cmd.name} failed: ${e.stack || e.message}`);
          const msg = { content: 'Something went wrong.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }

      // Buttons
      if (interaction.isButton()) {
        if (!interaction.customId.startsWith('ticket:') && !interaction.customId.startsWith('sug:') && !interaction.customId.startsWith('giveaway:')) return;
        
        const parts = interaction.customId.split(':');
        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });

        // Ticket buttons
        if (interaction.customId.startsWith('ticket:')) {
          const [, action, category] = interaction.customId.split(':');
          if (action === 'create') {
            const channel = await tickets.createTicket(guild, interaction.user, category);
            return interaction.reply({ content: `✅ Ticket created: <#${channel.id}>`, ephemeral: true });
          }
          if (action === 'close') {
            await tickets.closeTicket(guild, interaction.channel, interaction.user, 'Closed via button');
            return interaction.reply({ content: '🔒 Ticket closed.', ephemeral: true });
          }
          if (action === 'claim') {
            await tickets.claimTicket(guild, interaction.channel, interaction.user);
            return interaction.reply({ content: '📋 Ticket claimed.', ephemeral: true });
          }
          if (action === 'delete') {
            await tickets.deleteTicket(interaction.channel);
            return interaction.reply({ content: '🗑️ Ticket deleted.', ephemeral: true });
          }
        }

        // Suggestion voting
        if (interaction.customId.startsWith('sug:')) {
          const [, action, id] = interaction.customId.split(':');
          if (action === 'up') {
            await suggestions.vote(interaction.guildId, id, interaction.user.id, true);
            return interaction.reply({ content: '👍 Voted up!', ephemeral: true });
          }
          if (action === 'down') {
            await suggestions.vote(interaction.guildId, id, interaction.user.id, false);
            return interaction.reply({ content: '👎 Voted down!', ephemeral: true });
          }
        }

        // Giveaway enter
        if (interaction.customId.startsWith('giveaway:')) {
          const [, action, msgId] = interaction.customId.split(':');
          if (action === 'enter') {
            return interaction.reply({ content: '🎉 Entered!', ephemeral: true });
          }
        }
      }
    } catch (e) {
      logger.error(`Interaction handler error: ${e.stack || e.message}`);
    }
  });

  // ── Prefix command handler ──
  loadPrefixCommands();

  // ── Message handler ──
  client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // AFK handling
    if (message.mentions.users.size) {
      for (const user of message.mentions.users.values()) {
        const afkData = await afk.getAFK(message.guild.id, user.id);
        if (afkData) {
          const embed = new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('💤 User is AFK')
            .setDescription(`**${user.tag}** is AFK: ${afkData.reason}`)
            .addFields({ name: 'Since', value: `<t:${Math.floor(new Date(afkData.since).getTime() / 1000)}:R>` })
            .setTimestamp();
          message.reply({ embeds: [embed] });
        }
      }
    }
    const selfAfk = await afk.getAFK(message.guild.id, message.author.id);
    if (selfAfk) {
      await afk.removeAFK(message.guild.id, message.author.id);
      const embed = new EmbedBuilder()
        .setColor(0x44ff44)
        .setTitle('✅ AFK Removed')
        .setDescription(`Welcome back, ${message.author}!`);
      message.reply({ embeds: [embed] });
    }

    // Counting game
    const countingCfg = await counting.getConfig(message.guild.id);
    if (countingCfg && message.channel.id === countingCfg.channel_id) {
      const num = parseInt(message.content.trim());
      if (!isNaN(num)) {
        const result = await counting.handleCount(message.guild.id, message.author.id, num);
        if (!result.valid) {
          message.delete().catch(() => {});
          const embed = new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('❌ Wrong Number')
            .setDescription(result.reason)
            .setTimestamp();
          message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        } else if (result.count === result.record) {
          const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🎉 New Record!')
            .setDescription(`Count: **${result.count}** — New record!`)
            .setTimestamp();
          message.channel.send({ embeds: [embed] });
        }
      }
    }

    // Custom commands + Prefix commands (unified)
    const prefix = await prefixService.getPrefix(message.guild.id);
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();

      // Custom commands
      const cc = await customCmd.get(message.guild.id, cmdName);
      if (cc) {
        await customCmd.incrementUse(message.guild.id, cmdName);
        const embed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setDescription(cc.content)
          .setTimestamp();
        if (cc.embed) return message.reply({ embeds: [cc.embed] });
        return message.reply({ embeds: [embed] });
      }

      // Prefix commands
      const cmd = prefixCommands.get(cmdName);
      if (cmd) {
        const perms = cmd.permissions || [];
        if (!require('./services/permissions').hasPermissions(message.member, perms)) {
          return message.reply({ content: `Missing permissions: ${perms.join(', ')}` });
        }
        if (cmd.premium) {
          const prem = await premiumService.isPremium(message.guild.id);
          if (!prem) return message.reply({ content: '🔒 This command requires Aether Premium.' });
        }
        if (cmd.cooldown > 0) {
          const key = `${message.author.id}:${cmdName}`;
          const last = cooldowns.get(key) || 0;
          const remaining = last + cmd.cooldown * 1000 - Date.now();
          if (remaining > 0) return message.reply({ content: `Wait ${Math.ceil(remaining / 1000)}s.` });
          cooldowns.set(key, Date.now());
        }
        try {
          await cmd.run(client, { ...message, options: { getString: () => args.join(' '), getInteger: () => parseInt(args[0]), getUser: () => message.mentions.users.first() } });
        } catch (e) {
          logger.error(`Prefix command ${cmdName} failed: ${e.stack || e.message}`);
        }
        return;
      }
    }

    // Text XP
    const xpResult = await xp.addTextXP(message.guild.id, message.author.id);
    if (xpResult?.leveledUp) {
      const embed = new EmbedBuilder()
        .setColor(0x44ff44)
        .setTitle('🆙 Level Up!')
        .setDescription(`Congratulations ${message.author}, you reached **Text Level ${xpResult.level}**!`)
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    // AutoMod
    await automod.checkMessage(message);

    // AI Moderation (premium)
    const aiMod = await aiModeration.moderateContent(message);
    if (aiMod?.action !== 'none') {
      // Handle AI moderation action
    }
  });

  // ── Voice state update (voice XP) ──
  const voiceStates = new Map();

  client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.guild) return;
    const userId = newState.id;
    const guildId = newState.guild.id;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      voiceStates.set(userId, Date.now());
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceStates.get(userId);
      if (joinTime) {
        const minutes = Math.floor((Date.now() - joinTime) / 60000);
        if (minutes > 0) {
          await xp.addVoiceXP(guildId, userId, minutes);
        }
      }
      voiceStates.delete(userId);
    }

    // Moved channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const joinTime = voiceStates.get(userId);
      if (joinTime) {
        const minutes = Math.floor((Date.now() - joinTime) / 60000);
        if (minutes > 0) {
          await xp.addVoiceXP(guildId, userId, minutes);
        }
      }
      voiceStates.set(userId, Date.now());
    }

    // Self-mute/deafen doesn't count
    if (newState.selfMute || newState.selfDeaf) {
      voiceStates.delete(userId);
    }
  });

  // ── Reaction handlers ──
  client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});

    // Starboard
    await boards.handleReaction(reaction.message, reaction, user, 'star');
    // Skullboard
    await boards.handleReaction(reaction.message, reaction, user, 'skull');

    // Suggestion voting (legacy emoji reactions)
    if (reaction.emoji.name === '⬆️' || reaction.emoji.name === '⬇️') {
      const message = reaction.message;
      if (message.embeds[0]?.footer?.text?.startsWith('Suggestion #')) {
        const id = message.embeds[0].footer.text.match(/#(\d+)/)?.[1];
        if (id) {
          await suggestions.vote(message.guild.id, id, user.id, reaction.emoji.name === '⬆️');
        }
      }
    }

    // Giveaway enter
    if (reaction.emoji.name === '🎉') {
      const message = reaction.message;
      if (message.embeds[0]?.title === '🎉 GIVEAWAY') {
        // Giveaway entry handled by giveaway service
      }
    }
  });

  // ── Reminder processing loop ──
  setInterval(async () => {
    try {
      const due = await reminders.getDue();
      for (const rem of due) {
        const guild = client.guilds.cache.get(rem.guild_id);
        if (!guild) continue;
        const channel = guild.channels.cache.get(rem.channel_id);
        if (!channel) continue;
        const member = await guild.members.fetch(rem.user_id).catch(() => null);
        
        const embed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle('⏰ Reminder')
          .setDescription(rem.content)
          .setTimestamp();
        
        if (member) {
          channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
        } else {
          channel.send({ content: `<@${rem.user_id}>`, embeds: [embed] }).catch(() => {});
        }
        await reminders.markSent(rem.id);
      }
    } catch (e) {
      logger.error(`Reminder loop error: ${e.message}`);
    }
  }, 30000);

  // ── Giveaway ending loop ──
  setInterval(async () => {
    try {
      const due = await giveaways.getDue();
      for (const gw of due) {
        const guild = client.guilds.cache.get(gw.guild_id);
        if (!guild) continue;
        const channel = guild.channels.cache.get(gw.channel_id);
        if (!channel) continue;
        const message = await channel.messages.fetch(gw.message_id).catch(() => null);
        if (!message) continue;

        const reactions = message.reactions.cache.get('🎉');
        const users = reactions ? await reactions.users.fetch() : new Collection();
        const entries = users.filter(u => !u.bot).map(u => u.id);
        
        if (entries.length === 0) {
          channel.send({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('🎉 Giveaway Ended').setDescription('No valid entries.')] });
        } else {
          const shuffled = entries.sort(() => 0.5 - Math.random());
          const winners = shuffled.slice(0, gw.winners);
          
          const embed = new EmbedBuilder()
            .setColor(0x44ff44)
            .setTitle('🎉 Giveaway Ended!')
            .setDescription(`**Prize:** ${gw.prize}\n**Winners:** ${winners.map(w => `<@${w}>`).join(', ')}`)
            .setTimestamp();
          
          channel.send({ content: winners.map(w => `<@${w}>`).join(' '), embeds: [embed] });
        }
        await giveaways.end(guild.id, gw.id);
      }
    } catch (e) {
      logger.error(`Giveaway loop error: ${e.message}`);
    }
  }, 30000);

  // // ── AI auto-reply for tickets ──
  // client.on('messageCreate', async message => {
  //   if (message.author.bot || !message.guild) return;
  //   await tickets.handleTicketMessage(message);
  // });

  client.once('clientReady', () => {
    logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
    cleanupGuildCommands(client);
  });

  await client.login(config.token);
}

module.exports = { startBot, client };