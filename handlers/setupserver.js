/**
 * ?setupserver — one-shot server builder (owner-only prefix command).
 *
 * Creates the staff/support roles, the recommended channel layout with
 * emoji-prefixed categories and channels plus explicit text/voice
 * permission overrides, then wires the created channels into the module
 * settings (tickets -> BOT & SUPPORT, logging -> #audit-log). Everything
 * is idempotent: existing roles/channels are reused by name (unprefixed
 * channels from older runs are renamed in place), never duplicated. Not
 * registered as a slash command.
 */
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { baseEmbed, errorEmbed, Colors } = require('../utils/discord');
const settings = require('../services/settings');
const permissions = require('../services/permissions');
const logger = require('../services/logger');
const logService = require('../services/logService');
const ticketService = require('../modules/tickets/ticketService');

const ROLES = [
  { name: 'Staff Team', color: '#8b5cf6', hoist: true },
  { name: 'Support Team', color: '#38bdf8', hoist: true },
];

/** Categories: name, emoji prefix, and their text channels [{ name, emoji }]. */
const CATEGORIES = [
  {
    name: 'INFORMATION',
    emoji: '📚',
    channels: [
      { name: 'rules', emoji: '📜' },
      { name: 'welcome', emoji: '👋' },
      { name: 'updates', emoji: '📣', readonly: true },
      { name: 'announcements', emoji: '📢', readonly: true },
      { name: 'changelog', emoji: '📝', readonly: true },
    ],
  },
  {
    name: 'COMMUNITY',
    emoji: '🌐',
    channels: [
      { name: 'general-chat', emoji: '💬' },
      { name: 'introductions', emoji: '🤝' },
      { name: 'media', emoji: '🖼️' },
      { name: 'off-topic', emoji: '☕' },
    ],
  },
  {
    name: 'BOT & SUPPORT',
    emoji: '🛎️',
    channels: [
      { name: 'help-and-support', emoji: '🎫' },
      { name: 'commands-guide', emoji: '⌨️' },
      { name: 'suggestions', emoji: '💡' },
      { name: 'bug-reports', emoji: '🐛' },
    ],
  },
  {
    name: 'PREMIUM',
    emoji: '👑',
    channels: [
      { name: 'premium-chat', emoji: '✨' },
      { name: 'premium-support', emoji: '👑' },
    ],
  },
  {
    name: 'SUPPORT TEAM',
    emoji: '🎧',
    channels: [
      { name: 'support-chat', emoji: '🎧' },
      { name: 'support-handbook', emoji: '📖' },
      { name: 'resolved-archive', emoji: '🗃️' },
    ],
  },
  {
    name: 'STAFF TEAM',
    emoji: '🛡️',
    channels: [
      { name: 'staff-chat', emoji: '🛡️' },
      { name: 'audit-log', emoji: '📋' },
      { name: 'actions', emoji: '⚡' },
    ],
  },
];

const VOICE = { name: 'VOICE', emoji: '🔊' };

/** Voice channels: [{ name, emoji }] under the VOICE category. */
const VOICE_CHANNELS = [
  { name: 'General', emoji: '🔊' },
  { name: 'Chill Corner', emoji: '🌿' },
  { name: 'Music Room', emoji: '🎵' },
];

/** Category -> role names allowed to see it (everyone else is hidden). */
const GATED = {
  PREMIUM: ['Aether Premium', 'Premium'],
  'SUPPORT TEAM': ['Support Team', 'Staff Team'],
  'STAFF TEAM': ['Staff Team'],
};

const fullChannelName = (def) => `【${def.emoji}】${def.name}`;
const fullCategoryName = (def) => `【${def.emoji}】${def.name.toLowerCase()}`;

const findRole = (guild, name) => guild.roles.cache.find((r) => r.name.toLowerCase() === String(name).toLowerCase());
const findChannel = (guild, name) => guild.channels.cache.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
const findCategory = (guild, name) =>
  guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && (c.name.toLowerCase() === name.toLowerCase() || c.name.toLowerCase().endsWith(name.toLowerCase()))
  );

/** Overrides that hide a category (and its children) behind roles. */
function gateOverrides(guild, catName) {
  const overrides = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];
  for (const roleName of GATED[catName] || []) {
    const role = findRole(guild, roleName);
    if (role) overrides.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages] });
  }
  if (guild.members.me) overrides.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] });
  return overrides;
}

/** Explicit perms for a text channel: public ones open, gated ones inherit the gate, readonly ones are view-only. */
function textPerms(guild, catName, def = {}) {
  if (GATED[catName]) return gateOverrides(guild, catName);
  if (def.readonly) {
    const overrides = [
      { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    ];
    if (guild.members.me) overrides.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] });
    return overrides;
  }
  const overrides = [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages] },
  ];
  if (guild.members.me) overrides.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] });
  return overrides;
}

/** Explicit perms for a voice channel: everyone can join and talk. */
function voicePerms(guild) {
  const overrides = [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
  ];
  if (guild.members.me) overrides.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect] });
  return overrides;
}

/** Read back the overrides just set and flag anything that did not stick. */
function verifyOverrides(channel, guild, catName, def, summary) {
  const everyone = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
  if (!everyone) return;
  const denies = (ov) => (ov.deny?.has ? ov.deny.has(PermissionFlagsBits.ViewChannel) : (ov.deny || []).includes(PermissionFlagsBits.ViewChannel));
  const allows = (ov, flag) => (ov.allow?.has ? ov.allow.has(flag) : (ov.allow || []).includes(flag));
  if (GATED[catName] && !denies(everyone)) {
    summary.permWarnings.push(`${channel.name}: @everyone can still see it`);
  }
  if (def.readonly && allows(everyone, PermissionFlagsBits.SendMessages)) {
    summary.permWarnings.push(`${channel.name}: @everyone can still type`);
  }
}

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
    const summary = { roles: [], categories: [], channels: [], renamed: [], gates: [], wired: [], skipped: [], permOpen: 0, permLocked: 0, permWarnings: [] };
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
          const role = await guild.roles.create({ name: def.name, colors: [def.color], hoist: def.hoist, reason: 'Aether ?setupserver' });
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
      for (const cat of CATEGORIES) {
        const fullCat = fullCategoryName(cat);
        let category = findCategory(guild, fullCat) || findCategory(guild, cat.name);
        if (!category) {
          category = await guild.channels.create({ name: fullCat, type: ChannelType.GuildCategory, reason: 'Aether ?setupserver' });
          summary.categories.push(fullCat);
        } else if (category.name !== fullCat) {
          await category.setName(fullCat, 'Aether ?setupserver');
          summary.renamed.push(`Category ${cat.name} -> ${fullCat}`);
        } else {
          summary.skipped.push(`Category ${fullCat} (already exists)`);
        }
        if (GATED[cat.name]) {
          await category.permissionOverwrites.set(gateOverrides(guild, cat.name), 'Aether ?setupserver');
          summary.gates.push(cat.name);
        }
        for (const def of cat.channels) {
          const full = fullChannelName(def);
          const existing = findChannel(guild, full) || findChannel(guild, def.name);
          let channel;
          if (existing) {
            if (existing.name !== full) {
              await existing.setName(full, 'Aether ?setupserver');
              summary.renamed.push(`#${def.name} -> ${full}`);
            }
            channel = existing;
          } else {
            channel = await guild.channels.create({
              name: full,
              type: ChannelType.GuildText,
              parent: category.id,
              reason: 'Aether ?setupserver',
            });
            summary.channels.push(full);
          }
          await channel.permissionOverwrites.set(GATED[cat.name] ? gateOverrides(guild, cat.name) : textPerms(guild, cat.name, def), 'Aether ?setupserver');
          if (GATED[cat.name]) summary.permLocked++;
          else summary.permOpen++;
          verifyOverrides(channel, guild, cat.name, def, summary);
        }
      }

      // ── Voice category + channels ───────────────────────────────────────
      const fullVoiceCat = fullCategoryName(VOICE);
      let voiceCat = findCategory(guild, fullVoiceCat) || findCategory(guild, VOICE.name);
      if (!voiceCat) {
        voiceCat = await guild.channels.create({ name: fullVoiceCat, type: ChannelType.GuildCategory, reason: 'Aether ?setupserver' });
        summary.categories.push(fullVoiceCat);
      } else if (voiceCat.name !== fullVoiceCat) {
        await voiceCat.setName(fullVoiceCat, 'Aether ?setupserver');
        summary.renamed.push(`Category ${VOICE.name} -> ${fullVoiceCat}`);
      }
      for (const def of VOICE_CHANNELS) {
        const full = fullChannelName(def);
        const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const existing = findChannel(guild, full) || findChannel(guild, def.name) || findChannel(guild, slug);
        let channel;
        if (existing) {
          if (existing.name !== full) {
            await existing.setName(full, 'Aether ?setupserver');
            summary.renamed.push(`Voice ${def.name} -> ${full}`);
          }
          channel = existing;
        } else {
          channel = await guild.channels.create({
            name: full,
            type: ChannelType.GuildVoice,
            parent: voiceCat.id,
            reason: 'Aether ?setupserver',
          });
          summary.channels.push(`Voice ${full}`);
        }
        await channel.permissionOverwrites.set(voicePerms(guild), 'Aether ?setupserver');
        summary.permOpen++;
      }

      // ── Wire module settings ────────────────────────────────────────────
      const supportCat = findCategory(guild, 'BOT & SUPPORT');
      const staffCat = findCategory(guild, 'STAFF TEAM');
      const auditLog = staffCat ? findChannel(guild, '【📋】audit-log') || findChannel(guild, 'audit-log') : null;
      const helpChannel = supportCat ? findChannel(guild, '【🎫】help-and-support') || findChannel(guild, 'help-and-support') : null;
      const archiveChannel = findChannel(guild, '【🗃️】resolved-archive') || findChannel(guild, 'resolved-archive');

      // Tickets: panel in BOT & SUPPORT, staff roles, logs + transcripts.
      if (supportCat) {
        const existing = settings.getSetting(guild.id, 'ticket', {});
        settings.setSetting(guild.id, 'ticket', {
          ...existing,
          enabled: true,
          categoryId: supportCat.id,
          staffRoles: [staffRole?.id, supportRole?.id].filter(Boolean),
          panelChannelId: helpChannel?.id || null,
          logChannelId: auditLog?.id || null,
          transcriptChannelId: archiveChannel?.id || null,
          categories: [
            { name: 'General', emoji: '💬' },
            { name: 'Billing', emoji: '💳' },
            { name: 'Report', emoji: '🚩' },
          ],
        });
        summary.wired.push('Tickets -> BOT & SUPPORT (panel, staff roles, log, transcripts, categories)');
      }

      // Ticket panel: post the open-ticket embed into help-and-support.
      if (helpChannel) {
        await ticketService.sendPanel(guild, helpChannel);
        summary.wired.push('Ticket panel posted in help-and-support');
      }

      // Logging: every event type -> #audit-log.
      if (auditLog) {
        const existing = settings.getSetting(guild.id, 'logging', {});
        const channels = {};
        for (const e of logService.EVENT_KEYS) channels[e.key] = auditLog.id;
        settings.setSetting(guild.id, 'logging', {
          ...existing,
          enabled: true,
          channels: { ...channels, ...(existing.channels || {}) },
        });
        summary.wired.push('Logging -> #audit-log (all event types)');
      }

      // Automod: on with the default rules (caps, mention and emoji limits).
      {
        const existing = settings.getSetting(guild.id, 'automod', {});
        settings.setSetting(guild.id, 'automod', { ...existing, enabled: true });
        summary.wired.push('Automod -> enabled (caps, mentions, emoji limits)');
      }

      logger.info(`?setupserver ran in ${guild.id}: +${summary.roles.length} roles, +${summary.categories.length} cats, +${summary.channels.length} channels, +${summary.renamed.length} renamed`);
    } catch (err) {
      logger.error(`?setupserver failed in ${guild.id}: ${err.stack || err.message}`);
      return message.channel.send({ embeds: [errorEmbed(`Setup failed partway: ${err.message}`)] });
    }

    const field = (name, items) =>
      items.length ? { name, value: items.slice(0, 30).join(' · ').slice(0, 1024), inline: false } : null;
    const embed = baseEmbed({
      color: Colors.success,
      title: 'Server setup complete',
      description: 'The server layout has been built with emoji-prefixed categories and channels plus explicit text/voice permissions. Everything is idempotent — run `?setupserver` again to fill in anything still missing.',
      fields: [
        field('Created roles', summary.roles),
        field('Created categories', summary.categories),
        field('Created channels', summary.channels),
        field('Renamed channels', summary.renamed),
        field('Permission gates', summary.gates.map((g) => `${g} locked`)),
        field('Channel permissions', [`${summary.permOpen} open · ${summary.permLocked} role-locked`]),
        field('Permission warnings', summary.permWarnings),
        field('Wired into modules', summary.wired),
        field('Skipped', summary.skipped),
      ].filter(Boolean),
    });
    return message.channel.send({ embeds: [embed] });
  },
};
