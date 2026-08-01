/**
 * /shop — browse and buy from the server shop.
 */
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const economyService = require('../../modules/economy/economyService');
const { errorEmbed, baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'shop',
  description: 'Browse and buy from the server shop',
  cooldown: 10,
  async run(client, interaction) {
    const cfg = economyService.getConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ embeds: [errorEmbed('The economy is disabled here.')], ephemeral: true });
    const items = economyService.getShop(interaction.guildId);
    if (!items.length) return interaction.reply({ embeds: [errorEmbed('The shop is empty. Staff can add items with `/economy shop-add`.')], ephemeral: true });

    const fields = items.map((item) => ({
      name: `${item.name} — ${cfg.currency}${item.price.toLocaleString()}`,
      value: item.description || (item.role_id ? `Grants <@&${item.role_id}>` : 'No description'),
      inline: false,
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId(`shop:buy:${interaction.user.id}`)
      .setPlaceholder('Buy an item…')
      .addOptions(items.map((item) => ({ label: item.name.slice(0, 100), value: String(item.id), description: `${cfg.currency}${item.price}` })));

    return interaction.reply({
      embeds: [baseEmbed({ color: Colors.primary, title: '🛒 Server Shop', fields, footer: { text: `Your balance: ${cfg.currency}${economyService.getBalance(interaction.guildId, interaction.user.id).balance.toLocaleString()}` } })],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  },
};
