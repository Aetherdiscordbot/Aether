/**
 * Module metadata for the web dashboard. Describes each configurable module:
 * display name, description, and its form fields. `channelField`/`roleField`
 * map a module's config key to a channel/role dropdown.
 */
const MODULES = [
  {
    key: 'ticket',
    name: 'Tickets',
    description: 'Support tickets with staff claims, transcripts and categories.',
    hasEnabled: true,
    channelField: 'categoryId',
    channelLabel: 'Ticket category',
    channelHelp: 'Category where new ticket channels are created.',
    fields: {
      staffRoles: { label: 'Staff roles (IDs, comma-separated)', type: 'text' },
      logChannelId: { label: 'Log channel ID', type: 'text' },
      transcriptChannelId: { label: 'Transcript channel ID', type: 'text' },
      welcomeMessage: { label: 'Welcome message', type: 'textarea' },
      openLimit: { label: 'Open ticket limit (free)', type: 'number' },
      premiumOpenLimit: { label: 'Open ticket limit (premium)', type: 'number' },
    },
  },
  {
    key: 'leveling',
    name: 'Leveling',
    description: 'XP, levels and rewards for active members.',
    hasEnabled: true,
    channelField: 'announceChannel',
    channelLabel: 'Level-up announcement channel',
    fields: {
      announcement: { label: 'Announcement mode', type: 'text', help: 'channel, dm or off' },
      voiceXpPerMinute: { label: 'Voice XP per minute', type: 'number' },
      messageCooldownSec: { label: 'Message XP cooldown (seconds)', type: 'number' },
    },
  },
  {
    key: 'economy',
    name: 'Economy',
    description: 'Currency, shop, work and daily rewards.',
    hasEnabled: true,
    fields: {
      currency: { label: 'Currency emoji', type: 'text' },
      startBalance: { label: 'Start balance', type: 'number' },
      dailyAmount: { label: 'Daily reward', type: 'number' },
      workMin: { label: 'Work reward min', type: 'number' },
      workMax: { label: 'Work reward max', type: 'number' },
      workCooldownSec: { label: 'Work cooldown (seconds)', type: 'number' },
    },
  },
  {
    key: 'verification',
    name: 'Verification',
    description: 'Gate new members behind a verify button.',
    hasEnabled: true,
    channelField: 'channelId',
    channelLabel: 'Verify channel',
    roleField: 'roleId',
    roleLabel: 'Verified role',
    fields: {
      message: { label: 'Verify message', type: 'textarea' },
    },
  },
  {
    key: 'suggestions',
    name: 'Suggestions',
    description: 'Member suggestions with approve/deny.',
    hasEnabled: false,
    channelField: 'channelId',
    channelLabel: 'Suggestions channel',
    fields: {
      deleteOnDeny: { label: 'Delete message on deny', type: 'boolean' },
    },
  },
  {
    key: 'security',
    name: 'Security',
    description: 'Anti-raid, anti-spam and account-age protections.',
    hasEnabled: true,
    fields: {
      antiRaid: { label: 'Anti-raid', type: 'boolean' },
      antiSpam: { label: 'Anti-spam', type: 'boolean' },
      antiMentionSpam: { label: 'Anti mention-spam', type: 'boolean' },
      antiInviteSpam: { label: 'Anti invite-spam', type: 'boolean' },
      antiWebhook: { label: 'Anti webhook abuse', type: 'boolean' },
      minAccountAgeDays: { label: 'Minimum account age (days)', type: 'number' },
      accountAgeAction: { label: 'Account age action', type: 'text', help: 'kick or ban' },
      joinLock: { label: 'Lock joins when raiding', type: 'boolean' },
    },
  },
  {
    key: 'automod',
    name: 'Automod',
    description: 'Word filters, caps, links, mentions and emoji limits.',
    hasEnabled: true,
    fields: {
      words: { label: 'Banned words (comma-separated)', type: 'textarea' },
      timeoutDuration: { label: 'Timeout duration', type: 'text', help: 'e.g. 10m, 1h' },
    },
  },
  {
    key: 'logging',
    name: 'Logging',
    description: 'Audit log events into configured channels.',
    hasEnabled: true,
    channelField: 'channelId',
    channelLabel: 'Default log channel',
    fields: {
      messageDelete: { label: 'Message delete channel ID', type: 'text' },
      messageUpdate: { label: 'Message edit channel ID', type: 'text' },
      member: { label: 'Member events channel ID', type: 'text' },
      moderation: { label: 'Moderation channel ID', type: 'text' },
    },
  },
  {
    key: 'welcome',
    name: 'Welcome',
    description: 'Welcome and goodbye messages with auto-roles.',
    hasEnabled: true,
    channelField: 'channelId',
    channelLabel: 'Welcome channel',
    fields: {
      welcomeMessage: { label: 'Welcome message', type: 'textarea' },
      leaveChannelId: { label: 'Goodbye channel ID', type: 'text' },
      leaveMessage: { label: 'Goodbye message', type: 'textarea' },
      autoroleIds: { label: 'Auto-role IDs (comma-separated)', type: 'text' },
    },
  },
];

function getModule(key) {
  return MODULES.find((m) => m.key === key) || null;
}

/** Convert a submitted form into the module's settings object shape. */
function parseModuleConfig(mod, form) {
  const out = {};
  if (mod.hasEnabled !== false) out.enabled = form.enabled === 'on';
  if (mod.channelField) {
    const v = (form.channelId || '').trim();
    out[mod.channelField] = v || undefined;
  }
  if (mod.roleField) {
    const v = (form.roleId || '').trim();
    out[mod.roleField] = v || undefined;
  }
  for (const [key, def] of Object.entries(mod.fields || {})) {
    const raw = form[key];
    if (raw === undefined) continue;
    switch (def.type) {
      case 'boolean':
        out[key] = raw === 'on';
        break;
      case 'number': {
        const n = parseFloat(raw);
        out[key] = Number.isFinite(n) ? n : undefined;
        break;
      }
      case 'textarea':
        out[key] = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
        break;
      default:
        out[key] = String(raw ?? '').trim() || undefined;
    }
  }
  return out;
}

module.exports = { MODULES, getModule, parseModuleConfig };
