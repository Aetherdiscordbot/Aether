/**
 * Invite tracking service: keeps an invite cache per guild and resolves which
 * invite was used when a member joins (for invite logging).
 */
const db = require('../database/db');
const logService = require('./logService');
const logger = require('./logger');
const { Colors } = require('../utils/discord');

/** (Re)build the invite cache for a guild. */
async function refreshGuild(guild) {
  if (!guild?.invites) return;
  try {
    const invites = await guild.invites.fetch();
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `INSERT INTO invite_cache (guild_id, code, inviter_id, uses, channel_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, code) DO UPDATE SET uses = excluded.uses`
    );
    for (const invite of invites.values()) {
      upsert.run(
        guild.id,
        invite.code,
        invite.inviterId || null,
        invite.uses ?? 0,
        invite.channelId || null,
        now
      );
    }
  } catch (err) {
    logger.debug(`Invite refresh failed for ${guild?.id}: ${err.message}`);
  }
}

/** Match the invite used by a new member (only called when the cache exists). */
function matchInvite(guildId, invites) {
  const rows = db.prepare('SELECT * FROM invite_cache WHERE guild_id = ?').all(guildId);
  if (!rows.length) return null;
  for (const invite of invites.values()) {
    const row = rows.find((r) => r.code === invite.code);
    if (row && invite.uses > (row.uses ?? 0)) {
      db.prepare('UPDATE invite_cache SET uses = ? WHERE guild_id = ? AND code = ?').run(invite.uses, guildId, invite.code);
      return row;
    }
  }
  return null;
}

/** Handle a new member join: log which invite they used. */
async function onJoin(guild, member) {
  if (!guild?.invites) return;
  try {
    const invites = await guild.invites.fetch();
    const used = matchInvite(guild.id, invites);
    if (used?.inviter_id) {
      await logService.sendLog(guild, 'invite', {
        color: Colors.info,
        title: 'Invite Used',
        description: `${member.user} joined using an invite from <@${used.inviter_id}>`,
        fields: [{ name: 'Code', value: `discord.gg/${used.code}`, inline: true }],
      });
    }
    await refreshGuild(guild);
  } catch { /* no invite permission */ }
}

module.exports = { refreshGuild, onJoin, matchInvite };
