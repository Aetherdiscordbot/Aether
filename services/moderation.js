/**
 * Moderation helper service: case tracking + punishment logging.
 */
const db = require('../database/db');
const logService = require('./logService');
const { Colors, truncate } = require('../utils/discord');
const { formatDuration } = require('../utils/time');

function createCase({ guildId, userId, moderatorId, action, reason, duration }) {
  const info = db
    .prepare(
      `INSERT INTO moderation_cases (guild_id, user_id, moderator_id, action, reason, duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, userId, moderatorId, action, reason || null, duration || null, new Date().toISOString());
  return info.lastInsertRowid;
}

function getCases(guildId, userId, limit = 10) {
  return db
    .prepare(
      'SELECT * FROM moderation_cases WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?'
    )
    .all(guildId, userId, limit);
}

function addWarning({ guildId, userId, moderatorId, reason }) {
  const info = db
    .prepare(
      `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(guildId, userId, moderatorId, reason || null, new Date().toISOString());
  return info.lastInsertRowid;
}

function getWarnings(guildId, userId) {
  return db
    .prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC')
    .all(guildId, userId);
}

function countWarnings(guildId, userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND user_id = ?').get(guildId, userId).n;
}

function removeWarning(id, guildId) {
  return db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ?').run(id, guildId).changes;
}

/** Log a moderation action to the configured moderation channel. */
function logModeration(guild, { action, target, moderator, reason, duration, color }) {
  return logService.logAction(guild, {
    eventKey: 'moderation',
    action,
    target,
    moderator,
    reason,
    color,
    extraFields: duration ? [{ name: 'Duration', value: formatDuration(duration), inline: true }] : [],
  });
}

/** Standard moderation embed for the in-channel confirmation reply. */
function moderationEmbed({ action, target, reason, caseId, duration }) {
  const { baseEmbed, Colors } = require('../utils/discord');
  return baseEmbed({
    color: Colors.primary,
    title: `✅ ${action}`,
    description: `${target} has been **${action.toLowerCase()}**.`,
    fields: [
      { name: 'Reason', value: reason || 'No reason provided', inline: true },
      ...(duration ? [{ name: 'Duration', value: formatDuration(duration), inline: true }] : []),
      ...(caseId ? [{ name: 'Case ID', value: `#${caseId}`, inline: true }] : []),
    ],
  });
}

module.exports = {
  createCase,
  getCases,
  addWarning,
  getWarnings,
  countWarnings,
  removeWarning,
  logModeration,
  moderationEmbed,
};
