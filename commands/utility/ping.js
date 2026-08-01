/**
 * /ping — bot latency.
 */
const { baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'ping',
  description: 'Check bot latency',
  cooldown: 5,
  async run(client, interaction) {
    const sent = Date.now();
    await interaction.deferReply();
    const roundtrip = Date.now() - sent;
    const embed = baseEmbed({
      color: Colors.success,
      title: '🏓 Pong!',
      fields: [
        { name: 'Roundtrip', value: `${roundtrip}ms`, inline: true },
        { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: 'Uptime', value: `${Math.floor(client.uptime / 60000)} minutes`, inline: true },
      ],
    });
    return interaction.editReply({ embeds: [embed] });
  },
};
