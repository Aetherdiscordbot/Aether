/**
 * AI service — OpenRouter-powered chat + image generation.
 * Config: OPENROUTER_API_KEY, OPENROUTER_CHAT_MODEL, OPENROUTER_IMAGE_MODEL,
 * OPENROUTER_MAX_TOKENS. Uses axios (already a dependency), so no install
 * scripts are needed on the panel.
 */
const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

const BASE = 'https://openrouter.ai/api/v1';

/** Reliable GA image model used if the configured one is invalid/retired. */
const FALLBACK_IMAGE_MODEL = 'google/gemini-2.5-flash-image';

function isConfigured() {
  return Boolean(config.ai.openRouterKey);
}

function headers() {
  return {
    Authorization: `Bearer ${config.ai.openRouterKey}`,
    'HTTP-Referer': config.web.baseUrl || 'https://aether.ocrp.cc',
    'X-Title': config.name || 'Aether',
    'Content-Type': 'application/json',
  };
}

/** Extract a useful message from an OpenRouter/axios error. */
function errMessage(err) {
  const detail = err?.response?.data?.error;
  if (detail) {
    const msg = detail.message || detail;
    return typeof msg === 'string' ? msg : JSON.stringify(msg);
  }
  return err?.message || 'Unknown error';
}

/** Chat completion → plain text reply. */
async function chat(prompt, { system, model } = {}) {
  if (!isConfigured()) throw new Error('AI is not configured (missing OPENROUTER_API_KEY).');
  try {
    const { data } = await axios.post(
      `${BASE}/chat/completions`,
      {
        model: model || config.ai.chatModel,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: config.ai.maxTokens,
      },
      { headers: headers(), timeout: 120_000 }
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI returned an empty response.');
    return String(text).trim();
  } catch (err) {
    throw new Error(errMessage(err));
  }
}

/** Image generation → { buffer } (data URL from the model) or error. */
async function image(prompt) {
  if (!isConfigured()) throw new Error('AI is not configured (missing OPENROUTER_API_KEY).');

  const generate = async (model) => {
    const { data } = await axios.post(
      `${BASE}/chat/completions`,
      {
        model,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.ai.maxTokens,
      },
      { headers: headers(), timeout: 180_000 }
    );
    const content = data?.choices?.[0]?.message?.content;
    const parts = Array.isArray(content) ? content : [content];
    for (const part of parts) {
      if (typeof part === 'string' && part.startsWith('data:image/')) {
        return { buffer: Buffer.from(part.split(',')[1], 'base64') };
      }
      if (part && typeof part === 'object' && typeof part.image_url?.url === 'string' && part.image_url.url.startsWith('data:image/')) {
        return { buffer: Buffer.from(part.image_url.url.split(',')[1], 'base64') };
      }
    }
    throw new Error('The image model did not return an image.');
  };

  const models = [config.ai.imageModel];
  if (config.ai.imageModel !== FALLBACK_IMAGE_MODEL) models.push(FALLBACK_IMAGE_MODEL);

  let lastErr;
  for (const model of models) {
    try {
      const result = await generate(model);
      if (model !== config.ai.imageModel) logger.warn(`AI image: fell back to ${model} (${config.ai.imageModel} unavailable)`);
      return result;
    } catch (err) {
      lastErr = err;
      const msg = errMessage(err);
      const invalid = /not a valid model/i.test(msg) || /model.*(not found|not support)/i.test(msg);
      if (!invalid) throw new Error(msg);
      logger.warn(`AI image: model ${model} invalid, trying next`);
    }
  }
  throw new Error(errMessage(lastErr));
}

module.exports = { isConfigured, chat, image };
