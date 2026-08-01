/**
 * /inventory — show the items you own.
 */
const economyService = require('../../modules/economy/economyService');
const { errorEmbed, baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'inventory',
  description: 'Show the items you own',
  aliases: ['inv'],
  cooldown: 5,
  async run(client, interaction) {
    const cfg = economyService.getConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ embeds: [errorEmbed('The economy is disabled here.')], ephemeral: true });
    const inventory = economyService.getInventory(interaction.guildId, interaction.user.id);
    if (!inventory.length) return interaction.reply({ embeds: [errorEmbed('Your inventory is empty. Check `/shop`.')], ephemeral: true });

    const lines = inventory.map((i) => `**${i.name}** ×${i.quantity} — ${i.description || ''}`.trim());
    return interaction.reply({
      embeds: [baseEmbed({ color: Colors.primary, title: `🎒 ${interaction.user.username}'s Inventory`, description: lines.join('\n') })],
      ephemeral: true,
    });
  },
};
