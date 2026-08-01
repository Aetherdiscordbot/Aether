/**
 * /verify — set up member verification.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const verificationService = require('../../modules/verification/verificationService');
const { sub, channel, role, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'verify',
  description: 'Member verification system',
  subPermissions: {
    setup: ['ManageGuild'],
    panel: ['ManageGuild'],
    disable: ['ManageGuild'],
  },
  options: [
    sub('setup', 'Configure verification', [
      role('role', 'Role granted on verification', req()),
      channel('channel', 'Channel for the verification message', req({ channel_types: [0] })),
      str('message', 'Message shown above the button', {}),
    ]),
    sub('panel', 'Send the verification panel to a channel', [channel('channel', 'Channel for the panel', req({ channel_types: [0] }))]),
    sub('disable', 'Disable verification'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'setup': {
        const role = interaction.options.getRole('role');
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        verificationService.setConfig(interaction.guildId, {
          enabled: true,
          roleId: role.id,
          channelId: channel.id,
          message: message || undefined,
        });
        await verificationService.publishPanel(interaction.guild, channel);
        return interaction.reply({ embeds: [successEmbed(`Verification configured. Panel sent to ${channel}.`)], ephemeral: true });
      }
      case 'panel': {
        const channel = interaction.options.getChannel('channel');
        await verificationService.publishPanel(interaction.guild, channel);
        return interaction.reply({ embeds: [successEmbed(`Panel sent to ${channel}.`)], ephemeral: true });
      }
      case 'disable': {
        verificationService.setConfig(interaction.guildId, { enabled: false });
        return interaction.reply({ embeds: [successEmbed('Verification disabled.')], ephemeral: true });
      }
    }
  },
};
