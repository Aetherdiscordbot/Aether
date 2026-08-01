/**
 * /embed — send a custom embed.
 */
const { baseEmbed, errorEmbed, successEmbed } = require('../../utils/discord');
const { cleanId } = require('../../utils/discord');
const { sub, str, channel, int, req } = require('../../utils/commandBuilder');

const COLOR_HEX = /^#?[0-9a-fA-F]{6}$/;

module.exports = {
  name: 'embed',
  description: 'Create custom embeds',
  aliases: ['say'],
  subPermissions: {
    send: ['ManageMessages'],
    edit: ['ManageMessages'],
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
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'send') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const thumbnail = interaction.options.getString('thumbnail');
      const image = interaction.options.getString('image');
      const footer = interaction.options.getString('footer');
      const author = interaction.options.getString('author');

      const embed = baseEmbed({
        color: color && COLOR_HEX.test(color) ? parseInt(color.replace('#', ''), 16) : undefined,
        title,
        description,
        thumbnail: thumbnail || undefined,
        image: image || undefined,
        footer: footer ? { text: footer } : undefined,
        author: author ? { name: author } : undefined,
      });

      await channel.send({ embeds: [embed] });
      return interaction.reply({ embeds: [successEmbed(`Embed sent to ${channel}.`)], ephemeral: true });
    }

    // edit
    const messageId = cleanId(interaction.options.getString('message_id'));
    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) return interaction.reply({ embeds: [errorEmbed('Message not found in this channel.')], ephemeral: true });

    const color = interaction.options.getString('color');
    const embed = baseEmbed({
      color: color && COLOR_HEX.test(color) ? parseInt(color.replace('#', ''), 16) : undefined,
      title: interaction.options.getString('title'),
      description: interaction.options.getString('description'),
    });
    await message.edit({ embeds: [embed] });
    return interaction.reply({ embeds: [successEmbed('Message edited.')], ephemeral: true });
  },
};
