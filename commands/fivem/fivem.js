/**
 * /fivem — FiveM bridge utilities.
 */
const { errorEmbed, successEmbed, baseEmbed } = require('../../utils/discord');
const fivemService = require('../../modules/fivem/fivemService');
const { sub, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'fivem',
  description: 'FiveM server bridge',
  options: [
    sub('link', 'Generate a code to link your Discord to the FiveM server', [
      req(),
    ]),
    sub('status', 'Check FiveM server connection status'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const cfg = fivemService.getConfig(interaction.guildId);

    if (!cfg.enabled) {
      return interaction.reply({
        embeds: [errorEmbed('FiveM bridge is disabled. Enable it in the dashboard first.')],
        ephemeral: true,
      });
    }

    if (subCmd === 'link') {
      const { code, expiresAt } = fivemService.createVerifyCode(interaction.guildId, interaction.user.id, 5);
      return interaction.reply({
        embeds: [baseEmbed({
          color: 0x8b5cf6,
          title: 'FiveM Link Code',
          description: `Your code: \`${code}\`\n\nIn the FiveM server chat, type:\n\`/verify ${code}\``,
          footer: { text: `Expires ${new Date(expiresAt).toLocaleTimeString()} (5 min)` },
        })],
        ephemeral: true,
      });
    }

    if (subCmd === 'status') {
      const players = fivemService.getPlayers(interaction.guildId);
      const lastSeen = players[0]?.last_seen ? new Date(players[0].last_seen).toLocaleString() : 'Never';
      return interaction.reply({
        embeds: [baseEmbed({
          color: players.length ? 0x34d399 : 0xf87171,
          title: 'FiveM Server Status',
          fields: [
            { name: 'Players Online', value: String(players.length), inline: true },
            { name: 'Last Heartbeat', value: lastSeen, inline: true },
            { name: 'Framework', value: cfg.framework, inline: true },
            { name: 'Poll Interval', value: `${cfg.pollInterval}s`, inline: true },
          ],
        })],
        ephemeral: true,
      });
    }
  },
};