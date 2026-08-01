/**
 * /logging — configure per-event log channels.
 */
const logService = require('../../services/logService');
const { baseEmbed, Colors, successEmbed, errorEmbed, infoEmbed } = require('../../utils/discord');
const { str, channel, sub, req, bool } = require('../../utils/commandBuilder');

const EVENT_CHOICES = logService.EVENT_KEYS.map((e) => ({ name: e.label, value: e.key }));

module.exports = {
  name: 'logging',
  description: 'Configure Aether\'s logging system',
  permissions: ['ManageGuild'],
  options: [
    sub('setup', 'Route an event to a log channel', [
      str('event', 'Which event to route', req({ choices: EVENT_CHOICES })),
      channel('channel', 'Log channel', req({ channel_types: [0] })),
    ]),
    sub('disable', 'Stop logging an event', [
      str('event', 'Which event to disable', req({ choices: EVENT_CHOICES })),
    ]),
    sub('toggle', 'Enable or disable all logging', [
      bool('enabled', 'Enable (true) or disable (false) all logging', req()),
    ]),
    sub('view', 'Show the current logging configuration'),
    sub('test', 'Send a test log to an event channel', [
      str('event', 'Which event to test', req({ choices: EVENT_CHOICES })),
    ]),
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = logService.getConfig(interaction.guildId);

    switch (sub) {
      case 'setup': {
        const event = interaction.options.getString('event');
        const channel = interaction.options.getChannel('channel');
        logService.setConfig(interaction.guildId, { channels: { [event]: channel.id } });
        return interaction.reply({
          embeds: [successEmbed(`**${eventLabel(event)}** logs → ${channel}`)],
          ephemeral: true,
        });
      }
      case 'disable': {
        const event = interaction.options.getString('event');
        logService.setConfig(interaction.guildId, { channels: { [event]: null } });
        return interaction.reply({ embeds: [successEmbed(`**${eventLabel(event)}** logs disabled.`)], ephemeral: true });
      }
      case 'toggle': {
        const enabled = interaction.options.getBoolean('enabled');
        logService.setConfig(interaction.guildId, { enabled });
        return interaction.reply({
          embeds: [successEmbed(`Logging is now **${enabled ? 'enabled' : 'disabled'}**.`)],
          ephemeral: true,
        });
      }
      case 'view': {
        const lines = logService.EVENT_KEYS.map((e) => {
          const chId = cfg.channels[e.key];
          const ch = chId ? interaction.guild.channels.cache.get(chId) : null;
          return `• **${e.label}:** ${ch ? ch.toString() : '`— not set —`'}`;
        });
        return interaction.reply({
          embeds: [
            baseEmbed({
              color: Colors.info,
              title: 'Logging Configuration',
              description: `Logging is currently **${cfg.enabled ? 'enabled' : 'disabled'}**.\n\n${lines.join('\n')}`,
            }),
          ],
          ephemeral: true,
        });
      }
      case 'test': {
        const event = interaction.options.getString('event');
        const sent = await logService.sendLog(interaction.guild, event, {
          color: Colors.success,
          title: 'Test Log',
          description: `This is a test of the **${eventLabel(event)}** log.`,
          footer: { text: `Sent by ${interaction.user.tag}` },
        });
        if (sent) return interaction.reply({ embeds: [successEmbed(`Test log sent to ${sent.channel}.`)], ephemeral: true });
        return interaction.reply({ embeds: [errorEmbed(`No channel is configured for **${eventLabel(event)}**.`)] , ephemeral: true });
      }
    }
  },
};

function eventLabel(key) {
  return logService.EVENT_KEYS.find((e) => e.key === key)?.label || key;
}
