/**
 * /leveling — configure XP settings and level rewards.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const levelingService = require('../../modules/leveling/levelingService');
const db = require('../../database/db');
const { sub, channel, role, str, int, bool, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'leveling',
  description: 'Leveling system configuration',
  subPermissions: {
    setup: ['ManageGuild'],
    reward: ['ManageGuild', 'ManageRoles'],
    'reward-remove': ['ManageGuild', 'ManageRoles'],
    config: ['ManageGuild'],
  },
  options: [
    sub('setup', 'Configure leveling settings', [
      str('announcement', 'Level-up announcement: channel, dm or none', {}),
      channel('channel', 'Channel for level-up announcements', { channel_types: [0] }),
      bool('enabled', 'Enable or disable leveling', {}),
    ]),
    sub('reward', 'Add a role reward for a level', [int('level', 'Level', req({ min_value: 1 })), role('role', 'Role to grant', req())]),
    sub('reward-remove', 'Remove a level reward', [int('level', 'Level', req({ min_value: 1 }))]),
    sub('config', 'Show the current leveling configuration'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'setup': {
        const announcement = interaction.options.getString('announcement');
        const channel = interaction.options.getChannel('channel');
        const enabled = interaction.options.getBoolean('enabled');
        const cfg = levelingService.getConfig(interaction.guildId);

        const update = {};
        if (announcement) {
          if (!['channel', 'dm', 'none'].includes(announcement)) {
            return interaction.reply({ embeds: [errorEmbed('Announcement must be `channel`, `dm` or `none`.')], ephemeral: true });
          }
          update.announcement = announcement;
        }
        if (channel) update.announceChannel = channel.id;
        if (enabled !== null) update.enabled = enabled;
        levelingService.setConfig(interaction.guildId, update);
        return interaction.reply({ embeds: [successEmbed('Leveling settings updated.')], ephemeral: true });
      }
      case 'reward': {
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        const existing = db.prepare('SELECT id FROM level_rewards WHERE guild_id = ? AND level = ?').get(interaction.guildId, level);
        if (existing) {
          db.prepare('UPDATE level_rewards SET role_id = ? WHERE id = ?').run(role.id, existing.id);
        } else {
          db.prepare('INSERT INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)').run(interaction.guildId, level, role.id);
        }
        return interaction.reply({ embeds: [successEmbed(`Level **${level}** reward set to ${role}.`)], ephemeral: true });
      }
      case 'reward-remove': {
        const level = interaction.options.getInteger('level');
        const info = db.prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?').run(interaction.guildId, level);
        if (!info.changes) return interaction.reply({ embeds: [errorEmbed('No reward for that level.')], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed(`Level **${level}** reward removed.`)], ephemeral: true });
      }
      case 'config': {
        const cfg = levelingService.getConfig(interaction.guildId);
        const rewards = db.prepare('SELECT level, role_id FROM level_rewards WHERE guild_id = ? ORDER BY level').all(interaction.guildId);
        return interaction.reply({
          embeds: [
            baseEmbed({
              color: Colors.info,
              title: 'Leveling Configuration',
              fields: [
                { name: 'Enabled', value: cfg.enabled ? '✅' : '❌', inline: true },
                { name: 'XP per message', value: `${cfg.xpPerMessage[0]}–${cfg.xpPerMessage[1]}`, inline: true },
                { name: 'Cooldown', value: `${cfg.messageCooldownSec}s`, inline: true },
                { name: 'Announcement', value: cfg.announcement, inline: true },
                { name: 'Announce Channel', value: cfg.announceChannel ? `<#${cfg.announceChannel}>` : 'Current channel', inline: true },
                {
                  name: 'Level Rewards',
                  value: rewards.length ? rewards.map((r) => `Level ${r.level} → <@&${r.role_id}>`).join('\n') : 'None',
                  inline: false,
                },
              ],
            }),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
