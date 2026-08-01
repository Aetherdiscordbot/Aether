/**
 * Backup service: snapshot guild roles/channels and restore them.
 */
const { randomUUID } = require('crypto');
const db = require('../../database/db');
const settings = require('../../services/settings');
const logger = require('../../services/logger');

function snapshotGuild(guild) {
  const roles = guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      position: r.position,
      permissions: r.permissions.toArray(),
      icon: r.iconURL({ size: 64 }),
      unicodeEmoji: r.unicodeEmoji,
    }));

  const channels = guild.channels.cache.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    topic: c.topic || null,
    parentId: c.parentId,
    position: c.position,
    nsfw: c.nsfw || false,
    userLimit: c.userLimit || null,
    bitrate: c.bitrate || null,
    rateLimitPerUser: c.rateLimitPerUser || 0,
  }));

  return {
    name: guild.name,
    roles,
    channels,
    settings: settings.getAllSettings(guild.id),
  };
}

function createBackup(guild, createdBy) {
  const id = randomUUID();
  const data = JSON.stringify(snapshotGuild(guild));
  db.prepare('INSERT INTO backups (id, guild_id, created_by, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    guild.id,
    createdBy,
    Buffer.byteLength(data),
    data,
    new Date().toISOString()
  );
  return { id, size: Buffer.byteLength(data) };
}

function listBackups(guildId) {
  return db.prepare('SELECT id, created_by, size, created_at FROM backups WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
}

function getBackup(id) {
  return db.prepare('SELECT * FROM backups WHERE id = ?').get(id) || null;
}

function deleteBackup(id) {
  return db.prepare('DELETE FROM backups WHERE id = ?').run(id).changes;
}

/** Restore a backup: recreate roles, then channels. Returns a result summary. */
async function restoreBackup(client, guild, id) {
  const backup = getBackup(id);
  if (!backup || backup.guild_id !== guild.id) return { error: 'Backup not found for this server.' };

  let data;
  try {
    data = JSON.parse(backup.data);
  } catch {
    return { error: 'Backup data is corrupted.' };
  }

  const summary = { rolesCreated: 0, channelsCreated: 0, errors: [] };
  const roleIdMap = new Map([[guild.id, guild.id]]);

  // Restore roles (lowest first so hierarchy is rebuilt correctly).
  const sortedRoles = [...data.roles].sort((a, b) => a.position - b.position);
  for (const role of sortedRoles) {
    try {
      if (guild.roles.cache.get(role.id)) {
        roleIdMap.set(role.id, role.id);
        continue;
      }
      const created = await guild.roles.create({
        name: role.name,
        color: role.color || undefined,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions,
        reason: 'Aether backup restore',
      });
      roleIdMap.set(role.id, created.id);
      summary.rolesCreated++;
    } catch (err) {
      summary.errors.push(`Role "${role.name}": ${err.message}`);
    }
  }

  // Restore channels.
  const categoryMap = new Map();
  for (const channel of data.channels) {
    try {
      const parent = channel.type === 4 ? null : categoryMap.get(channel.parentId);
      const created = await guild.channels.create({
        name: channel.name,
        type: channel.type,
        topic: channel.topic || undefined,
        parent: parent || undefined,
        position: channel.position,
        nsfw: channel.nsfw || false,
        userLimit: channel.userLimit || undefined,
        bitrate: channel.bitrate || undefined,
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        reason: 'Aether backup restore',
      });
      if (channel.type === 4) categoryMap.set(channel.id, created.id);
      summary.channelsCreated++;
    } catch (err) {
      summary.errors.push(`Channel "#${channel.name}": ${err.message}`);
    }
  }

  return { summary };
}

module.exports = { snapshotGuild, createBackup, listBackups, getBackup, deleteBackup, restoreBackup };
