/**
 * Reminder service: schedules and fires user reminders (DM or channel).
 * Premium: unlimited reminders, recurring intervals, channel reminders.
 */
const { randomUUID } = require('crypto');
const db = require('../database/db');
const logger = require('./logger');
const { successEmbed } = require('../utils/discord');

function createReminder({ userId, channelId, guildId, message, remindAt, repeat }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO reminders (id, user_id, channel_id, guild_id, message, remind_at, repeat_interval, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, channelId || null, guildId || null, message, new Date(remindAt).toISOString(), repeat || null, new Date().toISOString());
  return id;
}

function listReminders(userId) {
  return db
    .prepare('SELECT * FROM reminders WHERE user_id = ? AND sent = 0 ORDER BY remind_at ASC')
    .all(userId);
}

function countActive(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM reminders WHERE user_id = ? AND sent = 0').get(userId).n;
}

function deleteReminder(id, userId) {
  return db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(id, userId).changes;
}

/** Compute the next fire time for a repeating interval. */
function nextRepeat(interval, fromMs) {
  const next = new Date(fromMs);
  if (interval === 'hourly') next.setHours(next.getHours() + 1);
  else if (interval === 'daily') next.setDate(next.getDate() + 1);
  else if (interval === 'weekly') next.setDate(next.getDate() + 7);
  else if (interval === 'monthly') next.setMonth(next.getMonth() + 1);
  else return null;
  return next;
}

/** Fire any reminders that are due (reschedules repeating ones). */
async function processDue(client) {
  const now = new Date().toISOString();
  const due = db.prepare("SELECT * FROM reminders WHERE sent = 0 AND remind_at <= ? LIMIT 50").all(now);
  for (const row of due) {
    try {
      let target = null;
      if (row.channel_id && row.guild_id) {
        const guild = client.guilds.cache.get(row.guild_id);
        const channel = guild?.channels.cache.get(row.channel_id);
        if (channel?.isTextBased()) target = channel;
      }
      if (!target) {
        const user = await client.users.fetch(row.user_id).catch(() => null);
        if (user) target = user;
      }
      if (target?.send || target?.isTextBased()) {
        const embed = successEmbed(`⏰ **Reminder:** ${row.message}`);
        if (target.isTextBased?.()) await target.send({ content: `<@${row.user_id}>`, embeds: [embed] });
        else await target.send({ embeds: [embed] });
      }

      if (row.repeat_interval) {
        const next = nextRepeat(row.repeat_interval, Date.parse(row.remind_at));
        if (next) {
          db.prepare('UPDATE reminders SET remind_at = ?, sent = 0 WHERE id = ?')
            .run(next.toISOString(), row.id);
          continue;
        }
      }
      db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(row.id);
    } catch (err) {
      logger.debug(`Reminder ${row.id} delivery failed: ${err.message}`);
      db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(row.id);
    }
  }
}

module.exports = { createReminder, listReminders, countActive, deleteReminder, processDue };
