/**
 * AI Moderation service (premium only) — uses OpenAI moderation endpoint.
 */
const { createClient } = require('@supabase/supabase-js');
const premiumService = require('./premium');
const config = require('../config/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function moderateContent(message) {
  const prem = await premiumService.isPremium(message.guild.id);
  if (!prem) return { action: 'none' };

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openRouterKey}`, // Using OpenRouter key as fallback
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: message.content }),
    });
    
    if (!res.ok) return { action: 'none' };
    
    const data = await res.json();
    const result = data.results[0];
    
    if (result.flagged) {
      const categories = Object.entries(result.categories).filter(([_, v]) => v).map(([k]) => k);
      return { action: 'delete', reason: `AI flagged: ${categories.join(', ')}`, flagged: true };
    }
    return { action: 'none' };
  } catch {
    return { action: 'none' };
  }
}

module.exports = { moderateContent };