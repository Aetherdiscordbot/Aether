/**
 * Auto-moderation service: word filters, link filters, caps protection,
 * mention limits, emoji spam detection and attachment filtering.
 * Configuration under the `automod` settings key.
 */
const settings = require('../../services/settings');
const logService = require('../../services/logService');
const { baseEmbed, Colors, truncate } = require('../../utils/discord');
const { parseDuration } = require('../../utils/time');

const DEFAULT_CONFIG = {
  enabled: true,
  words: [],
  links: { enabled: false, blacklist: [], whitelist: [], allowDiscord: true },
  caps: { enabled: true, minLength: 8, maxPercent: 70, action: 'delete' },
  mentions: { enabled: true, max: 4, action: 'delete' },
  emojiSpam: { enabled: true, maxEmojis: 10, action: 'delete' },
  attachments: { enabled: false, blockedExtensions: [], blockedSizeMb: 0 },
  timeoutDuration: '10m',
  ignoreChannels: [],
  ignoreRoles: [],
};

function getConfig(guildId) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), settings.getSetting(guildId, 'automod', {}));
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'automod', { ...getConfig(guildId), ...partial });
}

function deepMerge(base, extra) {
  for (const key of Object.keys(extra || {})) {
    if (extra[key] && typeof extra[key] === 'object' && !Array.isArray(extra[key]) && base[key] && typeof base[key] === 'object') {
      deepMerge(base[key], extra[key]);
    } else {
      base[key] = extra[key];
    }
  }
  return base;
}

function isIgnored(message) {
  const cfg = getConfig(message.guild.id);
  if (cfg.ignoreChannels.includes(message.channel.id)) return true;
  return cfg.ignoreRoles.some((r) => message.member?.roles.cache.has(r));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check a message against every rule. Returns true if the message was acted on.
 */
async function checkMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const cfg = getConfig(message.guild.id);
  if (!cfg.enabled) return false;
  if (isIgnored(message)) return false;

  const content = message.content || '';
  const lower = content.toLowerCase();

  // 1) Word filter
  if (cfg.words.length && new RegExp(`\\b(${cfg.words.map(escapeRegex).join('|')})\\b`, 'i').test(content)) {
    await act(message, 'banned word filter', cfg);
    return true;
  }

  // 2) Link filter
  if (cfg.links.enabled) {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const links = content.match(urlPattern) || [];
    if (links.length) {
      const allowedHosts = cfg.links.whitelist.map((h) => h.replace(/^https?:\/\//, '').toLowerCase());
      const flagged = links.some((l) => {
        let host = '';
        try { host = new URL(l).hostname.replace(/^www\./, ''); } catch { host = l.toLowerCase(); }
        if (cfg.links.allowDiscord && /discord\.(gg|com|app|media)|cdn\.discord/.test(host)) return false;
        if (allowedHosts.includes(host)) return false;
        return cfg.links.blacklist.length ? cfg.links.blacklist.some((b) => host.includes(b.toLowerCase())) : true;
      });
      if (flagged) {
        await act(message, 'link filter', cfg);
        return true;
      }
    }
  }

  // 3) Caps protection
  if (cfg.caps.enabled && content.length >= cfg.caps.minLength) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= cfg.caps.minLength) {
      const upper = letters.replace(/[^A-Z]/g, '');
      const percent = (upper.length / letters.length) * 100;
      if (percent > cfg.caps.maxPercent) {
        await act(message, 'excessive caps', cfg);
        return true;
      }
    }
  }

  // 4) Mention limit
  if (cfg.mentions.enabled && message.mentions.users.size + message.mentions.roles.size > cfg.mentions.max) {
    await act(message, 'mention spam', cfg);
    return true;
  }

  // 5) Emoji spam
  if (cfg.emojiSpam.enabled) {
    const emojiCount = (content.match(/(<a?:\w+:\d+>)/g) || []).length;
    const unicodeEmoji = (content.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    if (emojiCount + unicodeEmoji > cfg.emojiSpam.maxEmojis) {
      await act(message, 'emoji spam', cfg);
      return true;
    }
  }

  // 6) Attachment filtering
  if (cfg.attachments.enabled && message.attachments.size) {
    const blockedExt = (cfg.attachments.blockedExtensions || []).map((e) => e.toLowerCase().replace(/^\./, ''));
    for (const att of message.attachments.values()) {
      const ext = att.name?.split('.').pop()?.toLowerCase();
      const tooBig = cfg.attachments.blockedSizeMb > 0 && att.size > cfg.attachments.blockedSizeMb * 1024 * 1024;
      if ((blockedExt.length && ext && blockedExt.includes(ext)) || tooBig) {
        await act(message, 'attachment filter', cfg);
        return true;
      }
    }
  }

  return false;
}

async function act(message, label, cfg) {
  try {
    await message.delete().catch(() => {});
    if (cfg[ruleActionKey(label)]?.action === 'timeout') {
      const dur = parseDuration(cfg.timeoutDuration);
      if (dur && message.member?.moderatable) await message.member.timeout(dur, `Aether auto-mod: ${label}`);
    }
  } catch { /* ignore */ }

  await logService.sendLog(
    message.guild,
    'automod',
    baseEmbed({
      color: Colors.warning,
      title: `Auto-mod: ${label}`,
      description: `${message.author} in ${message.channel}\n> ${truncate(message.content, 300) || '*no text*'}`,
      footer: { text: `User ID: ${message.author.id}` },
    })
  );
}

function ruleActionKey(label) {
  if (label.includes('caps')) return 'caps';
  if (label.includes('mention')) return 'mentions';
  if (label.includes('emoji')) return 'emojiSpam';
  if (label.includes('link')) return 'links';
  if (label.includes('attachment')) return 'attachments';
  return 'words';
}

module.exports = { DEFAULT_CONFIG, getConfig, setConfig, checkMessage };
