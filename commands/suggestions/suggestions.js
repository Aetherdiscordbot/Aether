/**
 * /suggestions — configure the suggestion system and review suggestions.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const suggestionService = require('../../modules/suggestions/suggestionService');
const { sub, channel, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'suggestions',
  description: 'Suggestion system management',
  permissions: [],
  subPermissions: {
    setup: ['ManageGuild'],
    approve: ['ManageGuild', 'ManageMessages'],
    deny: ['ManageGuild', 'ManageMessages'],
    delete: ['ManageGuild', 'ManageMessages'],
  },
  options: [
    sub('setup', 'Set the suggestions channel', [channel('channel', 'Channel where suggestions are posted', req({ channel_types: [0] }))]),
    sub('approve', 'Approve a suggestion', [str('id', 'Suggestion ID (from the embed footer)', req()), str('reason', 'Reason', {})]),
    sub('deny', 'Deny a suggestion', [str('id', 'Suggestion ID (from the embed footer)', req()), str('reason', 'Reason', {})]),
    sub('delete', 'Delete a suggestion', [str('id', 'Suggestion ID (from the embed footer)', req())]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const id = interaction.options.getString('id');
    const reason = interaction.options.getString('reason') || '';

    switch (subCmd) {
      case 'setup': {
        const channel = interaction.options.getChannel('channel');
        suggestionService.setConfig(interaction.guildId, { channelId: channel.id });
        return interaction.reply({ embeds: [successEmbed(`Suggestions channel set to ${channel}.`)], ephemeral: true });
      }
      case 'approve':
        return review(interaction, 'approved', id, reason);
      case 'deny':
        return review(interaction, 'denied', id, reason);
      case 'delete': {
        const row = suggestionService.deleteSuggestion(id);
        if (!row) return interaction.reply({ embeds: [errorEmbed('Suggestion not found.')], ephemeral: true });
        const channel = interaction.guild.channels.cache.get(row.channel_id);
        if (channel?.isTextBased() && row.message_id) {
          const message = await channel.messages.fetch(row.message_id).catch(() => null);
          await message?.delete().catch(() => {});
        }
        return interaction.reply({ embeds: [successEmbed('Suggestion deleted.')], ephemeral: true });
      }
    }
  },
};

async function review(interaction, status, id, reason) {
  const result = await suggestionService.reviewSuggestion(
    interaction.client,
    interaction.guild,
    id,
    status,
    interaction.user,
    reason
  );
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed(`Suggestion ${status}.`)], ephemeral: true });
}
