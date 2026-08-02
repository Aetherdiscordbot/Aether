/**
 * /purge — bulk-delete messages, optionally filtered.
 * Free: up to 100 messages, optional user filter.
 * Premium: up to 1000, filters by bots/links/attachments.
 */
const { errorEmbed, successEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const { int, user, bool, req } = require('../../utils/commandBuilder');

const FREE_LIMIT = 100;
const PREMIUM_LIMIT = 1000;

module.exports = {
  name: 'purge',
  description: 'Bulk delete messages in this channel',
  permissions: ['ManageMessages'],
  botPermissions: ['ManageMessages'],
  options: [
    int('amount', 'How many messages to delete', req({ min_value: 1, max_value: PREMIUM_LIMIT })),
    user('user', 'Only delete this user\'s messages', {}),
    bool('bots', 'Only delete bot messages (premium)', {}),
    bool('links', 'Only delete messages containing links (premium)', {}),
    bool('attachments', 'Only delete messages with attachments (premium)', {}),
  ],
  async run(client, interaction) {
    const amount = interaction.options.getInteger('amount');
    const target = interaction.options.getUser('user');
    const bots = interaction.options.getBoolean('bots');
    const links = interaction.options.getBoolean('links');
    const attachments = interaction.options.getBoolean('attachments');

    const isPremium = premiumService.isPremium(interaction.guildId);
    const usesPremiumFilters = bots || links || attachments;

    // Premium gates: above free limit, or any premium filter.
    if ((amount > FREE_LIMIT || usesPremiumFilters) && !isPremium) {
      return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const fetchLimit = Math.min(amount, PREMIUM_LIMIT);
    let messages = await interaction.channel.messages.fetch({ limit: fetchLimit });

    if (target) messages = messages.filter((m) => m.author.id === target.id);
    if (bots) messages = messages.filter((m) => m.author.bot);
    if (links) messages = messages.filter((m) => /https?:\/\//i.test(m.content || ''));
    if (attachments) messages = messages.filter((m) => m.attachments.size > 0);

    if (!messages.size) {
      return interaction.editReply({ embeds: [errorEmbed('No messages matched the filters.')] });
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
