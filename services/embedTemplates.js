/**
 * Embed template service (premium): save / list / use / delete templates.
 */
const { randomUUID } = require('crypto');
const db = require('../database/db');

function saveTemplate({ guildId, name, data, createdBy }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO embed_templates (id, guild_id, name, data, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (guild_id, name) DO UPDATE SET data = excluded.data`
  ).run(id, guildId, name, JSON.stringify(data), createdBy, new Date().toISOString());
  return id;
}

function listTemplates(guildId) {
  return db.prepare('SELECT id, name, created_at FROM embed_templates WHERE guild_id = ? ORDER BY name').all(guildId);
}

function getTemplate(guildId, name) {
  const row = db.prepare('SELECT * FROM embed_templates WHERE guild_id = ? AND name = ?').get(guildId, name);
  if (!row) return null;
  try {
    row.data = JSON.parse(row.data);
  } catch {
    row.data = {};
  }
  return row;
}

function deleteTemplate(guildId, name) {
  return db.prepare('DELETE FROM embed_templates WHERE guild_id = ? AND name = ?').run(guildId, name).changes;
}

module.exports = { saveTemplate, listTemplates, getTemplate, deleteTemplate };
