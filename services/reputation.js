/**
 * Reputation service: give, count and leaderboard.
 */
const db = require('../database/db');

/** Give reputation to a member. Returns error string or null on success. */
function giveRep({ guildId, fromId, toId, reason }) {
  if (fromId === toId) return 'You cannot give reputation to yourself.';
  if (!reason) return null;

  const last = db
    .prepare('SELECT created_at FROM reputation WHERE guild_id = ? AND from_id = ? ORDER BY id DESC LIMIT 1')
    .get(guildId, fromId);
  if (last && Date.now() - Date.parse(last.created_at) < 6 * 60 * 60 * 1000) {
    return 'You can only give reputation once every 6 hours.';
  }

  db.prepare(
    'INSERT INTO reputation (guild_id, from_id, to_id, reason, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, fromId, toId, reason, new Date().toISOString());
  return null;
}

function countFor(guildId, userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM reputation WHERE guild_id = ? AND to_id = ?').get(guildId, userId).n;
}

function leaderboard(guildId, limit = 10) {
  return db
    .prepare('SELECT to_id, COUNT(*) AS n FROM reputation WHERE guild_id = ? GROUP BY to_id ORDER BY n DESC LIMIT ?')
    .all(guildId, limit);
}

module.exports = { giveRep, countFor, leaderboard };
