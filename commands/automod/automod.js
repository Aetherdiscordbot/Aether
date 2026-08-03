/**
 * /automod — Configure AutoMod.
 */
const { EmbedBuilder } = require('discord.js');
const automod = require('../../services/automod');

module.exports = {
  name: 'automod',
  description: 'Configure AutoMod',
  permissions: ['ManageGuild'],
  options: [
    { name: 'enable', description: 'Enable AutoMod', type: 1, options: [] },
    { name: 'disable', description: 'Disable AutoMod', type: 1, options: [] },
    { name: 'config', description: 'View current config', type: 1, options: [] },
    { name: 'word_add', description: 'Add a banned word', type: 1, options: [
      { name: 'word', description: 'Word to ban', type: 3, required: true },
    ]},
    { name: 'word_remove', description: 'Remove a banned word', type: 1, options: [
      { name: 'word', description: 'Word to remove', type: 3, required: true },
    ]},
    { name: 'word_list', description: 'List banned words', type: 1, options: [] },
    { name: 'links', description: 'Toggle link filtering', type: 1, options: [] },
    { name: 'invites', description: 'Toggle invite filtering', type: 1, options: [] },
    { name: 'caps', description: 'Toggle caps filtering', type: 1, options: [] },
    { name: 'spam', description: 'Toggle spam filtering', type: 1, options: [] },
    { name: 'mentions', description: 'Toggle mention filter / set max', type: 1, options: [
      { name: 'max', description: 'Max mentions per message', type: 4, required: false },
    ]},
    { name: 'emojis', description: 'Toggle emoji filter / set max', type: 1, options: [
      { name: 'max', description: 'Max emojis per message', type: 4, required: false },
    ]},
    { name: 'new_account', description: 'Toggle new-account filter / set min age', type: 1, options: [
      { name: 'days', description: 'Minimum account age in days', type: 4, required: false },
    ]},
    { name: 'log', description: 'Set log channel', type: 1, options: [
      { name: 'channel', description: 'Log channel', type: 7, required: true, channel_types: [0] },
    ]},
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await automod.getConfig(interaction.guildId);

    const ok = desc => interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(desc)] });

    if (sub === 'enable') {
      config.enabled = true;
      await automod.setConfig(interaction.guildId, config);
      return ok('✅ AutoMod enabled.');
    }
    if (sub === 'disable') {
      config.enabled = false;
      await automod.setConfig(interaction.guildId, config);
      return ok('❌ AutoMod disabled.');
    }
    if (sub === 'config') {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🛡️ AutoMod Config').setDescription(JSON.stringify(config, null, 2).slice(0, 4000)).setTimestamp()] });
    }
    if (sub === 'word_add') {
      const word = interaction.options.getString('word');
      config.words = config.words || { enabled: true, list: [], action: 'delete' };
      if (!config.words.list.includes(word)) config.words.list.push(word);
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Added banned word: ${word}`);
    }
    if (sub === 'word_remove') {
      const word = interaction.options.getString('word');
      config.words = config.words || { enabled: true, list: [], action: 'delete' };
      config.words.list = (config.words.list || []).filter(w => w !== word);
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Removed banned word: ${word}`);
    }
    if (sub === 'word_list') {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🚫 Banned Words').setDescription(config.words?.list?.join(', ') || 'None')] });
    }
    if (sub === 'links') {
      config.links = config.links || { enabled: false, allow_discord: true, action: 'delete' };
      config.links.enabled = !config.links.enabled;
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Link filtering ${config.links.enabled ? 'enabled' : 'disabled'}.`);
    }
    if (sub === 'invites') {
      config.invites = config.invites || { enabled: false, action: 'delete' };
      config.invites.enabled = !config.invites.enabled;
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Invite filtering ${config.invites.enabled ? 'enabled' : 'disabled'}.`);
    }
    if (sub === 'caps') {
      config.caps = config.caps || { enabled: false, min_length: 10, max_percent: 70, action: 'delete' };
      config.caps.enabled = !config.caps.enabled;
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Caps filtering ${config.caps.enabled ? 'enabled' : 'disabled'}.`);
    }
    if (sub === 'spam') {
      config.spam = config.spam || { enabled: false, max_messages: 5, interval: 5000, action: 'timeout' };
      config.spam.enabled = !config.spam.enabled;
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Spam filtering ${config.spam.enabled ? 'enabled' : 'disabled'}.`);
    }
    if (sub === 'mentions') {
      const max = interaction.options.getInteger('max');
      config.mentions = config.mentions || { enabled: false, max: 5, action: 'delete' };
      if (max != null) {
        config.mentions.max = max;
        config.mentions.enabled = true;
      } else {
        config.mentions.enabled = !config.mentions.enabled;
      }
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Mention filter ${config.mentions.enabled ? 'enabled' : 'disabled'} (max ${config.mentions.max}).`);
    }
    if (sub === 'emojis') {
      const max = interaction.options.getInteger('max');
      config.emojis = config.emojis || { enabled: false, max: 10, action: 'delete' };
      if (max != null) {
        config.emojis.max = max;
        config.emojis.enabled = true;
      } else {
        config.emojis.enabled = !config.emojis.enabled;
      }
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Emoji filter ${config.emojis.enabled ? 'enabled' : 'disabled'} (max ${config.emojis.max}).`);
    }
    if (sub === 'new_account') {
      const days = interaction.options.getInteger('days');
      config.new_accounts = config.new_accounts || { enabled: false, min_age_days: 7, action: 'kick' };
      if (days != null) {
        config.new_accounts.min_age_days = days;
        config.new_accounts.enabled = true;
      } else {
        config.new_accounts.enabled = !config.new_accounts.enabled;
      }
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ New-account filter ${config.new_accounts.enabled ? 'enabled' : 'disabled'} (min ${config.new_accounts.min_age_days} days).`);
    }
    if (sub === 'log') {
      const channel = interaction.options.getChannel('channel');
      config.log_channel = channel.id;
      await automod.setConfig(interaction.guildId, config);
      return ok(`✅ Log channel set to <#${channel.id}>`);
    }
  },
};
