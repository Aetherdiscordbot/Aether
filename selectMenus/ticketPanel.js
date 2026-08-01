/**
 * Ticket panel select menu — creates a ticket in the selected category.
 */
const ticketService = require('../modules/tickets/ticketService');
const { errorEmbed, successEmbed } = require('../utils/discord');

module.exports = {
  id: 'ticket',
  type: 'select',
  async run(client, interaction) {
    const category = interaction.values[0] || 'General';
    const result = await ticketService.createTicket(interaction.guild, interaction.member, category, client);
    if (result.error) {
      return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    }
    return interaction.reply({
      embeds: [successEmbed(`Your **${category}** ticket is ready → ${result.channel}`)],
      ephemeral: true,
    });
  },
};
