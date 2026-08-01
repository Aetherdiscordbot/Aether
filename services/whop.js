/**
 * Whop integration layer.
 *
 * - Constructs the @whop/sdk client (API key + webhook verification key).
 * - Verifies + unwraps webhook payloads (Standard Webhooks spec).
 * - Extracts the Discord identity from checkout custom-field responses.
 * - Resolves / re-validates memberships for the manual /premium activate path.
 */
const config = require('../config/config');
const logger = require('./logger');

let WhopClass = null;
try {
  const mod = require('@whop/sdk');
  WhopClass = mod.default || mod;
} catch (err) {
  logger.warn(`@whop/sdk not installed (${err.message}). Premium API calls disabled.`);
}

let client = null;

/** True when the API key is configured (webhook secret not required for API calls). */
function isConfigured() {
  return Boolean(WhopClass && config.whop.apiKey);
}

/** True when webhook verification is fully configured. */
function isWebhookConfigured() {
  return Boolean(WhopClass && config.whop.apiKey && config.whop.webhookSecret);
}

/** Lazily build the SDK client. webhookKey must be base64-encoded (Standard Webhooks). */
function getClient() {
  if (!isConfigured()) throw new Error('Whop is not configured (WHOP_API_KEY missing)');
  if (!client) {
    client = new WhopClass({
      apiKey: config.whop.apiKey,
      webhookKey: Buffer.from(config.whop.webhookSecret || '', 'utf8').toString('base64'),
    });
  }
  return client;
}

/**
 * Verify + unwrap a webhook request.
 * @param {string} body Raw request body text.
 * @param {object} headers Request headers (object of lower/whatever-cased keys).
 * @returns {object} The verified event `{ id, type, data }`.
 * @throws If signature is invalid or Whop isn't configured.
 */
function verifyWebhook(body, headers) {
  if (!isWebhookConfigured()) throw new Error('Whop webhook verification is not configured');
  const sdk = getClient();
  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    normalizedHeaders[k.toLowerCase()] = v;
  }
  return sdk.webhooks.unwrap(body, { headers: normalizedHeaders });
}

/**
 * Extract Discord identity from a membership's checkout custom-field responses.
 * Matches on field ID (stable) rather than question text (editable).
 * @param {object} membership A Whop membership object.
 * @returns {{discordUsername: string|null, discordServerId: string|null}}
 */
function extractCheckoutFields(membership) {
  const responses = membership?.custom_field_responses || membership?.customFields || [];
  const usernameField = (Array.isArray(responses) ? responses : []).find(
    (f) => f?.id === config.whop.customFields.discordUsername
  );
  const serverField = (Array.isArray(responses) ? responses : []).find(
    (f) => f?.id === config.whop.customFields.discordServerId
  );
  return {
    discordUsername: usernameField?.answer?.trim() || null,
    discordServerId: serverField?.answer?.trim() || null,
  };
}

/** True if the membership status still counts as an active paid subscription. */
function isActiveStatus(status) {
  return config.whop.activeStatuses.includes(String(status || '').toLowerCase());
}

/** Plan label for a membership (falls back to product title). */
function getPlanLabel(membership) {
  return (
    membership?.plan?.id ||
    membership?.product?.title ||
    membership?.plan?.title ||
    'premium'
  );
}

/**
 * Resolve a membership from a user-provided identifier for /premium activate.
 * Accepts a membership ID (mem_...) or a Whop username.
 * @param {string} identifier
 * @returns {Promise<object>} The active membership.
 * @throws If nothing active is found.
 */
async function resolveMembership(identifier) {
  const sdk = getClient();
  const id = String(identifier || '').trim();

  if (/^mem_/i.test(id)) {
    const membership = await sdk.memberships.retrieve(id);
    if (!isActiveStatus(membership?.status)) {
      throw new Error('That membership is not active.');
    }
    return membership;
  }

  // Username path: find the Whop user, then their memberships.
  let user = null;
  try {
    const page = await sdk.users.list({ username: id, first: 25 });
    const list = Array.isArray(page?.data) ? page.data : [];
    user = list.find((u) => (u?.username || '').toLowerCase() === id.toLowerCase());
  } catch (err) {
    logger.debug(`Whop username lookup failed (${err.message})`);
  }

  if (!user?.id) throw new Error('Could not find a Whop account with that username.');

  const memberships = await sdk.memberships.list({
    user_ids: [user.id],
    ...(config.whop.companyId ? { company_id: config.whop.companyId } : {}),
    statuses: config.whop.activeStatuses,
    first: 25,
  });

  const list = Array.isArray(memberships?.data) ? memberships.data : [];
  if (config.whop.productId) {
    const match = list.find(
      (m) => m?.product?.id === config.whop.productId || m?.plan?.id === config.whop.productId
    );
    if (match) return match;
  }
  if (list.length) return list[0];
  throw new Error('No active Aether Premium membership found for that account.');
}

/**
 * Directly verify that a membership is still valid (used by premium guards).
 * @param {string} membershipId
 * @returns {Promise<boolean>}
 */
async function membershipIsValid(membershipId) {
  try {
    const membership = await getClient().memberships.retrieve(membershipId);
    return isActiveStatus(membership?.status);
  } catch (err) {
    logger.warn(`Whop membership check failed for ${membershipId}: ${err.message}`);
    return false;
  }
}

module.exports = {
  isConfigured,
  isWebhookConfigured,
  getClient,
  verifyWebhook,
  extractCheckoutFields,
  isActiveStatus,
  getPlanLabel,
  resolveMembership,
  membershipIsValid,
};
