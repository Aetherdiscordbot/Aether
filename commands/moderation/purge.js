/**
 * /purge — bulk-delete messages, optionally filtered by user.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { int, user, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'purge',
  description: 'Bulk delete messages in this channel',
  permissions: ['ManageMessages'],
  botPermissions: ['ManageMessages'],
  options: [
    int('amount', 'How many messages to delete (1-100)', req({ min_value: 1, max_value: 100 })),
    user('user', 'Only delete this user\'s messages', {}),
  ],
  async run(client, interaction) {
    const amount = interaction.options.getInteger('amount');
    const target = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    let messages = await interaction.channel.messages.fetch({ limit: Math.min(amount, 100) });
    if (target) messages = messages.filter((m) => m.author.id === target.id);

    if (!messages.size) {
      return interaction.editReply({ embeds: [errorEmbed('No messages matched the filter.')] });
    }

    // Handle age-limit (bulk delete caps at 14 days).
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletable = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);
    const skipped = messages.size - deletable.size;

    if (!deletable.size) {
      return interaction.editReply({ embeds: [errorEmbed('All matched messages are older than 14 days and cannot be bulk-deleted.')] });
    }

    await interaction.channel.bulkDelete(deletable, true);
    return interaction.editReply({
      embeds: [successEmbed(`Deleted **${deletable.size}** message(s).${skipped ? ` Skipped ${skipped} older than 14 days.` : ''}`)],
    });
  },
};
