/**
 * /avatar — show a user's avatar.
 */
const { baseEmbed } = require('../../utils/discord');
const { user } = require('../../utils/commandBuilder');

module.exports = {
  name: 'avatar',
  description: 'Show a user\'s avatar',
  aliases: ['av', 'pfp'],
  cooldown: 5,
  options: [user('user', 'User whose avatar to show', {})],
  async run(client, interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    return interaction.reply({
      embeds: [
        baseEmbed({
          color: 0x8b5cf6,
          title: `${target.username}'s Avatar`,
          image: target.displayAvatarURL({ size: 1024 }),
          footer: { text: target.id },
        }),
      ],
    });
  },
};
