/**
 * /unlock — restore Send Messages for @everyone in a channel.
 */
const { PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { channel, str } = require('../../utils/commandBuilder');

module.exports = {
  name: 'unlock',
  description: 'Unlock a previously locked channel',
  permissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],
  options: [
    channel('channel', 'Channel to unlock (defaults to current)', { channel_types: [0] }),
    str('reason', 'Reason', {}),
  ],
  async run(client, interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'Unlocked by a moderator';

    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null }, { reason: `${reason} — ${interaction.user.tag}` });

    return interaction.reply({
      embeds: [successEmbed(`${channel} has been unlocked. 🔓\n**Reason:** ${reason}`)],
      ephemeral: true,
    });
  },
};
