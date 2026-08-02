/**
 * FiveM bridge service — handles config, API keys, command queue, verify flow,
 * player snapshots, and license-Discord links.
 */
const crypto = require('crypto');
const db = require('../../database/db');
const settings = require('../../services/settings');

const DEFAULT_CONFIG = {
  enabled: false,
  framework: 'none',
  pollInterval: 5,
  verifiedRole: null,
  announceChannel: null,
  playerFeedChannel: null,
};

function getConfig(guildId) {
  const row = db.prepare('SELECT * FROM fivem_config WHERE guild_id = ?').get(guildId);
  if (!row) return { ...DEFAULT_CONFIG, secret: null };
  return {
    ...DEFAULT_CONFIG,
    secret: row.secret,
    enabled: row.enabled === 1,
    framework: row.framework,
    pollInterval: row.poll_interval,
    verifiedRole: row.verified_role,
    announceChannel: row.announce_channel,
    playerFeedChannel: row.player_feed_channel,
  };
}

function setConfig(guildId, patch) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT guild_id FROM fivem_config WHERE guild_id = ?').get(guildId);
  if (existing) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(patch)) {
      const col = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      if (col !== 'guild_id') {
        fields.push(`${col} = ?`);
        params.push(value === true ? 1 : value === false ? 0 : value);
      }
    }
    if (fields.length) {
      fields.push('updated_at = ?');
      params.push(now);
      params.push(guildId);
      db.prepare(`UPDATE fivem_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...params);
    }
  } else {
    const cfg = { ...DEFAULT_CONFIG, ...patch };
    db.prepare(
      `INSERT INTO fivem_config (guild_id, secret, enabled, framework, poll_interval, verified_role, announce_channel, player_feed_channel, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      guildId,
      cfg.secret,
      cfg.enabled ? 1 : 0,
      cfg.framework,
      cfg.pollInterval,
      cfg.verifiedRole,
      cfg.announceChannel,
      cfg.playerFeedChannel,
      now,
      now
    );
  }
  return getConfig(guildId);
}

function generateSecret() {
  return crypto.randomBytes(24).toString('hex');
}

function rotateSecret(guildId) {
  const secret = generateSecret();
  setConfig(guildId, { secret });
  return secret;
}

function verifySecret(guildId, secret) {
  const cfg = getConfig(guildId);
  if (!cfg.secret) return false;
  return crypto.timingSafeEqual(Buffer.from(cfg.secret), Buffer.from(secret));
}

/** Queue a command from Discord → FiveM. */
function queueCommand(guildId, type, args = {}, fromId = null) {
  db.prepare(
    `INSERT INTO fivem_commands (guild_id, type, args, from_id, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(guildId, type, JSON.stringify(args), fromId, new Date().toISOString());
}

/** Get pending commands for a guild (for the resource to poll). */
function getPendingCommands(guildId) {
  return db.prepare(
    `SELECT id, type, args, from_id FROM fivem_commands
     WHERE guild_id = ? AND status = 'pending'
     ORDER BY created_at ASC`
  ).all(guildId);
}

/** Acknowledge a command from the resource. */
function ackCommand(guildId, id, ok) {
  db.prepare(
    `UPDATE fivem_commands SET status = ?, acked_at = ? WHERE id = ? AND guild_id = ?`
  ).run(ok ? 'done' : 'failed', new Date().toISOString(), id, guildId);
}

/** Upsert player snapshot from heartbeat. */
function upsertPlayers(guildId, players) {
  const stmt = db.prepare(
    `INSERT INTO fivem_players (guild_id, player_id, name, ping, connected, license, discord, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, player_id) DO UPDATE SET
       name = excluded.name,
       ping = excluded.ping,
       connected = excluded.connected,
       license = excluded.license,
       discord = excluded.discord,
       last_seen = excluded.last_seen`
  );
  const tx = db.transaction((arr) => {
    for (const p of arr) {
      stmt.run(guildId, p.id, p.name, p.ping, p.connected, p.license, p.discord, new Date().toISOString());
    }
  });
  tx(players);
}

/** Get recent player snapshot for dashboard. */
function getPlayers(guildId) {
  return db.prepare(
    `SELECT player_id, name, ping, connected, license, discord, last_seen
     FROM fivem_players WHERE guild_id = ?
     ORDER BY last_seen DESC LIMIT 200`
  ).all(guildId);
}

/** Create a verify code for /verify in Discord. */
function createVerifyCode(guildId, userId, ttlMinutes = 5) {
  const code = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO fivem_verify (code, guild_id, user_id, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(code, guildId, userId, expires);
  return { code, expiresAt: expires };
}

/** Consume a verify code from the resource. */
function consumeVerifyCode(guildId, code) {
  const row = db.prepare(
    `SELECT code, guild_id, user_id, expires_at FROM fivem_verify
     WHERE code = ? AND guild_id = ?`
  ).get(code, guildId);
  if (!row) return { ok: false, error: 'Invalid or expired code.' };
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM fivem_verify WHERE code = ?').run(code);
    return { ok: false, error: 'Code expired.' };
  }
  db.prepare('DELETE FROM fivem_verify WHERE code = ?').run(code);
  return { ok: true, userId: row.user_id };
}

/** Link a FiveM license to a Discord user. */
function linkLicense(guildId, userId, license, playerName) {
  db.prepare(
    `INSERT INTO fivem_links (guild_id, user_id, license, player_name, linked_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, license) DO UPDATE SET
       user_id = excluded.user_id,
       player_name = excluded.player_name,
       linked_at = excluded.linked_at`
  ).run(guildId, userId, license, playerName, new Date().toISOString());
}

/** Get linked Discord user for a license. */
function getLinkByLicense(guildId, license) {
  return db.prepare(
    `SELECT user_id, player_name, linked_at FROM fivem_links
     WHERE guild_id = ? AND license = ?`
  ).get(guildId, license);
}

/** Get linked license for a Discord user. */
function getLinkByUser(guildId, userId) {
  return db.prepare(
    `SELECT license, player_name, linked_at FROM fivem_links
     WHERE guild_id = ? AND user_id = ?`
  ).all(guildId, userId);
}

module.exports = {
  getConfig,
  setConfig,
  generateSecret,
  rotateSecret,
  verifySecret,
  queueCommand,
  getPendingCommands,
  ackCommand,
  upsertPlayers,
  getPlayers,
  createVerifyCode,
  consumeVerifyCode,
  linkLicense,
  getLinkByLicense,
  getLinkByUser,
};