/**
 * /remind — set, list and delete reminders.
 * Free: up to 5 active reminders, DM delivery.
 * Premium: unlimited, recurring intervals, channel delivery.
 */
const { errorEmbed, successEmbed, listEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const reminderService = require('../../services/reminders');
const { parseDuration, formatDuration, timestamp } = require('../../utils/time');
const { sub, str, channel, req } = require('../../utils/commandBuilder');

const FREE_LIMIT = 5;

module.exports = {
  name: 'remind',
  description: 'Set a reminder',
  aliases: ['reminder', 'remindme'],
  cooldown: 10,
  options: [
    sub('create', 'Create a reminder', [
      str('message', 'What to remind you about', req()),
      str('duration', 'When (e.g. 10m, 1h, 1d)', req()),
      channel('channel', 'Post the reminder here instead of DMs (premium)', { channel_types: [0] }),
      str('repeat', 'Repeat: hourly, daily, weekly, monthly (premium)', {
        choices: [
          { name: 'Hourly', value: 'hourly' },
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' },
        ],
      }),
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

      const channel = interaction.options.getChannel('channel');
      const repeat = interaction.options.getString('repeat');

      const isPremium = premiumService.isPremium(interaction.guildId);
      if ((channel || repeat) && !isPremium) {
        return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
      }

      if (!isPremium && reminderService.countActive(interaction.user.id) >= FREE_LIMIT) {
        return interaction.reply({
          embeds: [errorEmbed(`Free tier allows up to **${FREE_LIMIT}** active reminders. Delete one or upgrade to Premium for unlimited reminders.`)],
          ephemeral: true,
        });
      }

      const id = reminderService.createReminder({
        userId: interaction.user.id,
        channelId: channel?.id,
        guildId: channel ? interaction.guildId : null,
        message,
        remindAt: new Date(Date.now() + duration),
        repeat,
      });
      const extra = [
        repeat ? `repeats **${repeat}**` : null,
        channel ? `posted in ${channel}` : null,
      ].filter(Boolean).join(', ');
      return interaction.reply({
        embeds: [successEmbed(`I will remind you in **${formatDuration(duration)}** about *${message}*.${extra ? ` (${extra})` : ''}\nID: \`${id}\``)],
        ephemeral: true,
      });
    }

    if (subCmd === 'list') {
      const reminders = reminderService.listReminders(interaction.user.id);
      if (!reminders.length) return interaction.reply({ embeds: [errorEmbed('You have no reminders.')], ephemeral: true });
      const lines = reminders.map((r) => `${r.message}${r.repeat_interval ? ` (repeats ${r.repeat_interval})` : ''} — ${timestamp(r.remind_at)} (\`${r.id}\`)`);
      return interaction.reply({ embeds: [listEmbed(lines, { title: 'Your Reminders', empty: 'No reminders.' })], ephemeral: true });
    }

    const id = interaction.options.getString('id');
    const deleted = reminderService.deleteReminder(id, interaction.user.id);
    if (!deleted) return interaction.reply({ embeds: [errorEmbed('Reminder not found.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Reminder deleted.')], ephemeral: true });
  },
};
