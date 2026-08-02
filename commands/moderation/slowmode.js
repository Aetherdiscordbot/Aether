/**
 * /slowmode — set chat slowmode on a channel.
 * Free: one channel. Premium: apply to every text channel at once,
 * and optionally auto-reset slowmode to off after the duration.
 */
const { errorEmbed, successEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const scheduledTasks = require('../../services/scheduledTasks');
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
    bool('timed', 'Auto-reset slowmode to off after the duration (premium)', {}),
  ],
  async run(client, interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const duration = interaction.options.getString('duration').toLowerCase();
    const all = interaction.options.getBoolean('all');
    const timed = interaction.options.getBoolean('timed');

    if ((all || timed) && !premiumService.isPremium(interaction.guildId)) {
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
      const scheduled = [];
      for (const [, c] of targets) {
        try {
          await c.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag} (all)`);
          count++;
          if (timed && seconds > 0) {
            scheduled.push(
              scheduledTasks.create({
                guildId: interaction.guildId,
                type: 'slowmode_release',
                channelId: c.id,
                runAt: Date.now() + seconds * 1000,
                createdBy: interaction.user.id,
              })
            );
          }
        } catch {
          /* skip channels we can't manage */
        }
      }
      const extra = timed && seconds > 0 ? ` Auto-reset scheduled in ${count} channels.` : '';
      return interaction.reply({
        embeds: [successEmbed(`Slowmode set to **${seconds === 0 ? 'off' : seconds + 's'}** in **${count}** channels.${extra}`)],
        ephemeral: true,
      });
    }

    await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
    let extra = '';
    if (timed && seconds > 0) {
      scheduledTasks.create({
        guildId: interaction.guildId,
        type: 'slowmode_release',
        channelId: channel.id,
        runAt: Date.now() + seconds * 1000,
        createdBy: interaction.user.id,
      });
      extra = ' Auto-reset scheduled.';
    }
    return interaction.reply({
      embeds: [successEmbed(`${channel} slowmode set to **${seconds === 0 ? 'off' : seconds + 's'}**.${extra}`)],
      ephemeral: true,
    });
  },
};
