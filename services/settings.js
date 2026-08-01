/**
 * Per-guild settings store. Values are JSON-encoded strings in SQLite.
 */
const db = require('../database/db');

function getSetting(guildId, key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE guild_id = ? AND key = ?').get(guildId, key);
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

function setSetting(guildId, key, value) {
  const encoded = JSON.stringify(value ?? null);
  db.prepare(
    `INSERT INTO settings (guild_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value`
  ).run(guildId, key, encoded);
}

function deleteSetting(guildId, key) {
  db.prepare('DELETE FROM settings WHERE guild_id = ? AND key = ?').run(guildId, key);
}

/** All keys for a guild, useful for /debug. */
function getAllSettings(guildId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE guild_id = ?').all(guildId);
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

module.exports = { getSetting, setSetting, deleteSetting, getAllSettings };
