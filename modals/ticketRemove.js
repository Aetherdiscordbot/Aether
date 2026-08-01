/**
 * Ticket remove-user modal.
 */
const { errorEmbed, successEmbed } = require('../utils/discord');
const ticketService = require('../modules/tickets/ticketService');

module.exports = {
  id: 'ticketremove',
  type: 'modal',
  async run(client, interaction) {
    const raw = interaction.fields.getTextInputValue('user').trim();
    const id = raw.match(/\d{15,20}/)?.[0] || null;
    if (!id) return interaction.reply({ embeds: [errorEmbed('Invalid user ID.')], ephemeral: true });

    const target = await client.users.fetch(id).catch(() => null);
    if (!target) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });

    const result = await ticketService.removeUserFromTicket(interaction.guild, interaction.channel, target, interaction.user);
    if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`${target.tag} removed from the ticket.`)], ephemeral: true });
  },
};
