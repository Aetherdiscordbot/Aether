/**
 * /react — reaction-role panels.
 */
const { errorEmbed, successEmbed, listEmbed } = require('../../utils/discord');
const reactionRoleService = require('../../modules/reactionroles/reactionRoleService');
const { sub, channel, role, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'react',
  description: 'Reaction-role panels',
  subPermissions: {
    create: ['ManageRoles'],
    remove: ['ManageRoles'],
    list: ['ManageRoles'],
  },
  options: [
    sub('create', 'Add a role button to a panel', [
      channel('channel', 'Channel for the panel', req({ channel_types: [0] })),
      str('panel', 'Panel name (reuse to add more roles)', req()),
      role('role', 'Role to assign', req()),
      str('label', 'Button label', req()),
      str('emoji', 'Button emoji', {}),
      str('style', 'Button style: PRIMARY, SUCCESS, DANGER, SECONDARY', {}),
    ]),
    sub('remove', 'Remove a role from a panel', [
      str('message_id', 'Panel message ID', req()),
      role('role', 'Role to remove', req()),
    ]),
    sub('list', 'List all reaction-role panels'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'create': {
        const channel = interaction.options.getChannel('channel');
        const panel = interaction.options.getString('panel');
        const role = interaction.options.getRole('role');
        const label = interaction.options.getString('label');
        const emoji = interaction.options.getString('emoji');
        const style = interaction.options.getString('style');

        const result = await reactionRoleService.addRole(client, interaction.guild, channel, panel, role.id, { label, emoji, style });
        if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed(`${role} added to panel **${panel}**.`)], ephemeral: true });
      }
      case 'remove': {
        const messageId = interaction.options.getString('message_id');
        const role = interaction.options.getRole('role');
        const row = require('../../database/db')
          .prepare('SELECT channel_id FROM reaction_roles WHERE message_id = ? LIMIT 1')
          .get(messageId);
        const result = await reactionRoleService.removeRole(client, interaction.guild, messageId, role.id);
        if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
        const channel = row ? interaction.guild.channels.cache.get(row.channel_id) : null;
        if (channel?.isTextBased()) {
          const message = await channel.messages.fetch(messageId).catch(() => null);
          const rows = reactionRoleService.getMessageRows(messageId);
          if (message) {
            if (rows.length) await message.edit({ components: [reactionRoleService.buildRow(rows)] }).catch(() => {});
            else await message.delete().catch(() => {});
          }
        }
        return interaction.reply({ embeds: [successEmbed(`${role} removed from the panel.`)], ephemeral: true });
      }
      case 'list': {
        const panels = reactionRoleService.listPanels(interaction.guildId);
        if (!panels.length) return interaction.reply({ embeds: [errorEmbed('No reaction-role panels yet.')], ephemeral: true });
        const lines = panels.map((rows) => {
          const labels = rows.map((r) => `<@&${r.role_id}>`).join(', ');
          return `**${rows[0].panel_name}** (\`${rows[0].message_id}\`)\n→ ${labels}`;
        });
        return interaction.reply({ embeds: [listEmbed(lines, { title: 'Reaction-Role Panels', empty: 'No panels.' })], ephemeral: true });
      }
    }
  },
};
