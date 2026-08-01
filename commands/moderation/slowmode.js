/**
 * /slowmode — set chat slowmode on a channel.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { int, channel, str, req } = require('../../utils/commandBuilder');
const { parseDuration } = require('../../utils/time');

module.exports = {
  name: 'slowmode',
  description: 'Set a slowmode on a channel',
  permissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],
  options: [
    str('duration', 'Slowmode length: "5s", "10m", "6h", or "off"', req()),
    channel('channel', 'Target channel (defaults to current)', { channel_types: [0, 5] }),
  ],
  async run(client, interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const duration = interaction.options.getString('duration').toLowerCase();

    let seconds;
    if (duration === 'off' || duration === '0' || duration === 'none') {
      seconds = 0;
    } else {
      const ms = parseDuration(duration);
      if (!ms) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use `5s`, `10m`, `6h`, or `off`.')], ephemeral: true });
      seconds = Math.round(ms / 1000);
      if (seconds > 21600) return interaction.reply({ embeds: [errorEmbed('Slowmode cannot exceed 6 hours.')], ephemeral: true });
    }

    await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
    return interaction.reply({
      embeds: [successEmbed(`${channel} slowmode set to **${seconds === 0 ? 'off' : seconds + 's'}**.`)],
      ephemeral: true,
    });
  },
};
