/**
 * Central configuration + environment validation.
 * Everything that differs between deployments lives here.
 */
const path = require('path');

const REQUIRED = ['DISCORD_TOKEN', 'CLIENT_ID'];

const config = {
  name: 'Aether',
  version: require('../package.json').version,
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  owners: String(process.env.OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  dbPath: path.resolve(__dirname, '..', process.env.DATABASE_PATH || './data/aether.db'),
  logLevel: process.env.LOG_LEVEL || 'info',
  skipCommandSync: process.env.SKIP_COMMAND_SYNC === 'true',

  // The bot's main server. The Aether Premium role (buyer badge) is always
  // granted here, regardless of which server the buyer activates Premium on.
  mainGuildId: process.env.MAIN_GUILD_ID || '',

  webhook: {
    port: parseInt(process.env.WEBHOOK_PORT || '8080', 10),
    path: process.env.WEBHOOK_PATH || '/webhooks/whop',
    url: process.env.WEBHOOK_URL || '',
  },

  // Website + dashboard (Discord OAuth2).
  web: {
    baseUrl: process.env.BASE_URL || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    // Discord OAuth2 app credentials.
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    oauthRedirectUri: process.env.OAUTH_REDIRECT_URI || '',
    // Permissions integer for the bot invite link.
    invitePermissions: 8,
  },

  // OpenRouter AI (premium /ai commands).
  ai: {
    openRouterKey: process.env.OPENROUTER_API_KEY || '',
    chatModel: process.env.OPENROUTER_CHAT_MODEL || 'openai/gpt-4o-mini',
    imageModel: process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image',
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '1000', 10),
    imageMaxTokens: parseInt(process.env.OPENROUTER_IMAGE_MAX_TOKENS || '8192', 10),
  },

  whop: {
    apiKey: process.env.WHOP_API_KEY || '',
    webhookSecret: process.env.WHOP_WEBHOOK_SECRET || '',
    companyId: process.env.WHOP_COMPANY_ID || '',
    productId: process.env.WHOP_PRODUCT_ID || '',
    checkoutUrl: process.env.WHOP_CHECKOUT_URL || 'https://whop.com',
    price: process.env.WHOP_PRICE || '9.99',
    // Statuses that still count as an active paid membership.
    activeStatuses: ['active', 'trialing'],
    // Checkout custom-field IDs that carry the Discord identity.
    // Match on ID, never on question text.
    customFields: {
      discordUsername: 'field_ZuOijKtMobuA',
      discordServerId: 'field_8O4IQJ8md0QY',
    },
  },

  premium: {
    roleName: 'Aether Premium',
    roleColor: '#F1C40F',
  },

  client: {
    intents: [
      'Guilds',
      'GuildMembers',
      'GuildModeration',
      'GuildMessages',
      'GuildMessageReactions',
      'MessageContent',
      'GuildVoiceStates',
      'GuildWebhooks',
      'GuildInvites',
      'GuildPresences',
      'DirectMessages',
    ],
    partials: ['Message', 'Channel', 'Reaction'],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
    presence: {
      status: 'online',
      activities: [{ name: '/help | aether.premium', type: 3 }],
    },
  },
};

/** Returns an array of missing required env var names. */
function getMissingEnv() {
  const configKey = { DISCORD_TOKEN: 'token', CLIENT_ID: 'clientId' };
  return REQUIRED.filter((key) => !config[configKey[key]]);
}

module.exports = config;
module.exports.getMissingEnv = getMissingEnv;
module.exports.REQUIRED = REQUIRED;
