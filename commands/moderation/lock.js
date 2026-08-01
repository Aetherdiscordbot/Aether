/**
 * /lock — deny @everyone the Send Messages permission in a channel.
 */
const { PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/discord');
const { channel, str } = require('../../utils/commandBuilder');

module.exports = {
  name: 'lock',
  description: 'Lock a channel so members cannot send messages',
  permissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],
  options: [
    channel('channel', 'Channel to lock (defaults to current)', { channel_types: [0] }),
    str('reason', 'Reason', {}),
  ],
  async run(client, interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'Locked by a moderator';

    const everyone = channel.guild.roles.everyone;
    await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason: `${reason} — ${interaction.user.tag}` });

    return interaction.reply({
      embeds: [successEmbed(`${channel} has been locked. 🔒\n**Reason:** ${reason}`)],
      ephemeral: true,
    });
  },
};
