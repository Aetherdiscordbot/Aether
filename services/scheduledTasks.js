/**
 * Scheduled tasks: DB-backed one-shot actions (timed slowmode releases,
 * scheduled messages) surfaced in the Automation tab. processDue() is wired
 * to a scheduler interval in events/ready.js.
 */
const db = require('../database/db');
const logger = require('./logger');

function create({ guildId, type, channelId, payload = {}, runAt, createdBy }) {
  const at = new Date(runAt);
  if (Number.isNaN(at.getTime())) throw new Error('Invalid run time.');
  const result = db
    .prepare(
      `INSERT INTO scheduled_tasks (guild_id, type, channel_id, payload, run_at, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .run(guildId, type, channelId, JSON.stringify(payload), at.toISOString(), createdBy, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

function cancel(id, guildId) {
  return db.prepare(`UPDATE scheduled_tasks SET status = 'cancelled' WHERE id = ? AND guild_id = ? AND status = 'pending'`).run(id, guildId).changes;
}

function pending(guildId) {
  return db
    .prepare(
      `SELECT * FROM scheduled_tasks WHERE guild_id = ? AND status = 'pending'
       ORDER BY run_at ASC LIMIT 100`
    )
    .all(guildId)
    .map(parseRow);
}

function allPending() {
  return db
    .prepare(`SELECT * FROM scheduled_tasks WHERE status = 'pending' AND run_at <= ? ORDER BY run_at ASC LIMIT 50`)
    .all(new Date().toISOString())
    .map(parseRow);
}

function parseRow(row) {
  try {
    row.payload = JSON.parse(row.payload || '{}');
  } catch {
    row.payload = {};
  }
  return row;
}

/** Fire every due task. Non-fatal per task; failures are marked failed. */
async function processDue(client) {
  for (const task of allPending()) {
    const guild = client.guilds.cache.get(task.guild_id);
    const channel = guild?.channels.cache.get(task.channel_id);
    try {
      if (task.type === 'slowmode_release') {
        if (channel?.isTextBased()) {
          await channel.setRateLimitPerUser(0, 'Aether scheduled slowmode release');
        } else {
          throw new Error('Slowmode release target channel not found.');
        }
      } else if (task.type === 'scheduled_message') {
        if (!channel?.isTextBased()) throw new Error('Scheduled message channel not found.');
        await channel.send({ content: String(task.payload.content || '') });
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
      db.prepare(`UPDATE scheduled_tasks SET status = 'done' WHERE id = ?`).run(task.id);
      logger.debug(`Scheduled task ${task.id} (${task.type}) executed in ${task.guild_id}`);
    } catch (err) {
      db.prepare(`UPDATE scheduled_tasks SET status = 'failed' WHERE id = ?`).run(task.id);
      logger.warn(`Scheduled task ${task.id} (${task.type}) failed: ${err.message}`);
    }
  }
}

/** Prune finished/cancelled tasks older than `days`. */
function prune(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  db.prepare(`DELETE FROM scheduled_tasks WHERE status != 'pending' AND created_at < ?`).run(cutoff);
}

module.exports = { create, cancel, pending, allPending, processDue, prune };
