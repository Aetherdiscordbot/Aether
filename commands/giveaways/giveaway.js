/**
 * /giveaway — start, end and reroll giveaways.
 * Free: 1 winner, everyone can enter.
 * Premium: multiple winners, role requirement, auto-reroll.
 */
const { errorEmbed, successEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const { formatDuration, parseDuration, timestamp } = require('../../utils/time');
const giveawayService = require('../../modules/giveaways/giveawayService');
const { sub, channel, str, int, role, bool, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'giveaway',
  description: 'Giveaway system',
  permissions: ['ManageGuild'],
  options: [
    sub('start', 'Start a giveaway', [
      channel('channel', 'Channel for the giveaway', req({ channel_types: [0] })),
      str('duration', 'Length (e.g. 10m, 2h, 1d)', req()),
      str('prize', 'Prize to give away', req()),
      int('winners', 'Number of winners (premium: 2–20)', { min_value: 1, max_value: 20 }),
      role('role', 'Role required to enter (premium)', {}),
      bool('auto_reroll', 'Auto-reroll if nobody qualifies (premium)', {}),
    ]),
    sub('end', 'End a giveaway early', [str('message_id', 'Giveaway message ID', req())]),
    sub('reroll', 'Reroll a giveaway winner', [str('message_id', 'Giveaway message ID', req())]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'start') {
      const channel = interaction.options.getChannel('channel');
      const durationStr = interaction.options.getString('duration');
      const duration = parseDuration(durationStr);
      if (!duration) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use e.g. `10m`, `2h`, `1d`.')], ephemeral: true });

      const prize = interaction.options.getString('prize');
      const winners = interaction.options.getInteger('winners') || 1;
      const role = interaction.options.getRole('role');
      const autoReroll = interaction.options.getBoolean('auto_reroll');

      const isPremium = premiumService.isPremium(interaction.guildId);
      if ((winners > 1 || role || autoReroll) && !isPremium) {
        return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
      }

      const endsAt = new Date(Date.now() + duration);

      const id = giveawayService.createGiveaway({
        guildId: interaction.guildId,
        channelId: channel.id,
        prize,
        winners,
        endsAt,
        hostId: interaction.user.id,
        roleRequired: role?.id,
        autoReroll,
      });

      const giveaway = require('../../database/db').prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
      await giveawayService.publishGiveaway(client, giveaway);

      return interaction.reply({
        embeds: [successEmbed(`Giveaway started for **${prize}** in ${channel}.\nEnds ${timestamp(endsAt.toISOString())} (${formatDuration(duration)}).`)],
        ephemeral: true,
      });
    }

    const messageId = interaction.options.getString('message_id');
    const giveaway = require('../../database/db')
      .prepare('SELECT * FROM giveaways WHERE guild_id = ? AND message_id = ?')
      .get(interaction.guildId, messageId);

    if (!giveaway) return interaction.reply({ embeds: [errorEmbed('Giveaway not found in this server.')], ephemeral: true });

    if (subCmd === 'end') {
      await giveawayService.endGiveaway(client, giveaway.id, true);
      return interaction.reply({ embeds: [successEmbed('Giveaway ended.')], ephemeral: true });
    }

    const winner = await giveawayService.reroll(client, giveaway.id);
    if (!winner) return interaction.reply({ embeds: [errorEmbed('No eligible entrants to reroll.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Rerolled winner: <@${winner.id}>`)], ephemeral: true });
  },
};
