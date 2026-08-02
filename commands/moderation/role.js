/**
 * /role — add/remove a role from a member (free) or mass-apply (premium).
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const permissions = require('../../services/permissions');
const { user, role, sub, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'role',
  description: 'Manage roles on members',
  permissions: ['ManageRoles'],
  botPermissions: ['ManageRoles'],
  subPermissions: {
    mass: ['Administrator'],
  },
  options: [
    sub('add', 'Add a role to a member', [user('user', 'Member', req()), role('role', 'Role to add', req())]),
    sub('remove', 'Remove a role from a member', [user('user', 'Member', req()), role('role', 'Role to remove', req())]),
    sub('mass', 'Apply a role to many members at once (premium)', [
      role('role', 'Role to apply', req()),
      str('target', 'Who to apply to: all, humans, bots', req({ choices: [
        { name: 'All members', value: 'all' },
        { name: 'Humans only', value: 'humans' },
        { name: 'Bots only', value: 'bots' },
      ] })),
      str('action', 'Add or remove', req({ choices: [
        { name: 'Add role', value: 'add' },
        { name: 'Remove role', value: 'remove' },
      ] })),
    ]),
  ],
  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'mass') {
      return mass(interaction);
    }

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

async function mass(interaction) {
  const role = interaction.options.getRole('role');
  const target = interaction.options.getString('target');
  const action = interaction.options.getString('action');

  if (role.id === interaction.guild.id) {
    return interaction.reply({ embeds: [errorEmbed('You cannot apply the @everyone role.')], ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  await interaction.guild.members.fetch().catch(() => {});
  let members = [...interaction.guild.members.cache.values()];
  if (target === 'humans') members = members.filter((m) => !m.user.bot);
  if (target === 'bots') members = members.filter((m) => m.user.bot);

  let done = 0;
  for (const member of members) {
    if (!member.manageable || member.user.bot && target !== 'bots') continue;
    try {
      if (action === 'add') {
        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role, `Mass add by ${interaction.user.tag}`);
          done++;
        }
      } else {
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role, `Mass remove by ${interaction.user.tag}`);
          done++;
        }
      }
    } catch {
      /* skip unmanageable members */
    }
  }

  return interaction.editReply({
    embeds: [successEmbed(`${action === 'add' ? 'Added' : 'Removed'} ${role} ${action === 'add' ? 'to' : 'from'} **${done}** member(s) (${target}).`)],
  });
}
