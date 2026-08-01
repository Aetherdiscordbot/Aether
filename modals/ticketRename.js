/**
 * Ticket rename modal.
 */
const { errorEmbed, successEmbed } = require('../utils/discord');
const ticketService = require('../modules/tickets/ticketService');

module.exports = {
  id: 'ticketrename',
  type: 'modal',
  async run(client, interaction) {
    const name = interaction.fields.getTextInputValue('name').trim().replace(/[^a-z0-9-_ ]/gi, '').slice(0, 100);
    if (!name) return interaction.reply({ embeds: [errorEmbed('Name cannot be empty.')], ephemeral: true });
    const ticket = ticketService.getTicketByChannel(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Not a ticket channel.')], ephemeral: true });
    await interaction.channel.setName(name);
    return interaction.reply({ embeds: [successEmbed(`Ticket renamed to **${name}**.`)], ephemeral: true });
  },
};
