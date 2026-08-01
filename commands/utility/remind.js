/**
 * /remind — set, list and delete reminders.
 */
const { errorEmbed, successEmbed, listEmbed } = require('../../utils/discord');
const reminderService = require('../../services/reminders');
const { parseDuration, formatDuration, timestamp } = require('../../utils/time');
const { sub, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'remind',
  description: 'Set a reminder',
  aliases: ['reminder', 'remindme'],
  cooldown: 10,
  options: [
    sub('create', 'Create a reminder', [
      str('message', 'What to remind you about', req()),
      str('duration', 'When (e.g. 10m, 1h, 1d)', req()),
    ]),
    sub('list', 'List your reminders'),
    sub('delete', 'Delete a reminder', [str('id', 'Reminder ID (see /remind list)', req())]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'create') {
      const message = interaction.options.getString('message');
      const duration = parseDuration(interaction.options.getString('duration'));
      if (!duration) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use e.g. `10m`, `2h`, `1d`.')], ephemeral: true });
      if (duration < 30_000) return interaction.reply({ embeds: [errorEmbed('Reminders must be at least 30 seconds.')], ephemeral: true });

      const id = reminderService.createReminder({
        userId: interaction.user.id,
        channelId: interaction.channel.id,
        guildId: interaction.guildId,
        message,
        remindAt: new Date(Date.now() + duration),
      });
      return interaction.reply({
        embeds: [successEmbed(`I will remind you in **${formatDuration(duration)}** about *${message}*.\nID: \`${id}\``)],
        ephemeral: true,
      });
    }

    if (subCmd === 'list') {
      const reminders = reminderService.listReminders(interaction.user.id);
      if (!reminders.length) return interaction.reply({ embeds: [errorEmbed('You have no reminders.')], ephemeral: true });
      const lines = reminders.map((r) => `${r.message} — ${timestamp(r.remind_at)} (\`${r.id}\`)`);
      return interaction.reply({ embeds: [listEmbed(lines, { title: 'Your Reminders', empty: 'No reminders.' })], ephemeral: true });
    }

    const id = interaction.options.getString('id');
    const deleted = reminderService.deleteReminder(id, interaction.user.id);
    if (!deleted) return interaction.reply({ embeds: [errorEmbed('Reminder not found.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Reminder deleted.')], ephemeral: true });
  },
};
