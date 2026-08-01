/**
 * inviteDelete: remove from cache + log.
 */
const db = require('../database/db');
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'inviteDelete',
  run(client, invite) {
    if (!invite.guild) return;
    db.prepare('DELETE FROM invite_cache WHERE guild_id = ? AND code = ?').run(invite.guild.id, invite.code);
    logService.sendLog(invite.guild, 'invite', {
      color: Colors.error,
      title: 'Invite Deleted',
      description: `discord.gg/${invite.code}`,
    });
  },
};
