/**
 * /welcome — configure welcome messages and auto-roles.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const settings = require('../../services/settings');
const { renderTemplate } = require('../../events/guildMemberAdd');
const { sub, channel, str, role, req, bool } = require('../../utils/commandBuilder');

const DEFAULT = {
  enabled: false,
  channelId: null,
  welcomeMessage: 'Welcome {user} to {server}!',
  welcomeEmbed: null,
  leaveChannelId: null,
  leaveMessage: 'Goodbye {user}, we will miss you.',
  leaveEmbed: null,
  autoroleIds: [],
  autoroleEnabled: true,
};

module.exports = {
  name: 'welcome',
  description: 'Welcome messages and auto-roles',
  subPermissions: {
    setup: ['ManageGuild'],
    disable: ['ManageGuild'],
    test: ['ManageGuild'],
    autorole: ['ManageGuild'],
    leave: ['ManageGuild'],
  },
  options: [
    sub('setup', 'Configure welcome messages', [
      channel('channel', 'Channel for welcome messages', req({ channel_types: [0] })),
      str('message', 'Message template ({user}, {server}, {mention}, {count})', {}),
      str('title', 'Embed title (optional)', {}),
      bool('use_embed', 'Post as an embed (default true)', {}),
    ]),
    sub('leave', 'Configure leave messages', [
      channel('channel', 'Channel for leave messages', req({ channel_types: [0] })),
      str('message', 'Leave message template', {}),
    ]),
    sub('autorole', 'Add an auto-role on join', [role('role', 'Role to assign automatically', req())]),
    sub('autorole-remove', 'Remove an auto-role', [role('role', 'Role to remove from auto-roles', req())]),
    sub('test', 'Send a test welcome message to this channel'),
    sub('disable', 'Disable welcome messages'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const cfg = { ...DEFAULT, ...settings.getSetting(interaction.guildId, 'welcome', {}) };

    switch (subCmd) {
      case 'setup': {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message') || cfg.welcomeMessage;
        const title = interaction.options.getString('title');
        const useEmbed = interaction.options.getBoolean('use_embed') ?? true;
        settings.setSetting(interaction.guildId, 'welcome', {
          enabled: true,
          channelId: channel.id,
          welcomeMessage: message,
          welcomeEmbed: useEmbed ? { ...(cfg.welcomeEmbed || {}), title } : null,
        });
        return interaction.reply({
          embeds: [successEmbed(`Welcome messages enabled in ${channel}${title ? ` with title **${title}**` : ''}.`)],
          ephemeral: true,
        });
      }
      case 'leave': {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message') || cfg.leaveMessage;
        settings.setSetting(interaction.guildId, 'welcome', { leaveChannelId: channel.id, leaveMessage: message });
        return interaction.reply({ embeds: [successEmbed(`Leave messages enabled in ${channel}.`)], ephemeral: true });
      }
      case 'autorole': {
        const role = interaction.options.getRole('role');
        const ids = new Set(cfg.autoroleIds || []);
        ids.add(role.id);
        settings.setSetting(interaction.guildId, 'welcome', { autoroleIds: [...ids], autoroleEnabled: true });
        return interaction.reply({ embeds: [successEmbed(`${role} will be assigned on join.`)], ephemeral: true });
      }
      case 'autorole-remove': {
        const role = interaction.options.getRole('role');
        const ids = (cfg.autoroleIds || []).filter((r) => r !== role.id);
        settings.setSetting(interaction.guildId, 'welcome', { autoroleIds: ids });
        return interaction.reply({ embeds: [successEmbed(`${role} removed from auto-roles.`)], ephemeral: true });
      }
      case 'test': {
        const sample = { guild: interaction.guild, member: interaction.member, user: interaction.user, channel: interaction.channel };
        const text = renderTemplate(cfg.welcomeMessage, sample.member);
        const embed = cfg.welcomeEmbed
          ? baseEmbed({
              color: Colors.success,
              title: cfg.welcomeEmbed.title ? renderTemplate(cfg.welcomeEmbed.title, sample.member) : undefined,
              description: text,
              thumbnail: interaction.user.displayAvatarURL({ size: 256 }),
            })
          : baseEmbed({ color: Colors.success, description: text, thumbnail: interaction.user.displayAvatarURL({ size: 256 }) });
        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({ embeds: [successEmbed('Test welcome sent.')], ephemeral: true });
      }
      case 'disable': {
        settings.setSetting(interaction.guildId, 'welcome', { enabled: false });
        return interaction.reply({ embeds: [successEmbed('Welcome messages disabled.')], ephemeral: true });
      }
    }
  },
};
