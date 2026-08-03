/**
 * Advanced AutoMod service.
 */
const { createClient } = require('@supabase/supabase-js');
const { TimeoutType } = require('discord.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getConfig(guildId) {
  const { data } = await supabase.from('automod_config').select('config').eq('guild_id', guildId).single();
  return data?.config || {};
}

async function setConfig(guildId, config) {
  await supabase.from('automod_config').upsert({ guild_id: guildId, config });
}

async function checkMessage(message) {
  if (message.author.bot || !message.guild) return;
  if (!message.member?.moderatable) return;

  const config = await getConfig(message.guild.id);
  if (!config.enabled) return;

  const content = message.content;
  const member = message.member;

  // Links
  if (config.links?.enabled) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];
    const discordUrls = urls.filter(u => u.includes('discord.gg') || u.includes('discord.com/invite'));
    const otherUrls = urls.filter(u => !u.includes('discord.gg') && !u.includes('discord.com/invite'));
    
    if (!config.links.allow_discord && discordUrls.length > 0) {
      await handleViolation(message, 'Discord invite links are not allowed');
      return;
    }
    if (config.links.enabled && otherUrls.length > 0 && !config.links.allow_discord) {
      await handleViolation(message, 'Links are not allowed');
      return;
    }
  }

  // Invites
  if (config.invites?.enabled) {
    const inviteRegex = /(?:discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]+/g;
    if (inviteRegex.test(content)) {
      await handleViolation(message, 'Server invites are not allowed');
      return;
    }
  }

  // Banned words
  if (config.banned_words?.enabled && config.banned_words.list?.length) {
    const found = config.banned_words.list.find(w => content.toLowerCase().includes(w.toLowerCase()));
    if (found) {
      await handleViolation(message, `Banned word detected: ${found}`);
      return;
    }
  }

  // Regex patterns
  if (config.regex?.enabled && config.regex.patterns?.length) {
    for (const pattern of config.regex.patterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(content)) {
          await handleViolation(message, 'Message matches a banned pattern');
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
        await handleViolation(message, 'Too many capital letters');
        return;
      }
    }
  }

  // Mentions
  if (config.mentions?.enabled) {
    const mentionCount = (content.match(/@(?:everyone|here|&[0-9]+)/g) || []).length;
    if (mentionCount > (config.mentions.max || 5)) {
      await handleViolation(message, 'Too many mentions');
      return;
    }
  }

  // Emojis
  if (config.emojis?.enabled) {
    const emojiCount = (content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
    if (emojiCount > (config.emojis.max || 10)) {
      await handleViolation(message, 'Too many emojis');
      return;
    }
  }

  // Spam (rate limit per channel)
  if (config.spam?.enabled) {
    const key = `spam:${message.guild.id}:${message.channel.id}:${message.author.id}`;
    // Would need a rate limiter map - simplified here
  }

  // Custom words
  if (config.words?.enabled && config.words.list?.length) {
    const found = config.words.list.find(w => content.toLowerCase().includes(w.toLowerCase()));
    if (found) {
      await handleViolation(message, `Blocked word: ${found}`);
      return;
    }
  }

  // New accounts
  if (config.new_accounts?.enabled) {
    const age = Date.now() - member.user.createdTimestamp;
    const minAge = (config.new_accounts.min_age_days || 7) * 864e5;
    if (age < minAge) {
      await handleViolation(message, 'Account too new', 'kick');
      return;
    }
  }
}

async function handleViolation(message, reason, overrideAction = null) {
  try {
    await message.delete().catch(() => {});
    const config = await getConfig(message.guild.id);
    const action = overrideAction || config.words?.action || 'delete';
    
    if (action === 'timeout' && message.member.moderatable) {
      await message.member.timeout(5 * 60 * 1000, `AutoMod: ${reason}`).catch(() => {});
    } else if (action === 'kick' && message.member.kickable) {
      await message.member.kick(`AutoMod: ${reason}`).catch(() => {});
    }
    
    // Log
    const config = await getConfig(message.guild.id);
    if (config.log_channel) {
      const logChannel = message.guild.channels.cache.get(config.log_channel);
      if (logChannel) {
        logChannel.send({ content: `🛡️ **AutoMod** ${message.author.tag} in <#${message.channel.id}>\nReason: ${reason}\nAction: ${action}` }).catch(() => {});
      }
    }
  } catch {}
}

module.exports = { getConfig, setConfig, checkMessage };