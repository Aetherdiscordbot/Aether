/**
 * Role delete → role log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'roleDelete',
  run(client, role) {
    if (!role.guild) return;
    logService.sendLog(role.guild, 'role', {
      color: Colors.error,
      title: 'Role Deleted',
      description: `@${role.name}`,
      footer: { text: `ID: ${role.id}` },
    });
  },
};
