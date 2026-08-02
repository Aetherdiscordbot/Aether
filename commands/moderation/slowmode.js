/**
 * /slowmode — set chat slowmode on a channel.
 * Free: one channel. Premium: apply to every text channel at once.
 */
const { errorEmbed, successEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const { int, channel, str, bool, req } = require('../../utils/commandBuilder');
const { parseDuration } = require('../../utils/time');

module.exports = {
  name: 'slowmode',
  description: 'Set a slowmode on a channel',
  permissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],
  options: [
    str('duration', 'Slowmode length: "5s", "10m", "6h", or "off"', req()),
    channel('channel', 'Target channel (defaults to current)', { channel_types: [0, 5] }),
    bool('all', 'Apply to every text channel (premium)', {}),
  ],
  async run(client, interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const duration = interaction.options.getString('duration').toLowerCase();
    const all = interaction.options.getBoolean('all');

    if (all && !premiumService.isPremium(interaction.guildId)) {
      return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
    }

    let seconds;
    if (duration === 'off' || duration === '0' || duration === 'none') {
      seconds = 0;
    } else {
      const ms = parseDuration(duration);
      if (!ms) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use `5s`, `10m`, `6h`, or `off`.')], ephemeral: true });
      seconds = Math.round(ms / 1000);
      if (seconds > 21600) return interaction.reply({ embeds: [errorEmbed('Slowmode cannot exceed 6 hours.')], ephemeral: true });
    }

    if (all) {
      const targets = interaction.guild.channels.cache.filter((c) => c.isTextBased());
      let count = 0;
      for (const [, c] of targets) {
        try {
          await c.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag} (all)`);
          count++;
        } catch {
          /* skip channels we can't manage */
        }
      }
      return interaction.reply({
        embeds: [successEmbed(`Slowmode set to **${seconds === 0 ? 'off' : seconds + 's'}** in **${count}** channels.`)],
        ephemeral: true,
      });
    }

    await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
    return interaction.reply({
      embeds: [successEmbed(`${channel} slowmode set to **${seconds === 0 ? 'off' : seconds + 's'}**.`)],
      ephemeral: true,
    });
  },
};
