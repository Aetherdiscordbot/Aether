/**
 * /security — configure the security/anti-raid system.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const securityService = require('../../modules/security/securityService');
const { sub, str, int, bool, user, role, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'security',
  description: 'Security / anti-raid configuration',
  subPermissions: {
    toggle: ['ManageGuild'],
    age: ['ManageGuild'],
    anti_raid: ['ManageGuild'],
    spam: ['ManageGuild'],
    unlock: ['ManageGuild'],
    whitelist: ['ManageGuild'],
    config: ['ManageGuild'],
  },
  options: [
    sub('toggle', 'Enable or disable security', [bool('enabled', 'Enabled?', req())]),
    sub('age', 'Set minimum account age (days, 0 = off)', [int('days', 'Minimum account age in days', req({ min_value: 0 }))]),
    sub('anti_raid', 'Configure raid protection', [bool('enabled', 'Enabled?', req()), { type: 3, name: 'action', description: 'kick or lock', required: false }]),
    sub('spam', 'Enable/disable anti-spam', [bool('enabled', 'Enabled?', req())]),
    sub('unlock', 'Unlock a join-locked server'),
    sub('whitelist', 'Whitelist a user or role', [
      { type: 3, name: 'action', description: 'add or remove', required: true },
      user('user', 'User to whitelist', {}),
      role('role', 'Role to whitelist', {}),
    ]),
    sub('config', 'Show the current security configuration'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const cfg = securityService.getConfig(interaction.guildId);

    switch (subCmd) {
      case 'toggle': {
        securityService.setConfig(interaction.guildId, { enabled: interaction.options.getBoolean('enabled') });
        return interaction.reply({ embeds: [successEmbed(`Security ${interaction.options.getBoolean('enabled') ? 'enabled' : 'disabled'}.`)], ephemeral: true });
      }
      case 'age': {
        const days = interaction.options.getInteger('days');
        securityService.setConfig(interaction.guildId, { minAccountAgeDays: days });
        return interaction.reply({
          embeds: [successEmbed(days > 0 ? `Accounts younger than **${days} day(s)** will be removed on join.` : 'Account age screening disabled.')],
          ephemeral: true,
        });
      }
      case 'anti_raid': {
        const enabled = interaction.options.getBoolean('enabled');
        const action = interaction.options.getString('action');
        const update = {};
        if (enabled !== null) update.enabled = enabled;
        if (action) {
          if (!['kick', 'lock'].includes(action)) return interaction.reply({ embeds: [errorEmbed('Action must be `kick` or `lock`.')], ephemeral: true });
          update.action = action;
        }
        securityService.setConfig(interaction.guildId, { antiRaid: { ...cfg.antiRaid, ...update } });
        return interaction.reply({ embeds: [successEmbed('Raid protection updated.')], ephemeral: true });
      }
      case 'spam': {
        securityService.setConfig(interaction.guildId, { antiSpam: { ...cfg.antiSpam, enabled: interaction.options.getBoolean('enabled') } });
        return interaction.reply({ embeds: [successEmbed(`Anti-spam ${interaction.options.getBoolean('enabled') ? 'enabled' : 'disabled'}.`)], ephemeral: true });
      }
      case 'unlock': {
        securityService.unlockServer(interaction.guildId);
        return interaction.reply({ embeds: [successEmbed('The server join-lock has been lifted.')], ephemeral: true });
      }
      case 'whitelist': {
        const action = interaction.options.getString('action').toLowerCase();
        const target = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const id = target?.id || role?.id;
        if (!id) return interaction.reply({ embeds: [errorEmbed('Provide a user or role.')], ephemeral: true });

        if (target) {
          const list = new Set(cfg.whitelistedUsers);
          if (action === 'add') list.add(id);
          else if (action === 'remove') list.delete(id);
          else return interaction.reply({ embeds: [errorEmbed('Action must be `add` or `remove`.')], ephemeral: true });
          securityService.setConfig(interaction.guildId, { whitelistedUsers: [...list] });
        } else {
          const list = new Set(cfg.whitelistedRoles);
          if (action === 'add') list.add(id);
          else if (action === 'remove') list.delete(id);
          else return interaction.reply({ embeds: [errorEmbed('Action must be `add` or `remove`.')], ephemeral: true });
          securityService.setConfig(interaction.guildId, { whitelistedRoles: [...list] });
        }
        return interaction.reply({ embeds: [successEmbed(`Whitelist updated (${target ? 'users' : 'roles'}: ${action === 'add' ? 'added' : 'removed'}).`)], ephemeral: true });
      }
      case 'config': {
        return interaction.reply({
          embeds: [
            baseEmbed({
              color: Colors.info,
              title: 'Security Configuration',
              fields: [
                { name: 'Enabled', value: cfg.enabled ? '✅' : '❌', inline: true },
                { name: 'Raid protection', value: `${cfg.antiRaid.enabled ? '✅' : '❌'} (${cfg.antiRaid.action})`, inline: true },
                { name: 'Anti-spam', value: cfg.antiSpam.enabled ? '✅' : '❌', inline: true },
                { name: 'Min account age', value: cfg.minAccountAgeDays > 0 ? `${cfg.minAccountAgeDays} days` : 'Off', inline: true },
                { name: 'Join-lock active', value: securityService.isJoinLocked(interaction.guildId) ? '🔒 Yes' : 'No', inline: true },
              ],
            }),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
