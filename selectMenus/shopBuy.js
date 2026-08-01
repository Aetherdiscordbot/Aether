/**
 * Shop purchase select menu — buys the selected item for the user who opened /shop.
 */
const { errorEmbed, successEmbed } = require('../utils/discord');
const economyService = require('../modules/economy/economyService');

module.exports = {
  id: 'shop',
  type: 'select',
  async run(client, interaction) {
    const [, action, ownerId] = interaction.customId.split(':');
    if (action !== 'buy') return;
    if (ownerId !== interaction.user.id) return interaction.reply({ embeds: [errorEmbed('This shop menu belongs to someone else.')], ephemeral: true });

    const itemId = parseInt(interaction.values[0], 10);
    const result = await economyService.buyItem(interaction.guildId, interaction.user.id, interaction.member, itemId);
    if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });

    const cfg = economyService.getConfig(interaction.guildId);
    if (result.type === 'role') {
      return interaction.reply({ embeds: [successEmbed(`You purchased **${result.item.name}** and received <@&${result.item.role_id}>.`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [successEmbed(`You purchased **${result.item.name}** for ${cfg.currency}${result.item.price.toLocaleString()}.`)], ephemeral: true });
  },
};
