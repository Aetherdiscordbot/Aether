/**
 * Discord OAuth2 for the website/dashboard.
 *
 * Flow: /login -> Discord authorize -> /auth/callback (exchange code) ->
 * fetch /users/@me + /users/@me/guilds -> store in session.
 */
const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

const OAUTH_AUTHORIZE = 'https://discord.com/oauth2/authorize';
const OAUTH_TOKEN = 'https://discord.com/api/oauth2/token';
const API = 'https://discord.com/api/v10';

const SCOPES = ['identify', 'guilds'];

function isConfigured() {
  return Boolean(config.web.oauthClientSecret && config.web.oauthRedirectUri);
}

/** Build the Discord authorize URL for a given state. */
function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.web.oauthRedirectUri,
    scope: SCOPES.join(' '),
    state,
  });
  return `${OAUTH_AUTHORIZE}?${params.toString()}`;
}

/** Exchange an authorization code for an access token. */
async function exchangeCode(code) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.web.oauthClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.web.oauthRedirectUri,
  });
  const res = await axios.post(OAUTH_TOKEN, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data; // { access_token, token_type, expires_in, scope, refresh_token }
}

/** Fetch the current user's profile. */
async function fetchUser(accessToken) {
  const res = await axios.get(`${API}/users/@me`, { headers: authHeaders(accessToken) });
  return res.data;
}

/** Fetch the user's guild list (id, name, icon, permissions, owner). */
async function fetchGuilds(accessToken) {
  const res = await axios.get(`${API}/users/@me/guilds`, { headers: authHeaders(accessToken) });
  return res.data;
}

/** Discord PermissionBits.MANAGE_GUILD */
const MANAGE_GUILD = 1n << 5n;

/** True if the user's guild permission set includes MANAGE_GUILD (or owner). */
function canManageGuild(guild) {
  if (guild?.owner) return true;
  if (!guild?.permissions) return false;
  return (BigInt(guild.permissions) & MANAGE_GUILD) !== 0n;
}

/** Discord PermissionBits.ADMINISTRATOR */
const ADMINISTRATOR = 1n << 3n;

function canAdministrate(guild) {
  if (guild?.owner) return true;
  if (!guild?.permissions) return false;
  return (BigInt(guild.permissions) & ADMINISTRATOR) !== 0n;
}

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

module.exports = {
  isConfigured,
  buildAuthorizeUrl,
  exchangeCode,
  fetchUser,
  fetchGuilds,
  canManageGuild,
  canAdministrate,
};
