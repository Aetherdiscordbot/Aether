/**
 * Advanced AutoMod service.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const CONFIG_CACHE_TTL = 30 * 1000;
const configCache = new Map(); // guildId -> { config, at }
const spamMap = new Map(); // "guild:channel:user" -> [timestamps]

async function getConfig(guildId) {
  const hit = configCache.get(guildId);
  if (hit && Date.now() - hit.at < CONFIG_CACHE_TTL) return hit.config;
  const { data } = await supabase.from('automod_config').select('config').eq('guild_id', guildId).single();
  const config = data?.config || {};
  configCache.set(guildId, { config, at: Date.now() });
  return config;
}

async function setConfig(guildId, config) {
  await supabase.from('automod_config').upsert({ guild_id: guildId, config });
  configCache.delete(guildId);
}

async function checkMessage(message) {
  if (message.author.bot || !message.guild) return;
  if (!message.member?.moderatable) return;

  const config = await getConfig(message.guild.id);
  if (!config.enabled) return;

  const content = message.content;
  const member = message.member;

  // Spam (rate limit per channel) — checked first so it accumulates every message
  if (config.spam?.enabled) {
    const key = `spam:${message.guild.id}:${message.channel.id}:${message.author.id}`;
    const now = Date.now();
    const interval = config.spam.interval || 5000;
    const max = config.spam.max_messages || 5;
    const arr = (spamMap.get(key) || []).filter(t => now - t < interval);
    arr.push(now);
    spamMap.set(key, arr);
    if (arr.length >= max) {
      await handleViolation(message, 'Spam detected', config.spam.action);
      return;
    }
  }

  // Links
  if (config.links?.enabled) {
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    const isDiscord = u => u.includes('discord.gg') || u.includes('discord.com/invite');
    const discordUrls = urls.filter(isDiscord);
    const otherUrls = urls.filter(u => !isDiscord(u));

    if (discordUrls.length > 0 && !config.links.allow_discord) {
      await handleViolation(message, 'Discord invite links are not allowed', config.links.action);
      return;
    }
    if (otherUrls.length > 0) {
      await handleViolation(message, 'Links are not allowed', config.links.action);
      return;
    }
  }

  // Invites
  if (config.invites?.enabled) {
    const inviteRegex = /(?:discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]+/g;
    if (inviteRegex.test(content)) {
      await handleViolation(message, 'Server invites are not allowed', config.invites.action);
      return;
    }
  }

  // Banned words
  if (config.banned_words?.enabled && config.banned_words.list?.length) {
    const found = config.banned_words.list.find(w => content.toLowerCase().includes(w.toLowerCase()));
    if (found) {
      await handleViolation(message, `Banned word detected: ${found}`, config.banned_words.action);
      return;
    }
  }

  // Regex patterns
  if (config.regex?.enabled && config.regex.patterns?.length) {
    for (const pattern of config.regex.patterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(content)) {
          await handleViolation(message, 'Message matches a banned pattern', config.regex.action);
          return;
        }
      } catch {}
    }
  }

  // Caps
  if (config.caps?.enabled) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= (config.caps.min_length || 10)) {
      const upper = (content.match(/[A-Z]/g) || []).length;
      const percent = (upper / letters.length) * 100;
      if (percent > (config.caps.max_percent || 70)) {
        await handleViolation(message, 'Too many capital letters', config.caps.action);
        return;
      }
    }
  }

  // Mentions (everyone/here, role and user pings)
  if (config.mentions?.enabled) {
    const mentionCount = (content.match(/@(?:everyone|here)|<@[!&]?\d+>/g) || []).length;
    if (mentionCount > (config.mentions.max || 5)) {
      await handleViolation(message, 'Too many mentions', config.mentions.action);
      return;
    }
  }

  // Emojis (custom + unicode)
  if (config.emojis?.enabled) {
    const custom = (content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
    const unicode = (content.match(/\p{Extended_Pictographic}/gu) || []).length;
    const emojiCount = custom + unicode;
    if (emojiCount > (config.emojis.max || 10)) {
      await handleViolation(message, 'Too many emojis', config.emojis.action);
      return;
    }
  }

  // Custom words
  if (config.words?.enabled && config.words.list?.length) {
    const found = config.words.list.find(w => content.toLowerCase().includes(w.toLowerCase()));
    if (found) {
      await handleViolation(message, `Blocked word: ${found}`, config.words.action);
      return;
    }
  }

  // New accounts
  if (config.new_accounts?.enabled) {
    const age = Date.now() - member.user.createdTimestamp;
    const minAge = (config.new_accounts.min_age_days || 7) * 864e5;
    if (age < minAge) {
      await handleViolation(message, 'Account too new', config.new_accounts.action || 'kick');
      return;
    }
  }
}

async function handleViolation(message, reason, action = 'delete') {
  try {
    await message.delete().catch(() => {});

    const config = await getConfig(message.guild.id);

    if (action === 'timeout' && message.member.moderatable) {
      const duration = (config.timeout_duration || 5) * 60 * 1000;
      await message.member.timeout(duration, `AutoMod: ${reason}`).catch(() => {});
    } else if (action === 'kick' && message.member.kickable) {
      await message.member.kick(`AutoMod: ${reason}`).catch(() => {});
    }

    // Log
    if (config.log_channel) {
      const logChannel = message.guild.channels.cache.get(config.log_channel);
      if (logChannel) {
        logChannel.send({
          content: `🛡️ **AutoMod** ${message.author.tag} in <#${message.channel.id}>\nReason: ${reason}\nAction: ${action}\nContent: ${message.content.slice(0, 500) || '(none)'}`,
        }).catch(() => {});
      }
    }
  } catch {}
}

module.exports = { getConfig, setConfig, checkMessage };
