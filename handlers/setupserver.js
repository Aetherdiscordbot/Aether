/**
 * ?setupserver — one-shot server builder (owner-only prefix command).
 *
 * Creates the staff/support roles, the recommended channel layout with
 * permission gates, then wires the created channels into the module
 * settings (tickets -> BOT & SUPPORT, logging -> #audit-log). Everything
 * is idempotent: existing roles/channels are reused by name, never
 * duplicated. Not registered as a slash command.
 */
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { baseEmbed, errorEmbed, Colors } = require('../utils/discord');
const settings = require('../services/settings');
const permissions = require('../services/permissions');
const logger = require('../services/logger');

const ROLES = [
  { name: 'Staff Team', color: '#8b5cf6', hoist: true },
  { name: 'Support Team', color: '#38bdf8', hoist: true },
];

const CATEGORIES = {
  INFORMATION: ['rules', 'welcome', 'updates', 'announcements', 'changelog'],
  COMMUNITY: ['general-chat', 'introductions', 'media', 'off-topic'],
  'BOT & SUPPORT': ['help-and-support', 'commands-guide', 'suggestions', 'bug-reports'],
  PREMIUM: ['premium-chat', 'premium-support'],
  'SUPPORT TEAM': ['support-chat', 'support-handbook', 'resolved-archive'],
  'STAFF TEAM': ['staff-chat', 'audit-log', 'actions'],
};

const VOICE_CHANNELS = ['General', 'Chill Corner', 'Music Room'];

/** Category -> role names allowed to see it (everyone else is hidden). */
const GATED = {
  PREMIUM: ['Aether Premium', 'Premium'],
  'SUPPORT TEAM': ['Support Team', 'Staff Team'],
  'STAFF TEAM': ['Staff Team'],
};

const findRole = (guild, name) => guild.roles.cache.find((r) => r.name.toLowerCase() === String(name).toLowerCase());
const findChannel = (guild, name) => guild.channels.cache.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
const findCategory = (guild, name) =>
  guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === String(name).toLowerCase());

module.exports = {
  name: 'setupserver',
  ownerOnly: true,

  async run(client, message) {
    if (!permissions.isOwner(message.author)) return;
    if (!message.guild) {
      return message.channel.send({ embeds: [errorEmbed('Run this in the server you want to set up.')] });
    }
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles | PermissionFlagsBits.ManageChannels)) {
      return message.channel.send({ embeds: [errorEmbed('I need **Manage Roles** and **Manage Channels** to set up the server.')] });
    }

    const guild = message.guild;
    const summary = { roles: [], categories: [], channels: [], gates: [], wired: [], skipped: [] };
    await message.channel.sendTyping().catch(() => {});

    try {
      // ── Roles ──────────────────────────────────────────────────────────
      const createdRoles = new Map();
      for (const def of ROLES) {
        const existing = findRole(guild, def.name);
        if (existing) {
          summary.skipped.push(`Role ${def.name} (already exists)`);
          createdRoles.set(def.name, existing);
        } else {
          const role = await guild.roles.create({ name: def.name, color: def.color, hoist: def.hoist, reason: 'Aether ?setupserver' });
          summary.roles.push(`@${def.name}`);
          createdRoles.set(def.name, role);
        }
      }
      const staffRole = createdRoles.get('Staff Team');
      const supportRole = createdRoles.get('Support Team');
      if (staffRole && supportRole) {
        await guild.roles.setPositions([{ role: staffRole, position: supportRole.position + 1 }], 'Aether ?setupserver');
      }

      // ── Categories + text channels ──────────────────────────────────────
      for (const [catName, channels] of Object.entries(CATEGORIES)) {
        let category = findCategory(guild, catName);
        if (!category) {
          category = await guild.channels.create({ name: catName.toLowerCase(), type: ChannelType.GuildCategory, reason: 'Aether ?setupserver' });
          summary.categories.push(catName);
        } else {
          summary.skipped.push(`Category ${catName} (already exists)`);
        }
        for (const ch of channels) {
          if (findChannel(guild, ch)) {
            summary.skipped.push(`#${ch} (already exists)`);
            continue;
          }
          await guild.channels.create({ name: ch, type: ChannelType.GuildText, parent: category.id, reason: 'Aether ?setupserver' });
          summary.channels.push(`#${ch}`);
        }
      }

      // ── Voice category + channels ───────────────────────────────────────
      let voiceCat = findCategory(guild, 'voice');
      if (!voiceCat) {
        voiceCat = await guild.channels.create({ name: 'voice', type: ChannelType.GuildCategory, reason: 'Aether ?setupserver' });
        summary.categories.push('voice');
      }
      for (const vc of VOICE_CHANNELS) {
        if (findChannel(guild, vc) || findChannel(guild, vc.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
          summary.skipped.push(`Voice ${vc} (already exists)`);
          continue;
        }
        await guild.channels.create({ name: vc, type: ChannelType.GuildVoice, parent: voiceCat.id, reason: 'Aether ?setupserver' });
        summary.channels.push(`Voice ${vc}`);
      }

      // ── Permission gates (children inherit from their category) ─────────
      const bot = guild.members.me;
      for (const [catName, allowedRoleNames] of Object.entries(GATED)) {
        const category = findCategory(guild, catName);
        if (!category) continue;
        const overrides = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
        for (const roleName of allowedRoleNames) {
          const role = findRole(guild, roleName);
          if (role) {
            overrides.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
          } else {
            summary.skipped.push(`Gate ${catName}: ${roleName} not found`);
          }
        }
        if (bot) overrides.push({ id: bot.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] });
        await category.permissionOverwrites.set(overrides, 'Aether ?setupserver');
        summary.gates.push(catName);
      }

      // ── Wire module settings ────────────────────────────────────────────
      const supportCat = findCategory(guild, 'bot & support');
      const staffCat = findCategory(guild, 'staff team');
      const auditLog = staffCat ? findChannel(guild, 'audit-log') : null;

      if (supportCat) {
        const existing = settings.getSetting(guild.id, 'ticket', {});
        settings.setSetting(guild.id, 'ticket', {
          ...existing,
          categoryId: supportCat.id,
          staffRoles: [staffRole?.id, supportRole?.id].filter(Boolean),
        });
        summary.wired.push('Tickets -> BOT & SUPPORT + staff roles');
      }
      if (auditLog) {
        const existing = settings.getSetting(guild.id, 'logging', {});
        settings.setSetting(guild.id, 'logging', {
          ...existing,
          enabled: true,
          channels: { ...(existing.channels || {}), moderation: auditLog.id, ticket: supportCat?.id || null },
        });
        summary.wired.push('Logging -> #audit-log');
      }

      logger.info(`?setupserver ran in ${guild.id}: +${summary.roles.length} roles, +${summary.categories.length} cats, +${summary.channels.length} channels`);
    } catch (err) {
      logger.error(`?setupserver failed in ${guild.id}: ${err.stack || err.message}`);
      return message.channel.send({ embeds: [errorEmbed(`Setup failed partway: ${err.message}`)] });
    }

    const field = (name, items) =>
      items.length ? { name, value: items.slice(0, 30).join(' · ').slice(0, 1024), inline: false } : null;
    const embed = baseEmbed({
      color: Colors.success,
      title: 'Server setup complete',
      description: 'The server layout has been built. Everything is idempotent — run `?setupserver` again to fill in anything still missing.',
      fields: [
        field('Created roles', summary.roles),
        field('Created categories', summary.categories),
        field('Created channels', summary.channels),
        field('Permission gates', summary.gates.map((g) => `${g} locked`)),
        field('Wired into modules', summary.wired),
        field('Skipped', summary.skipped),
      ].filter(Boolean),
    });
    return message.channel.send({ embeds: [embed] });
  },
};
