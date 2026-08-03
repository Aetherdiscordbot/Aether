/**
 * Starboard & Skullboard service.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getStarConfig(guildId) {
  const { data } = await supabase.from('starboard').select('*').eq('guild_id', guildId).single();
  return data;
}

async function setStarConfig(guildId, channelId, threshold = 5, emoji = '⭐', ignored = []) {
  await supabase.from('starboard').upsert({ guild_id: guildId, channel_id: channelId, threshold, emoji, ignored_channels: ignored });
}

async function getSkullConfig(guildId) {
  const { data } = await supabase.from('skullboard').select('*').eq('guild_id', guildId).single();
  return data;
}

async function setSkullConfig(guildId, channelId, threshold = 3, emoji = '💀', ignored = []) {
  await supabase.from('skullboard').upsert({ guild_id: guildId, channel_id: channelId, threshold, emoji, ignored_channels: ignored });
}

async function handleReaction(message, reaction, user, type) {
  if (user.bot) return;
  const guildId = message.guild.id;
  
  if (type === 'star') {
    const cfg = await getStarConfig(message.guild.id);
    if (!cfg || cfg.ignored_channels.includes(message.channel.id)) return;
    if (reaction.emoji.name !== cfg.emoji) return;
    if (reaction.count < cfg.threshold) return;
  } else {
    const cfg = await getSkullConfig(message.guild.id);
    if (!cfg || cfg.ignored_channels.includes(message.channel.id)) return;
    if (reaction.emoji.name !== cfg.emoji) return;
    if (reaction.count < cfg.threshold) return;
  }

  const type = reaction.emoji.name === '💀' ? 'skull' : 'star';
  const cfg = type === 'star' ? await getStarConfig(message.guild.id) : await getSkullConfig(message.guild.id);
  if (!cfg) return;

  // Check if already posted
  const { data: existing } = await supabase.from('board_messages').select('*').eq('guild_id', message.guild.id).eq('type', type).eq('message_id', message.id).single();
  const boardChannel = message.guild.channels.cache.get(cfg.channel_id);
  if (!boardChannel) return;

  const content = message.content || '(embed/attachment)';
  const embed = {
    color: type === 'star' ? 0xffd700 : 0x222222,
    author: { name: message.author.tag, icon_url: message.author.displayAvatarURL() },
    description: content.slice(0, 4000) + (content.length > 4000 ? '...' : ''),
    footer: { text: `💬 ${message.channel} | ${reaction.count} ${type === 'star' ? '⭐' : '💀'}` },
    timestamp: new Date().toISOString(),
  };

  if (existing) {
    const boardMsg = await boardChannel.messages.fetch(existing.board_message_id).catch(() => null);
    if (boardMsg) {
      await boardMsg.edit({ embeds: [{ ...embed, footer: { text: `💬 ${message.channel} | ${reaction.count} ${type === 'star' ? '⭐' : '💀'}` } }] });
    }
    await supabase.from('board_messages').update({ count: reaction.count, board_message_id: existing.board_message_id }).eq('guild_id', message.guild.id).eq('type', type).eq('message_id', message.id);
  } else {
    const sent = await boardChannel.send({ embeds: [embed] });
    await supabase.from('board_messages').insert({
      guild_id: message.guild.id,
      type,
      message_id: message.id,
      board_message_id: sent.id,
      count: reaction.count,
    });
  }
}

module.exports = { handleReaction };