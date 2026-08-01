/**
 * /role — add or remove a role from a member.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const permissions = require('../../services/permissions');
const { user, role, sub, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'role',
  description: 'Manage roles on members',
  permissions: ['ManageRoles'],
  botPermissions: ['ManageRoles'],
  options: [
    sub('add', 'Add a role to a member', [user('user', 'Member', req()), role('role', 'Role to add', req())]),
    sub('remove', 'Remove a role from a member', [user('user', 'Member', req()), role('role', 'Role to remove', req())]),
  ],
  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    if (role.id === interaction.guild.id) {
      return interaction.reply({ embeds: [errorEmbed('You cannot assign the @everyone role.')], ephemeral: true });
    }
    if (!role.managed && role.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ embeds: [errorEmbed('That role is higher than or equal to your highest role.')], ephemeral: true });
    }

    const member = interaction.guild.members.cache.get(target.id) || (await interaction.guild.members.fetch(target.id).catch(() => null));
    if (!member) return interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });

    const has = member.roles.cache.has(role.id);

    if (subcommand === 'add') {
      if (has) return interaction.reply({ embeds: [errorEmbed(`${target.tag} already has ${role}.`)], ephemeral: true });
      await member.roles.add(role, `Added by ${interaction.user.tag}`);
      return interaction.reply({ embeds: [successEmbed(`Added ${role} to ${target.tag}.`)], ephemeral: true });
    }

    if (!has) return interaction.reply({ embeds: [errorEmbed(`${target.tag} does not have ${role}.`)], ephemeral: true });
    await member.roles.remove(role, `Removed by ${interaction.user.tag}`);
    return interaction.reply({ embeds: [successEmbed(`Removed ${role} from ${target.tag}.`)], ephemeral: true });
  },
};
