/**
 * /poll — create a poll with up to 10 options.
 */
const { randomUUID } = require('crypto');
const db = require('../../database/db');
const { baseEmbed, Colors, errorEmbed } = require('../../utils/discord');
const { str, req } = require('../../utils/commandBuilder');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  name: 'poll',
  description: 'Create a poll',
  cooldown: 30,
  options: [
    str('question', 'Poll question', req()),
    str('options', 'Options separated by "|" (2–10)', req()),
  ],
  async run(client, interaction) {
    const question = interaction.options.getString('question');
    const options = (interaction.options.getString('options') || '')
      .split('|')
      .map((o) => o.trim())
      .filter(Boolean);

    if (options.length < 2) return interaction.reply({ embeds: [errorEmbed('Provide at least 2 options.')], ephemeral: true });
    if (options.length > 10) return interaction.reply({ embeds: [errorEmbed('Maximum 10 options.')], ephemeral: true });

    const lines = options.map((o, i) => `${EMOJIS[i]} ${o}`).join('\n');
    const message = await interaction.channel.send({
      embeds: [
        baseEmbed({
          color: Colors.primary,
          title: `📊 ${question}`,
          description: lines,
          footer: { text: `Poll by ${interaction.user.username}` },
        }),
      ],
    });

    for (let i = 0; i < options.length; i++) {
      await message.react(EMOJIS[i]).catch(() => {});
    }

    const id = randomUUID();
    db.prepare('INSERT INTO polls (id, guild_id, channel_id, message_id, question, options, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      id,
      interaction.guildId,
      interaction.channel.id,
      message.id,
      question,
      JSON.stringify(options),
      interaction.user.id,
      new Date().toISOString()
    );

    return interaction.reply({ embeds: [require('../../utils/discord').successEmbed('Poll created.')], ephemeral: true });
  },
};
