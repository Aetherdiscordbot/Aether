/**
 * guildUpdate (server name/icon/banner changes) → server log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'guildUpdate',
  run(client, oldGuild, newGuild) {
    if (oldGuild.name !== newGuild.name || oldGuild.icon !== newGuild.icon || oldGuild.banner !== newGuild.banner) {
      const changes = [];
      if (oldGuild.name !== newGuild.name) changes.push(`• Name: **${oldGuild.name}** → **${newGuild.name}**`);
      if (oldGuild.icon !== newGuild.icon) changes.push('• Icon updated');
      if (oldGuild.banner !== newGuild.banner) changes.push('• Banner updated');

      logService.sendLog(newGuild, 'server', {
        color: Colors.warning,
        title: 'Server Updated',
        fields: [{ name: 'Changes', value: changes.join('\n') }],
        footer: { text: `ID: ${newGuild.id}` },
      });
    }
  },
};
