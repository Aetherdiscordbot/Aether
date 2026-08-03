/**
 * /embed — Embed templates (premium only).
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const embedTemplates = require('../../services/embedTemplates');

module.exports = {
  name: 'embed',
  description: 'Embed templates (premium)',
  premium: true,
  options: [
    { name: 'create', description: 'Create an embed template', type: 1, options: [
      { name: 'name', description: 'Template name', type: 3, required: true },
      { name: 'json', description: 'Embed JSON (Discord embed format)', type: 3, required: true },
    ]},
    { name: 'send', description: 'Send an embed template', type: 1, options: [
      { name: 'name', description: 'Template name', type: 3, required: true },
      { name: 'channel', description: 'Channel to send to', type: 7, required: false, channel_types: [0] },
    ]},
    { name: 'delete', description: 'Delete a template', type: 1, options: [
      { name: 'name', description: 'Template name', type: 3, required: true },
    ]},
    { name: 'list', description: 'List templates', type: 1, options: [] },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      let json;
      try { json = JSON.parse(interaction.options.getString('json')); } catch { return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Invalid JSON.')], ephemeral: true }); }
      const result = await embedTemplates.create(interaction.guildId, interaction.options.getString('name'), json, interaction.user.id);
      if (!result.ok) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(result.error)], ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Embed template created.')] });
    }
    if (sub === 'send') {
      const tpl = await embedTemplates.get(interaction.guildId, interaction.options.getString('name'));
      if (!tpl) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Template not found.')], ephemeral: true });
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ embeds: [tpl.template] });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Embed sent.')], ephemeral: true });
    }
    if (sub === 'delete') {
      await embedTemplates.delete(interaction.guildId, interaction.options.getString('name'));
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Template deleted.')] });
    }
    if (sub === 'list') {
      const list = await embedTemplates.list(interaction.guildId);
      if (!list.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('No templates.')], ephemeral: true });
      const lines = list.map(t => `\`${t.name}\``).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('📋 Embed Templates').setDescription(lines).setTimestamp()], ephemeral: true });
    }
  },
};