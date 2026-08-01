/**
 * Role update (name/color/permission changes) → role log.
 */
const logService = require('../services/logService');
const { Colors } = require('../utils/discord');

module.exports = {
  name: 'roleUpdate',
  run(client, oldRole, newRole) {
    if (!newRole.guild) return;
    if (oldRole.name === newRole.name && oldRole.color === newRole.color) return;

    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`• Name: **@${oldRole.name}** → **@${newRole.name}**`);
    if (oldRole.color !== newRole.color) changes.push(`• Color: \`#${oldRole.color.toString(16).padStart(6, '0')}\` → \`#${newRole.color.toString(16).padStart(6, '0')}\``);

    logService.sendLog(newRole.guild, 'role', {
      color: Colors.warning,
      title: 'Role Updated',
      description: `${newRole}`,
      fields: [{ name: 'Changes', value: changes.join('\n') || '*none*' }],
      footer: { text: `ID: ${newRole.id}` },
    });
  },
};
