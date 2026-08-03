/**
 * Central configuration — all from env, no defaults for secrets.
 */
const path = require('path');
const REQUIRED = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_IDS', 'MAIN_GUILD_ID'];

const config = {
  name: 'Aether',
  version: require('../package.json').version,
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  owners: String(process.env.OWNER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  mainGuildId: process.env.MAIN_GUILD_ID,
  whop: {
    apiKey: process.env.WHOP_API_KEY,
    webhookSecret: process.env.WHOP_WEBHOOK_SECRET,
    companyId: process.env.WHOP_COMPANY_ID,
    productId: process.env.WHOP_PRODUCT_ID,
    checkoutUrl: process.env.WHOP_CHECKOUT_URL,
    webhookPort: parseInt(process.env.WEBHOOK_PORT || '14213', 10),
    webhookPath: process.env.WEBHOOK_PATH || '/webhook/whop',
    webhookUrl: process.env.WHOP_WEBHOOK_URL,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  skipCommandSync: process.env.SKIP_COMMAND_SYNC === 'true',
  openRouterKey: process.env.OPENROUTER_API_KEY,
  aiBaseUrl: process.env.AI_BASE_URL || 'http://localhost:11434/v1',
  aiChatModel: process.env.AI_CHAT_MODEL || 'gemma3:4b',
  aiImageBaseUrl: process.env.AI_IMAGE_BASE_URL || 'http://localhost:11434/v1',
  aiImageModel: process.env.AI_IMAGE_MODEL || 'gemma3:4b',
  aiLocal: process.env.AI_LOCAL !== 'false',
  aiModelUrl: process.env.AI_MODEL_URL || 'https://huggingface.co/bartowski/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf',
  aiModelDir: process.env.AI_MODEL_DIR || path.join(__dirname, '..', 'models'),
};

function getMissingEnv() {
  return REQUIRED.filter(key => !config[key.replace(/(.)([A-Z])/g, '$1_$2').toLowerCase()]);
}

module.exports = config;
module.exports.getMissingEnv = getMissingEnv;
module.exports.REQUIRED = REQUIRED;