/**
 * /staff — manage the staff member registry.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const db = require('../../database/db');
const { formatDate } = require('../../utils/time');
const { sub, user, str, role, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'staff',
  description: 'Staff management',
  subPermissions: {
    add: ['ManageGuild'],
    remove: ['ManageGuild'],
    setrank: ['ManageGuild'],
    list: ['ManageGuild'],
  },
  options: [
    sub('add', 'Add a staff member', [user('user', 'User to add', req()), str('notes', 'Notes', {})]),
    sub('remove', 'Remove a staff member', [user('user', 'User to remove', req())]),
    sub('setrank', 'Set a staff member\'s rank', [user('user', 'User', req()), str('rank', 'Rank: owner, admin, mod, staff', req())]),
    sub('list', 'List staff members'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const now = new Date().toISOString();

    switch (subCmd) {
      case 'add': {
        const target = interaction.options.getUser('user');
        const notes = interaction.options.getString('notes');
        const existing = db.prepare('SELECT * FROM staff_members WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id);
        if (existing) return interaction.reply({ embeds: [errorEmbed('That user is already registered as staff.')], ephemeral: true });
        db.prepare('INSERT INTO staff_members (guild_id, user_id, rank, added_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          interaction.guildId,
          target.id,
          'staff',
          interaction.user.id,
          notes || null,
          now
        );
        return interaction.reply({ embeds: [successEmbed(`${target} added to staff.`)], ephemeral: true });
      }
      case 'remove': {
        const target = interaction.options.getUser('user');
        const result = db.prepare('DELETE FROM staff_members WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, target.id);
        if (!result.changes) return interaction.reply({ embeds: [errorEmbed('That user is not in the staff registry.')], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed(`${target} removed from staff.`)], ephemeral: true });
      }
      case 'setrank': {
        const target = interaction.options.getUser('user');
        const rank = interaction.options.getString('rank').toLowerCase();
        if (!['owner', 'admin', 'mod', 'staff'].includes(rank)) {
          return interaction.reply({ embeds: [errorEmbed('Rank must be `owner`, `admin`, `mod` or `staff`.')], ephemeral: true });
        }
        const result = db.prepare('UPDATE staff_members SET rank = ? WHERE guild_id = ? AND user_id = ?').run(rank, interaction.guildId, target.id);
        if (!result.changes) return interaction.reply({ embeds: [errorEmbed('That user is not in the staff registry.')], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed(`${target} is now **${rank}**.`)], ephemeral: true });
      }
      case 'list': {
        const rows = db.prepare('SELECT * FROM staff_members WHERE guild_id = ? ORDER BY created_at ASC').all(interaction.guildId);
        if (!rows.length) return interaction.reply({ embeds: [errorEmbed('No staff registered yet.')], ephemeral: true });
        const lines = rows.map((r) => `**${r.rank.toUpperCase()}** <@${r.user_id}> — added ${formatDate(r.created_at, false)}${r.notes ? `\n  ↳ ${r.notes}` : ''}`);
        return interaction.reply({
          embeds: [baseEmbed({ color: Colors.primary, title: '🛡️ Staff Registry', description: lines.join('\n') })],
          ephemeral: true,
        });
      }
    }
  },
};
