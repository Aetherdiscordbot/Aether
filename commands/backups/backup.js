/**
 * /backup — create, list, restore and delete guild backups.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const backupService = require('../../modules/backups/backupService');
const { formatDate } = require('../../utils/time');
const { sub } = require('../../utils/commandBuilder');

module.exports = {
  name: 'backup',
  description: 'Guild backup system',
  subPermissions: {
    create: ['Administrator'],
    list: ['Administrator'],
    load: ['Administrator'],
    delete: ['Administrator'],
  },
  options: [
    sub('create', 'Create a backup of this server'),
    sub('list', 'List all backups'),
    sub('load', 'Restore a backup', [{ type: 3, name: 'id', description: 'Backup ID', required: true }]),
    sub('delete', 'Delete a backup', [{ type: 3, name: 'id', description: 'Backup ID', required: true }]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'create': {
        await interaction.deferReply({ ephemeral: true });
        const result = backupService.createBackup(interaction.guild, interaction.user.id);
        return interaction.editReply({
          embeds: [successEmbed(`Backup created.\n**ID:** \`${result.id}\`\n**Size:** ${(result.size / 1024).toFixed(1)} KB`)],
        });
      }
      case 'list': {
        const backups = backupService.listBackups(interaction.guildId);
        if (!backups.length) return interaction.reply({ embeds: [errorEmbed('No backups for this server yet.')], ephemeral: true });
        const lines = backups.map(
          (b, i) => `**${i + 1}.** \`${b.id}\` — ${(b.size / 1024).toFixed(1)} KB — ${formatDate(b.created_at)}`
        );
        return interaction.reply({
          embeds: [baseEmbed({ color: Colors.primary, title: '💾 Backups', description: lines.join('\n') })],
          ephemeral: true,
        });
      }
      case 'load': {
        await interaction.deferReply({ ephemeral: true });
        const id = interaction.options.getString('id');
        const result = await backupService.restoreBackup(client, interaction.guild, id);
        if (result.error) return interaction.editReply({ embeds: [errorEmbed(result.error)] });
        return interaction.editReply({
          embeds: [
            baseEmbed({
              color: Colors.success,
              title: '✅ Backup Restored',
              description: `**Roles:** ${result.summary.rolesCreated} created\n**Channels:** ${result.summary.channelsCreated} created\n${result.summary.errors.length ? `**Warnings:** ${result.summary.errors.length}` : ''}`,
            }),
          ],
        });
      }
      case 'delete': {
        const id = interaction.options.getString('id');
        const deleted = backupService.deleteBackup(id);
        if (!deleted) return interaction.reply({ embeds: [errorEmbed('Backup not found.')], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed('Backup deleted.')], ephemeral: true });
      }
    }
  },
};
