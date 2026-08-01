/**
 * /automod — configure auto-moderation rules.
 */
const { errorEmbed, successEmbed, baseEmbed, Colors } = require('../../utils/discord');
const automodService = require('../../modules/automod/automodService');
const { sub, str, int, bool, role, channel, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'automod',
  description: 'Auto-moderation configuration',
  subPermissions: {
    toggle: ['ManageGuild'],
    words: ['ManageGuild'],
    links: ['ManageGuild'],
    caps: ['ManageGuild'],
    mentions: ['ManageGuild'],
    emoji: ['ManageGuild'],
    ignore: ['ManageGuild'],
    config: ['ManageGuild'],
  },
  options: [
    sub('toggle', 'Enable or disable auto-mod', [bool('enabled', 'Enabled?', req())]),
    sub('words', 'Manage banned words', [str('action', 'add or remove', req()), str('word', 'The word', req())]),
    sub('links', 'Enable/disable link filtering', [bool('enabled', 'Enabled?', req())]),
    sub('caps', 'Enable/disable caps protection', [bool('enabled', 'Enabled?', req()), int('max_percent', 'Max uppercase percent', { min_value: 1, max_value: 100 })]),
    sub('mentions', 'Enable/disable mention protection', [bool('enabled', 'Enabled?', req()), int('max', 'Max mentions allowed', { min_value: 1 })]),
    sub('emoji', 'Enable/disable emoji spam protection', [bool('enabled', 'Enabled?', req()), int('max', 'Max emojis allowed', { min_value: 1 })]),
    sub('ignore', 'Ignore a channel or role', [
      { type: 3, name: 'target', description: 'channel or role', required: true },
      { type: 3, name: 'action', description: 'add or remove', required: true },
      channel('channel', 'Channel to ignore', { channel_types: [0] }),
      role('role', 'Role to ignore', {}),
    ]),
    sub('config', 'Show the current auto-mod configuration'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const cfg = automodService.getConfig(interaction.guildId);

    switch (subCmd) {
      case 'toggle': {
        automodService.setConfig(interaction.guildId, { enabled: interaction.options.getBoolean('enabled') });
        return interaction.reply({ embeds: [successEmbed(`Auto-mod ${interaction.options.getBoolean('enabled') ? 'enabled' : 'disabled'}.`)], ephemeral: true });
      }
      case 'words': {
        const action = interaction.options.getString('action').toLowerCase();
        const word = interaction.options.getString('word').toLowerCase();
        const words = new Set(cfg.words);
        if (action === 'add') words.add(word);
        else if (action === 'remove') words.delete(word);
        else return interaction.reply({ embeds: [errorEmbed('Action must be `add` or `remove`.')], ephemeral: true });
        automodService.setConfig(interaction.guildId, { words: [...words] });
        return interaction.reply({ embeds: [successEmbed(`\`${word}\` ${action}ed to the banned words list.`)], ephemeral: true });
      }
      case 'links': {
        automodService.setConfig(interaction.guildId, { links: { ...cfg.links, enabled: interaction.options.getBoolean('enabled') } });
        return interaction.reply({ embeds: [successEmbed(`Link filtering ${interaction.options.getBoolean('enabled') ? 'enabled' : 'disabled'}.`)], ephemeral: true });
      }
      case 'caps': {
        const update = { enabled: interaction.options.getBoolean('enabled') };
        const pct = interaction.options.getInteger('max_percent');
        if (pct !== null) update.maxPercent = pct;
        automodService.setConfig(interaction.guildId, { caps: { ...cfg.caps, ...update } });
        return interaction.reply({ embeds: [successEmbed('Caps protection updated.')], ephemeral: true });
      }
      case 'mentions': {
        const update = { enabled: interaction.options.getBoolean('enabled') };
        const max = interaction.options.getInteger('max');
        if (max !== null) update.max = max;
        automodService.setConfig(interaction.guildId, { mentions: { ...cfg.mentions, ...update } });
        return interaction.reply({ embeds: [successEmbed('Mention protection updated.')], ephemeral: true });
      }
      case 'emoji': {
        const update = { enabled: interaction.options.getBoolean('enabled') };
        const max = interaction.options.getInteger('max');
        if (max !== null) update.maxEmojis = max;
        automodService.setConfig(interaction.guildId, { emojiSpam: { ...cfg.emojiSpam, ...update } });
        return interaction.reply({ embeds: [successEmbed('Emoji spam protection updated.')], ephemeral: true });
      }
      case 'ignore': {
        const target = interaction.options.getString('target').toLowerCase();
        const action = interaction.options.getString('action').toLowerCase();
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        if (!['channel', 'role'].includes(target)) return interaction.reply({ embeds: [errorEmbed('Target must be `channel` or `role`.')], ephemeral: true });
        const id = target === 'channel' ? channel?.id : role?.id;
        if (!id) return interaction.reply({ embeds: [errorEmbed(`Provide a ${target}.`)], ephemeral: true });

        const key = target === 'channel' ? 'ignoreChannels' : 'ignoreRoles';
        const list = new Set(cfg[key]);
        if (action === 'add') list.add(id);
        else if (action === 'remove') list.delete(id);
        else return interaction.reply({ embeds: [errorEmbed('Action must be `add` or `remove`.')], ephemeral: true });
        automodService.setConfig(interaction.guildId, { [key]: [...list] });
        return interaction.reply({ embeds: [successEmbed(`Updated ignored ${target}s (${list.size}).`)], ephemeral: true });
      }
      case 'config': {
        return interaction.reply({
          embeds: [
            baseEmbed({
              color: Colors.info,
              title: 'Auto-Mod Configuration',
              fields: [
                { name: 'Enabled', value: cfg.enabled ? '✅' : '❌', inline: true },
                { name: 'Banned words', value: String(cfg.words.length), inline: true },
                { name: 'Link filter', value: cfg.links.enabled ? '✅' : '❌', inline: true },
                { name: 'Caps', value: `${cfg.caps.enabled ? '✅' : '❌'} (${cfg.caps.maxPercent}%)`, inline: true },
                { name: 'Mentions', value: `${cfg.mentions.enabled ? '✅' : '❌'} (max ${cfg.mentions.max})`, inline: true },
                { name: 'Emoji spam', value: `${cfg.emojiSpam.enabled ? '✅' : '❌'} (max ${cfg.emojiSpam.maxEmojis})`, inline: true },
                { name: 'Ignored channels', value: cfg.ignoreChannels.length ? cfg.ignoreChannels.map((c) => `<#${c}>`).join(' ') : 'None', inline: false },
              ],
            }),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
