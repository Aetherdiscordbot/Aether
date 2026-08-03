/**
 * /automod — Configure AutoMod.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const automod = require('../../services/automod');

module.exports = {
  name: 'automod',
  description: 'Configure AutoMod',
  permissions: ['ManageGuild'],
  options: [
    { name: 'enable', description: 'Enable AutoMod', type: 1, options: [] },
    { name: 'disable', description: 'Disable AutoMod', type: 1, options: [] },
    { name: 'config', description: 'View current config', type: 1, options: [] },
    { name: 'word', description: 'Add/remove banned word', type: 1, options: [
      { name: 'add', description: 'Add a banned word', type: 1, options: [{ name: 'word', description: 'Word to ban', type: 3, required: true }] },
      { name: 'remove', description: 'Remove a banned word', type: 1, options: [{ name: 'word', description: 'Word to remove', type: 3, required: true }] },
      { name: 'list', description: 'List banned words', type: 1, options: [] },
    ]},
    { name: 'links', description: 'Toggle link filtering', type: 1, options: [] },
    { name: 'log', description: 'Set log channel', type: 1, options: [
      { name: 'channel', description: 'Log channel', type: 7, required: true, channel_types: [0] },
    ]},
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await automod.getConfig(interaction.guildId);
    
    if (sub === 'enable') {
      config.enabled = true;
      await automod.setConfig(interaction.guildId, config);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ AutoMod enabled.')] });
    }
    if (sub === 'disable') {
      config.enabled = false;
      await automod.setConfig(interaction.guildId, config);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ AutoMod disabled.')] });
    }
    if (sub === 'config') {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🛡️ AutoMod Config').setDescription(JSON.stringify(config, null, 2).slice(0, 4000)).setTimestamp()] });
    }
    if (sub === 'word') {
      const action = interaction.options.getSubcommand();
      const word = interaction.options.getString('word');
      if (action === 'add') {
        config.words = config.words || { enabled: true, list: [], action: 'delete' };
        if (!config.words.list.includes(word)) config.words.list.push(word);
      } else if (action === 'remove') {
        config.words = config.words || { list: [] };
        config.words.list = config.words.list.filter(w => w !== word);
      } else if (action === 'list') {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🚫 Banned Words').setDescription(config.words?.list?.join(', ') || 'None')] });
      }
      await automod.setConfig(interaction.guildId, config);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Word ${action}ed.`)] });
    }
    if (sub === 'links') {
      config.links = config.links || { enabled: true, allow_discord: true, action: 'delete' };
      config.links.enabled = !config.links.enabled;
      await automod.setConfig(interaction.guildId, config);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Link filtering ${config.links.enabled ? 'enabled' : 'disabled'}.`)] });
    }
    if (sub === 'log') {
      const channel = interaction.options.getChannel('channel');
      config.log_channel = channel.id;
      await automod.setConfig(interaction.guildId, config);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Log channel set to <#${channel.id}>`)] });
    }
  },
};