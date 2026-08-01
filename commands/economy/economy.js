/**
 * /economy — configure the economy and manage the shop.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const economyService = require('../../modules/economy/economyService');
const { sub, str, int, role, bool, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'economy',
  description: 'Economy system configuration',
  subPermissions: {
    toggle: ['ManageGuild'],
    setup: ['ManageGuild'],
    'shop-add': ['ManageGuild'],
    'shop-remove': ['ManageGuild'],
    config: ['ManageGuild'],
  },
  options: [
    sub('toggle', 'Turn the economy on or off for this server', [bool('enabled', 'Turn the economy on or off', req())]),
    sub('setup', 'Configure economy settings', [
      str('currency', 'Currency emoji/symbol', {}),
      int('daily', 'Daily reward amount', { min_value: 0 }),
    ]),
    sub('shop-add', 'Add an item to the shop', [
      str('name', 'Item name', req()),
      int('price', 'Item price', req({ min_value: 1 })),
      str('description', 'Item description', {}),
      role('role', 'Role granted on purchase (role item)', {}),
    ]),
    sub('shop-remove', 'Remove an item from the shop', [int('item_id', 'Item ID (see /shop)', req({ min_value: 1 }))]),
    sub('config', 'Show the current economy configuration'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'toggle': {
        const enabled = interaction.options.getBoolean('enabled');
        economyService.setConfig(interaction.guildId, { enabled });
        return interaction.reply({
          embeds: [successEmbed(`The economy is now **${enabled ? 'enabled' : 'disabled'}** in this server.`)],
          ephemeral: true,
        });
      }
      case 'setup': {
        const currency = interaction.options.getString('currency');
        const daily = interaction.options.getInteger('daily');
        const update = {};
        if (currency) update.currency = currency.slice(0, 8);
        if (daily !== null) update.dailyAmount = daily;
        economyService.setConfig(interaction.guildId, update);
        return interaction.reply({ embeds: [successEmbed('Economy settings updated.')], ephemeral: true });
      }
      case 'shop-add': {
        const name = interaction.options.getString('name');
        const price = interaction.options.getInteger('price');
        const description = interaction.options.getString('description');
        const role = interaction.options.getRole('role');
        economyService.addShopItem(interaction.guildId, { name, price, description, roleId: role?.id });
        return interaction.reply({ embeds: [successEmbed(`Added **${name}** to the shop for **${price}**.`)], ephemeral: true });
      }
      case 'shop-remove': {
        const itemId = interaction.options.getInteger('item_id');
        const result = economyService.removeShopItem(itemId);
        if (!result.changes) return interaction.reply({ embeds: [errorEmbed('Item not found.')], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed('Item removed from the shop.')], ephemeral: true });
      }
      case 'config': {
        const cfg = economyService.getConfig(interaction.guildId);
        return interaction.reply({
          embeds: [
            baseEmbed({
              color: Colors.info,
              title: 'Economy Configuration',
              fields: [
                { name: 'Enabled', value: cfg.enabled ? '✅' : '❌', inline: true },
                { name: 'Currency', value: cfg.currency, inline: true },
                { name: 'Daily', value: `${cfg.currency}${cfg.dailyAmount}`, inline: true },
                { name: 'Work range', value: `${cfg.currency}${cfg.workMin}–${cfg.currency}${cfg.workMax}`, inline: true },
              ],
            }),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
