/**
 * /embed — send/edit custom embeds (free) + saved templates (premium).
 */
const { baseEmbed, errorEmbed, successEmbed, listEmbed } = require('../../utils/discord');
const { cleanId } = require('../../utils/discord');
const templates = require('../../services/embedTemplates');
const { sub, str, channel, req } = require('../../utils/commandBuilder');

const COLOR_HEX = /^#?[0-9a-fA-F]{6}$/;

module.exports = {
  name: 'embed',
  description: 'Create custom embeds',
  aliases: ['say'],
  subPermissions: {
    send: ['ManageMessages'],
    edit: ['ManageMessages'],
    'template-save': ['ManageMessages'],
    'template-use': ['ManageMessages'],
    'template-list': [],
    'template-delete': ['ManageMessages'],
  },
  options: [
    sub('send', 'Send a custom embed', [
      str('title', 'Embed title', req()),
      str('description', 'Embed description', {}),
      str('color', 'Hex color (e.g. #8b5cf6)', {}),
      channel('channel', 'Channel to send to', { channel_types: [0] }),
      str('thumbnail', 'Thumbnail image URL', {}),
      str('image', 'Main image URL', {}),
      str('footer', 'Footer text', {}),
      str('author', 'Author text', {}),
    ]),
    sub('edit', 'Edit a message with a new embed', [
      str('message_id', 'Message ID to edit', req()),
      str('title', 'New title', req()),
      str('description', 'New description', {}),
      str('color', 'Hex color (e.g. #8b5cf6)', {}),
    ]),
    sub('template-save', 'Save the current embed as a template (premium)', [
      str('name', 'Template name', req()),
      str('title', 'Embed title', req()),
      str('description', 'Embed description', {}),
      str('color', 'Hex color (e.g. #8b5cf6)', {}),
      str('thumbnail', 'Thumbnail image URL', {}),
      str('image', 'Main image URL', {}),
      str('footer', 'Footer text', {}),
    ]),
    sub('template-use', 'Send a saved template (premium)', [
      str('name', 'Template name', req()),
      channel('channel', 'Channel to send to', { channel_types: [0] }),
    ]),
    sub('template-list', 'List saved templates (premium)'),
    sub('template-delete', 'Delete a saved template (premium)', [str('name', 'Template name', req())]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'send') {
      const embed = buildEmbed(interaction, {
        title: interaction.options.getString('title'),
        description: interaction.options.getString('description'),
        color: interaction.options.getString('color'),
        thumbnail: interaction.options.getString('thumbnail'),
        image: interaction.options.getString('image'),
        footer: interaction.options.getString('footer'),
        author: interaction.options.getString('author'),
      });
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ embeds: [embed] });
      return interaction.reply({ embeds: [successEmbed(`Embed sent to ${channel}.`)], ephemeral: true });
    }

    if (subCmd === 'edit') {
      const messageId = cleanId(interaction.options.getString('message_id'));
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message) return interaction.reply({ embeds: [errorEmbed('Message not found in this channel.')], ephemeral: true });
      const embed = buildEmbed(interaction, {
        title: interaction.options.getString('title'),
        description: interaction.options.getString('description'),
        color: interaction.options.getString('color'),
      });
      await message.edit({ embeds: [embed] });
      return interaction.reply({ embeds: [successEmbed('Message edited.')], ephemeral: true });
    }

    if (subCmd === 'template-save') {
      const name = (interaction.options.getString('name') || '').trim();
      if (!/^[\w- ]{1,32}$/.test(name)) {
        return interaction.reply({ embeds: [errorEmbed('Template name must be 1–32 characters (letters, numbers, spaces, dashes).')], ephemeral: true });
      }
      const data = {
        title: interaction.options.getString('title'),
        description: interaction.options.getString('description'),
        color: interaction.options.getString('color'),
        thumbnail: interaction.options.getString('thumbnail'),
        image: interaction.options.getString('image'),
        footer: interaction.options.getString('footer'),
      };
      templates.saveTemplate({ guildId: interaction.guildId, name, data, createdBy: interaction.user.id });
      return interaction.reply({ embeds: [successEmbed(`Template **${name}** saved.`)], ephemeral: true });
    }

    if (subCmd === 'template-use') {
      const name = interaction.options.getString('name');
      const tpl = templates.getTemplate(interaction.guildId, name);
      if (!tpl) return interaction.reply({ embeds: [errorEmbed(`Template **${name}** not found.`)], ephemeral: true });
      const embed = buildEmbed(interaction, { ...tpl.data, title: tpl.data.title });
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ embeds: [embed] });
      return interaction.reply({ embeds: [successEmbed(`Sent template **${name}** to ${channel}.`)], ephemeral: true });
    }

    if (subCmd === 'template-list') {
      const rows = templates.listTemplates(interaction.guildId);
      if (!rows.length) return interaction.reply({ embeds: [errorEmbed('No saved templates.')], ephemeral: true });
      return interaction.reply({
        embeds: [listEmbed(rows.map((r) => `**${r.name}** — saved ${new Date(r.created_at).toLocaleDateString()}`), { title: 'Saved Embed Templates' })],
        ephemeral: true,
      });
    }

    const name = interaction.options.getString('name');
    const deleted = templates.deleteTemplate(interaction.guildId, name);
    if (!deleted) return interaction.reply({ embeds: [errorEmbed(`Template **${name}** not found.`)], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Template **${name}** deleted.`)], ephemeral: true });
  },
};

function buildEmbed(interaction, { title, description, color, thumbnail, image, footer, author }) {
  return baseEmbed({
    color: color && COLOR_HEX.test(color) ? parseInt(color.replace('#', ''), 16) : undefined,
    title,
    description,
    thumbnail: thumbnail || undefined,
    image: image || undefined,
    footer: footer ? { text: footer } : undefined,
    author: author ? { name: author } : undefined,
  });
}
