/**
 * OpenRouter AI service — chat + image generation with usage tracking,
 * conversation memory, and rate limits.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const logger = require('./logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const MAX_HISTORY = 10; // messages per conversation
const RATE_LIMIT = { chat: 30, image: 10 }; // per minute per user

const rateLimitMap = new Map(); // "userId:chat" -> [timestamps]

function checkRateLimit(userId, type) {
  const now = Date.now();
  const key = `${userId}:${type}`;
  const arr = rateLimitMap.get(key) || [];
  const recent = arr.filter(t => now - t < 60000);
  if (recent.length >= RATE_LIMIT[type]) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

async function trackUsage(guildId, type, tokens = 0) {
  const day = new Date().toISOString().slice(0, 10);
  const col = type === 'chat' ? 'prompts' : 'images';
  try {
    await supabase.rpc('increment_ai_usage', {
      p_guild_id: guildId,
      p_day: day,
      p_col: col,
      p_tokens: tokens,
    });
  } catch {
    // fallback: upsert manually
    const { data: existing } = await supabase
      .from('ai_usage')
      .select(`${col}, tokens`)
      .eq('guild_id', guildId)
      .eq('day', day)
      .single();
    await supabase.from('ai_usage').upsert({
      guild_id: guildId,
      day: day,
      [col]: (existing?.[col] || 0) + 1,
      tokens: (existing?.tokens || 0) + tokens,
    });
  }
}

async function getHistory(guildId, userId) {
  const { data } = await supabase
    .from('ai_conversations')
    .select('messages')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();
  return data?.messages || [];
}

async function saveHistory(guildId, userId, messages) {
  const trimmed = messages.slice(-MAX_HISTORY);
  await supabase.from('ai_conversations').upsert({
    guild_id: guildId,
    user_id: userId,
    messages: trimmed,
    updated_at: new Date().toISOString(),
  });
}

async function openRouterRequest(path, body) {
  const res = await fetch(`${OPENROUTER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aether.ocrp.cc',
      'X-Title': 'Aether Bot',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }
  return res.json();
}

async function chat(messages, opts = {}) {
  const model = opts.model || config.ai?.chatModel || 'openai/gpt-4o-mini';
  const data = await openRouterRequest('/chat/completions', {
    model,
    messages,
    max_tokens: opts.maxTokens || config.ai?.maxTokens || 1000,
    temperature: opts.temperature ?? 0.7,
  });
  const usage = data.usage?.total_tokens || 0;
  return { content: data.choices?.[0]?.message?.content ?? '', usage };
}

async function image(prompt, opts = {}) {
  const model = opts.model || config.ai?.imageModel || 'google/gemini-2.5-flash-image';
  const data = await openRouterRequest('/images/generations', {
    model,
    prompt,
    n: opts.n || 1,
    size: opts.size || '1024x1024',
  });
  return data.data?.[0]?.url ?? '';
}

/** High-level: chat with history + usage tracking + rate limit. */
async function chatWithHistory(guildId, userId, prompt, systemPrompt, opts = {}) {
  if (!checkRateLimit(userId, 'chat')) throw new Error('Rate limited: max 30 chats/min');
  const history = await getHistory(guildId, userId);
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history, { role: 'user', content: prompt });
  const { content, usage } = await chat(messages, opts);
  messages.push({ role: 'assistant', content });
  await saveHistory(guildId, userId, messages);
  await trackUsage(guildId, 'chat', usage);
  return content;
}

/** High-level: image gen with usage tracking + rate limit. */
async function generateImage(guildId, userId, prompt, opts = {}) {
  if (!checkRateLimit(userId, 'image')) throw new Error('Rate limited: max 10 images/min');
  const url = await image(prompt, opts);
  await trackUsage(guildId, 'image');
  return url;
}

/** Clear a user's conversation history. */
async function clearHistory(guildId, userId) {
  await supabase.from('ai_conversations').delete().eq('guild_id', guildId).eq('user_id', userId);
}

/** Get usage stats for a guild. */
async function getUsage(guildId, days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('guild_id', guildId)
    .gte('day', since)
    .order('day', { ascending: true });
  return data || [];
}

module.exports = {
  chat,
  image,
  chatWithHistory,
  generateImage,
  clearHistory,
  getUsage,
  trackUsage,
};