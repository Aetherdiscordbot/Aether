/**
 * Analytics service: activity rollups + member events for the premium
 * Analytics tab. All writes are lightweight upserts on the daily rollup,
 * plus an append-only member_events feed with periodic pruning.
 */
const db = require('../database/db');
const logger = require('./logger');

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Upsert a daily counter row (messages/commands/joins/leaves). */
function upsertDaily(guildId, delta) {
  const fields = Object.keys(delta).filter((k) => delta[k]);
  if (!fields.length) return;
  const set = fields.map((f) => `${f} = ${f} + ?`).join(', ');
  const args = fields.map((f) => delta[f]);
  db.prepare(
    `INSERT INTO activity_daily (guild_id, day, ${fields.join(', ')})
     VALUES (?, ?, ${fields.map(() => '?').join(', ')})
     ON CONFLICT(guild_id, day) DO UPDATE SET ${set}`
  ).run(guildId, today(), ...args);
}

function recordMessage(guildId) {
  try {
    upsertDaily(guildId, { messages: 1 });
  } catch (err) {
    logger.debug(`Analytics: recordMessage failed: ${err.message}`);
  }
}

function recordCommand(guildId) {
  try {
    upsertDaily(guildId, { commands: 1 });
  } catch (err) {
    logger.debug(`Analytics: recordCommand failed: ${err.message}`);
  }
}

/** type: join | leave | kick | ban | unban */
function recordMemberEvent(guildId, type, userId) {
  try {
    db.prepare('INSERT INTO member_events (guild_id, event_type, user_id, created_at) VALUES (?, ?, ?, ?)').run(
      guildId,
      type,
      String(userId),
      new Date().toISOString()
    );
    if (type === 'join') upsertDaily(guildId, { joins: 1 });
    if (type === 'leave') upsertDaily(guildId, { leaves: 1 });
  } catch (err) {
    logger.debug(`Analytics: recordMemberEvent failed: ${err.message}`);
  }
}

function recordAiUsage(guildId, { prompts = 0, images = 0, tokens = 0 } = {}) {
  try {
    db.prepare(
      `INSERT INTO ai_usage (guild_id, day, prompts, images, tokens)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, day) DO UPDATE SET
         prompts = prompts + excluded.prompts,
         images  = images + excluded.images,
         tokens  = tokens + excluded.tokens`
    ).run(guildId, today(), prompts, images, tokens);
  } catch (err) {
    logger.debug(`Analytics: recordAiUsage failed: ${err.message}`);
  }
}

/** Last `days` days of activity as an ordered array (oldest first). */
function activitySeries(guildId, days = 14) {
  const rows = db
    .prepare(
      `SELECT day, messages, commands, joins, leaves FROM activity_daily
       WHERE guild_id = ? ORDER BY day ASC`
    )
    .all(guildId);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const row = byDay.get(d);
    out.push({
      day: d,
      messages: row?.messages || 0,
      commands: row?.commands || 0,
      joins: row?.joins || 0,
      leaves: row?.leaves || 0,
    });
  }
  return out;
}

function memberEvents(guildId, limit = 25) {
  return db
    .prepare('SELECT event_type, user_id, created_at FROM member_events WHERE guild_id = ? ORDER BY id DESC LIMIT ?')
    .all(guildId, limit);
}

function totals(guildId, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT COALESCE(SUM(messages), 0) AS messages, COALESCE(SUM(commands), 0) AS commands,
              COALESCE(SUM(joins), 0) AS joins, COALESCE(SUM(leaves), 0) AS leaves
       FROM activity_daily WHERE guild_id = ? AND day >= ?`
    )
    .get(guildId, since);
}

/** AI usage for the AI Center tab: totals + today's breakdown. */
function aiTotals(guildId) {
  const all = db
    .prepare(
      `SELECT COALESCE(SUM(prompts), 0) AS prompts, COALESCE(SUM(images), 0) AS images, COALESCE(SUM(tokens), 0) AS tokens
       FROM ai_usage WHERE guild_id = ?`
    )
    .get(guildId);
  const t = db
    .prepare('SELECT prompts, images, tokens FROM ai_usage WHERE guild_id = ? AND day = ?')
    .get(guildId, today());
  return {
    prompts: all.prompts,
    images: all.images,
    tokens: all.tokens,
    today: t || { prompts: 0, images: 0, tokens: 0 },
  };
}

/** Delete member events older than `days` (keeps the table small). */
function prune(days = 90) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  db.prepare('DELETE FROM member_events WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM activity_daily WHERE day < ?').run(new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10));
}

module.exports = {
  recordMessage,
  recordCommand,
  recordMemberEvent,
  recordAiUsage,
  activitySeries,
  memberEvents,
  totals,
  aiTotals,
  prune,
};
