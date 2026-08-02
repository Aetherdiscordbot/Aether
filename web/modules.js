/**
 * Module metadata for the web dashboard. Describes each configurable module:
 * display name, description, and its form fields.
 *
 * Field types (each maps 1:1 to what the module services actually read):
 *   text      — plain string
 *   number    — number (or null when empty/invalid)
 *   boolean   — true/false (checkbox; absent checkbox = false)
 *   textarea  — multi-line string (NOT comma-split — services read strings)
 *   list      — comma-separated input → array of strings (services read arrays)
 *   select    — one of `options`
 *   channel   — channel dropdown (id)
 *   role      — single role dropdown (id)
 *   roleList  — multi-select roles → array of ids
 *   channelList — multi-select channels → array of ids
 *
 * `dotted` keys (e.g. "antiRaid.enabled") are nested under the parent key.
 */
const MODULES = [
  {
    key: 'ticket',
    name: 'Tickets',
    description: 'Support tickets with staff claims, transcripts and categories.',
    premium: true,
    defaultEnabled: true,
    fields: {
      categoryId: { label: 'Ticket category', type: 'channel', channelTypes: [4] },
      staffRoles: { label: 'Staff roles', type: 'roleList' },
      logChannelId: { label: 'Log channel', type: 'channel' },
      transcriptChannelId: { label: 'Transcript channel', type: 'channel' },
      panelChannelId: { label: 'Panel channel', type: 'channel', help: 'Where the open-ticket panel is posted (re-sent on save)' },
      welcomeMessage: { label: 'Welcome message', type: 'textarea', default: 'Welcome {user}!\nA staff member will be with you shortly. Please describe your issue in detail.' },
      openLimit: { label: 'Open ticket limit (free)', type: 'number', default: 3 },
      premiumOpenLimit: { label: 'Open ticket limit (premium)', type: 'number', default: 15 },
    },
  },
  {
    key: 'leveling',
    name: 'Leveling',
    description: 'XP, levels and rewards for active members.',
    premium: false,
    defaultEnabled: true,
    fields: {
      announcement: { label: 'Announcement mode', type: 'select', options: ['channel', 'dm', 'none'], default: 'channel', help: 'channel = in the announce channel, dm = DM the user, none = silent' },
      announceChannel: { label: 'Level-up announcement channel', type: 'channel' },
      voiceXpPerMinute: { label: 'Voice XP per minute', type: 'number', default: 4 },
      messageCooldownSec: { label: 'Message XP cooldown (seconds)', type: 'number', default: 60 },
      xpPerMessage: { label: 'XP per message (min, max)', type: 'numberList', default: [15, 25] },
    },
  },
  {
    key: 'economy',
    name: 'Economy',
    description: 'Currency, shop, work and daily rewards.',
    premium: false,
    defaultEnabled: true,
    fields: {
      currency: { label: 'Currency emoji', type: 'text', default: '🪙' },
      startBalance: { label: 'Start balance', type: 'number' },
      dailyAmount: { label: 'Daily reward', type: 'number', default: 200 },
      workMin: { label: 'Work reward min', type: 'number', default: 50 },
      workMax: { label: 'Work reward max', type: 'number', default: 200 },
      workCooldownSec: { label: 'Work cooldown (seconds)', type: 'number', default: 3600 },
    },
  },
  {
    key: 'verification',
    name: 'Verification',
    description: 'Gate new members behind a verify button.',
    premium: false,
    defaultEnabled: false,
    fields: {
      channelId: { label: 'Verify channel', type: 'channel' },
      roleId: { label: 'Verified role', type: 'role' },
      message: { label: 'Verify message', type: 'textarea', default: 'Click the button below to verify yourself and gain access to the server.' },
    },
  },
  {
    key: 'suggestions',
    name: 'Suggestions',
    description: 'Member suggestions with approve/deny.',
    premium: false,
    hasEnabled: false,
    fields: {
      channelId: { label: 'Suggestions channel', type: 'channel' },
      deleteOnDeny: { label: 'Delete message on deny', type: 'boolean' },
    },
  },
  {
    key: 'security',
    name: 'Security',
    description: 'Anti-raid, anti-spam and account-age protections.',
    premium: true,
    defaultEnabled: true,
    fields: {
      'antiRaid.enabled': { label: 'Anti-raid', type: 'boolean', default: true },
      'antiRaid.maxJoinsPerMin': { label: 'Max joins per minute', type: 'number', default: 5 },
      'antiRaid.action': { label: 'Anti-raid action', type: 'select', options: ['lock', 'kick'], default: 'lock' },
      'antiSpam.enabled': { label: 'Anti-spam', type: 'boolean', default: true },
      'antiSpam.maxMessages': { label: 'Max messages in window', type: 'number', default: 6 },
      'antiSpam.withinSec': { label: 'Spam window (seconds)', type: 'number', default: 5 },
      'antiMentionSpam.enabled': { label: 'Anti mention-spam', type: 'boolean', default: true },
      'antiMentionSpam.maxMentions': { label: 'Max mentions', type: 'number', default: 5 },
      'antiInviteSpam.enabled': { label: 'Anti invite-spam', type: 'boolean', default: true },
      'antiWebhook.enabled': { label: 'Anti webhook abuse', type: 'boolean', default: true },
      minAccountAgeDays: { label: 'Minimum account age (days)', type: 'number', help: '0 = disabled' },
      accountAgeAction: { label: 'Account age action', type: 'select', options: ['kick', 'ban'], default: 'kick' },
      whitelistedUsers: { label: 'Whitelisted user IDs (comma-separated)', type: 'list' },
      whitelistedRoles: { label: 'Whitelisted roles', type: 'roleList' },
      logViolations: { label: 'Log violations', type: 'boolean', default: true },
    },
  },
  {
    key: 'automod',
    name: 'Automod',
    description: 'Word filters, caps, links, mentions and emoji limits.',
    premium: true,
    defaultEnabled: true,
    fields: {
      words: { label: 'Banned words (comma-separated)', type: 'list' },
      timeoutDuration: { label: 'Timeout duration', type: 'text', help: 'e.g. 10m, 1h', default: '10m' },
      'links.enabled': { label: 'Link filter', type: 'boolean' },
      'links.allowDiscord': { label: 'Allow Discord links', type: 'boolean', default: true },
      'caps.enabled': { label: 'Caps protection', type: 'boolean', default: true },
      'caps.minLength': { label: 'Caps min length', type: 'number', default: 8 },
      'caps.maxPercent': { label: 'Caps max %', type: 'number', default: 70 },
      'mentions.enabled': { label: 'Mention limit', type: 'boolean', default: true },
      'mentions.max': { label: 'Max mentions', type: 'number', default: 4 },
      'emojiSpam.enabled': { label: 'Emoji spam protection', type: 'boolean', default: true },
      'emojiSpam.maxEmojis': { label: 'Max emojis', type: 'number', default: 10 },
      'attachments.enabled': { label: 'Attachment filter', type: 'boolean' },
      'attachments.blockedSizeMb': { label: 'Max attachment size (MB, 0 = off)', type: 'number' },
      'attachments.blockedExtensions': { label: 'Blocked extensions (comma-separated)', type: 'list' },
      ignoreChannels: { label: 'Ignored channels', type: 'channelList' },
      ignoreRoles: { label: 'Ignored roles', type: 'roleList' },
    },
  },
  {
    key: 'logging',
    name: 'Logging',
    description: 'Audit log events into configured channels.',
    premium: true,
    defaultEnabled: true,
    fields: {
      'channels.join': { label: 'Member joins', type: 'channel' },
      'channels.leave': { label: 'Member leaves', type: 'channel' },
      'channels.messageDelete': { label: 'Message deleted', type: 'channel' },
      'channels.messageUpdate': { label: 'Message edited', type: 'channel' },
      'channels.role': { label: 'Role updates', type: 'channel' },
      'channels.channel': { label: 'Channel updates', type: 'channel' },
      'channels.server': { label: 'Server updates', type: 'channel' },
      'channels.nickname': { label: 'Nickname changes', type: 'channel' },
      'channels.voice': { label: 'Voice activity', type: 'channel' },
      'channels.moderation': { label: 'Moderation actions', type: 'channel' },
      'channels.invite': { label: 'Invite events', type: 'channel' },
      'channels.webhook': { label: 'Webhook abuse', type: 'channel' },
      'channels.member': { label: 'Member role updates', type: 'channel' },
      'channels.ticket': { label: 'Tickets', type: 'channel' },
      'channels.security': { label: 'Security alerts', type: 'channel' },
      'channels.automod': { label: 'Auto-moderation', type: 'channel' },
    },
  },
  {
    key: 'welcome',
    name: 'Welcome',
    description: 'Welcome and goodbye messages with auto-roles.',
    premium: false,
    defaultEnabled: false,
    fields: {
      channelId: { label: 'Welcome channel', type: 'channel' },
      welcomeMessage: { label: 'Welcome message', type: 'textarea', default: 'Welcome {user} to {server}!', help: 'Placeholders: {user} {mention} {tag} {server} {count}' },
      leaveChannelId: { label: 'Goodbye channel', type: 'channel' },
      leaveMessage: { label: 'Goodbye message', type: 'textarea', default: 'Goodbye {user}, we will miss you.' },
      autoroleIds: { label: 'Auto-roles on join', type: 'roleList' },
      autoroleEnabled: { label: 'Enable auto-roles', type: 'boolean', default: true },
    },
  },
];

function getModule(key) {
  return MODULES.find((m) => m.key === key) || null;
}

/** Deep-set a dotted key (e.g. "antiRaid.enabled") into an object. */
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Convert a submitted form into the module's settings object shape.
 * Values match what the module services actually read (see type docs above).
 */
function parseModuleConfig(mod, form) {
  // express.urlencoded (extended:false) turns duplicate keys into arrays;
  // take the last value for single-valued fields.
  const last = (raw) => (Array.isArray(raw) ? raw[raw.length - 1] : raw);
  const out = {};
  if (form.enabled !== undefined) out.enabled = last(form.enabled) === 'on';
  for (const [key, def] of Object.entries(mod.fields || {})) {
    const raw = form[key];
    if (raw === undefined) continue;
    let value;
    switch (def.type) {
      case 'boolean':
        value = last(raw) === 'on';
        break;
      case 'number': {
        const n = parseFloat(last(raw));
        value = Number.isFinite(n) ? n : undefined;
        break;
      }
      case 'numberList': {
        const parts = String(last(raw) ?? '').split(',').map((s) => parseFloat(s.trim())).filter(Number.isFinite);
        value = parts.length ? parts : undefined;
        break;
      }
      case 'list':
        value = String(last(raw) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case 'channel':
      case 'role':
        value = String(last(raw) ?? '').trim() || null;
        break;
      case 'roleList':
      case 'channelList':
        value = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
        break;
      case 'select':
        value = def.options.includes(last(raw)) ? last(raw) : def.default || undefined;
        break;
      default: // text, textarea
        value = String(last(raw) ?? '').trim() || null;
    }
    if (value === undefined) continue;
    setPath(out, key, value);
  }
  return out;
}

/** Defaults for rendering the config form (empty strings instead of nulls). */
function defaultsFor(mod) {
  const defaults = {};
  if (mod.hasEnabled !== false) defaults.enabled = mod.defaultEnabled === true;
  for (const [key, def] of Object.entries(mod.fields || {})) {
    const d = def.default;
    if (d !== undefined) setPath(defaults, key, d);
  }
  return defaults;
}

/** True if the module requires Aether Premium. */
function isPremiumModule(key) {
  const mod = getModule(key);
  return mod ? mod.premium === true : false;
}

module.exports = { MODULES, getModule, parseModuleConfig, defaultsFor, isPremiumModule };
