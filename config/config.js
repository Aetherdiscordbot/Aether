/**
 * Central configuration — all from env, no defaults for secrets.
 */
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
    webhookPath: process.env.WEBHOOK_PATH || '/webhooks/whop',
    webhookUrl: process.env.WHOP_WEBHOOK_URL,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  skipCommandSync: process.env.SKIP_COMMAND_SYNC === 'true',
  openRouterKey: process.env.OPENROUTER_API_KEY,
};

function getMissingEnv() {
  return REQUIRED.filter(key => !config[key.replace(/(.)([A-Z])/g, '$1_$2').toLowerCase()]);
}

module.exports = config;
module.exports.getMissingEnv = getMissingEnv;
module.exports.REQUIRED = REQUIRED;