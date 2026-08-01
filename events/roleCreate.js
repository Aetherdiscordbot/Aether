/**
 * Role lifecycle events → role log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'roleCreate',
  run(client, role) {
    if (!role.guild) return;
    logService.sendLog(role.guild, 'role', {
      color: Colors.success,
      title: 'Role Created',
      description: `${role} (${role.name})`,
      footer: { text: `ID: ${role.id}` },
    });
  },
};
