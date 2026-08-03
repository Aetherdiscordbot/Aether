/**
 * AI Moderation service (premium only) — uses OpenRouter chat for content moderation.
 */
const premiumService = require('./premium');
const ai = require('./ai');

const SYSTEM_PROMPT =
  'You are a content moderation system. Determine if the message violates content ' +
  'policies (hate speech, harassment, sexual content, self-harm, violence, ' +
  'threats, illegal activity, or minors in a sexual context). ' +
  'Reply with ONLY a JSON object, no other text, in this exact format: ' +
  '{"flagged": false} or {"flagged": true, "categories": ["category1", "category2"]}';

async function moderateContent(message) {
  const prem = await premiumService.isPremium(message.guild.id);
  if (!prem) return { action: 'none' };

  try {
    const { content } = await ai.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Message: ${message.content}` },
      ],
      { maxTokens: 50, temperature: 0 }
    );

    const result = parseResult(content);
    if (!result || !result.flagged) return { action: 'none' };

    const categories = Array.isArray(result.categories) ? result.categories : ['content'];
    return { action: 'delete', reason: `AI flagged: ${categories.join(', ')}`, flagged: true };
  } catch {
    return { action: 'none' };
  }
}

function parseResult(content) {
  try {
    const cleaned = content.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

module.exports = { moderateContent };
