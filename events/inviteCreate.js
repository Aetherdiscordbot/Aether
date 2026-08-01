/**
 * inviteCreate: cache the invite + log.
 */
const db = require('../database/db');
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'inviteCreate',
  run(client, invite) {
    if (!invite.guild) return;
    db.prepare(
      `INSERT INTO invite_cache (guild_id, code, inviter_id, uses, channel_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, code) DO UPDATE SET inviter_id = excluded.inviter_id, uses = excluded.uses`
    ).run(
      invite.guild.id,
      invite.code,
      invite.inviterId || null,
      invite.uses ?? 0,
      invite.channelId || null,
      invite.createdAt?.toISOString() || new Date().toISOString()
    );

    logService.sendLog(invite.guild, 'invite', {
      color: Colors.info,
      title: 'Invite Created',
      description: `discord.gg/${invite.code} by ${invite.inviter || 'unknown'} in ${invite.channel || 'unknown channel'}`,
      fields: [{ name: 'Max Uses', value: String(invite.maxUses || '∞'), inline: true }],
    });
  },
};
