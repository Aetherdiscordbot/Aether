/**
 * Auto-responses: keyword-triggered replies. Free match types: exact,
 * starts, ends, contains. Premium adds regex + per-trigger cooldowns.
 */
const db = require('../database/db');

function list(guildId) {
  return db.prepare('SELECT * FROM auto_responses WHERE guild_id = ? ORDER BY id ASC').all(guildId);
}

function count(guildId) {
  return db.prepare('SELECT COUNT(*) AS n FROM auto_responses WHERE guild_id = ?').get(guildId).n;
}

function add({ guildId, trigger, response, matchType = 'exact', cooldown = 0, createdBy }) {
  trigger = (trigger || '').trim();
  response = (response || '').trim();
  if (!trigger || !response) return 'Trigger and response are required.';
  if (trigger.length > 200) return 'Trigger is limited to 200 characters.';
  if (response.length > 2000) return 'Response is limited to 2000 characters.';
  const exists = db.prepare('SELECT id FROM auto_responses WHERE guild_id = ? AND trigger = ?').get(guildId, trigger);
  if (exists) return 'An auto-response with that trigger already exists.';

  db.prepare(
    'INSERT INTO auto_responses (guild_id, trigger, response, match_type, cooldown, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(guildId, trigger, response, matchType, Math.max(0, Math.min(3600, cooldown || 0)), createdBy, new Date().toISOString());
  return null;
}

function remove(guildId, trigger) {
  return db.prepare('DELETE FROM auto_responses WHERE guild_id = ? AND trigger = ?').run(guildId, trigger).changes > 0;
}

const MATCHERS = {
  exact: (content, trigger) => content === trigger,
  starts: (content, trigger) => content.startsWith(trigger),
  ends: (content, trigger) => content.endsWith(trigger),
  contains: (content, trigger) => content.includes(trigger),
  regex: (content, trigger) => {
    try {
      return new RegExp(trigger, 'i').test(content);
    } catch {
      return false;
    }
  },
};

function matches(row, content) {
  const matcher = MATCHERS[row.match_type] || MATCHERS.exact;
  return matcher(content.toLowerCase(), row.trigger.toLowerCase());
}

const lastUsed = new Map();

/** Check a message against the guild's auto-responses and reply on match. */
function check(message) {
  if (!message.guild || message.author.bot) return;
  const rows = list(message.guild.id);
  if (!rows.length) return;
  const content = (message.content || '').trim().toLowerCase();
  if (!content) return;

  for (const row of rows) {
    if (!matches(row, content)) continue;
    const key = `${message.guild.id}:${row.id}`;
    const last = lastUsed.get(key) || 0;
    if (row.cooldown && Date.now() - last < row.cooldown * 1000) continue;
    lastUsed.set(key, Date.now());
    message.channel.send({ content: row.response, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }
}

module.exports = { list, count, add, remove, check, MATCHERS };
