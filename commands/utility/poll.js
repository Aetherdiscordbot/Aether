/**
 * /poll — create a poll.
 * Free: 2–10 options, one vote each.
 * Premium: anonymous, role-only voting, multiple votes, timed auto-close.
 */
const { errorEmbed, successEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const polls = require('../../services/polls');
const { parseDuration } = require('../../utils/time');
const { str, bool, role, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'poll',
  description: 'Create a poll',
  cooldown: 30,
  options: [
    str('question', 'Poll question', req()),
    str('options', 'Options separated by "|" (2–10)', req()),
    bool('anonymous', 'Hide who created the poll (premium)', {}),
    bool('multi', 'Allow voting on multiple options (premium)', {}),
    role('role', 'Only this role can vote (premium)', {}),
    str('duration', 'Auto-close after e.g. 10m, 2h, 1d (premium)', {}),
  ],
  async run(client, interaction) {
    const question = interaction.options.getString('question');
    const options = (interaction.options.getString('options') || '')
      .split('|')
      .map((o) => o.trim())
      .filter(Boolean);

    if (options.length < 2) return interaction.reply({ embeds: [errorEmbed('Provide at least 2 options.')], ephemeral: true });
    if (options.length > 10) return interaction.reply({ embeds: [errorEmbed('Maximum 10 options.')], ephemeral: true });

    const anonymous = interaction.options.getBoolean('anonymous');
    const multi = interaction.options.getBoolean('multi');
    const requiredRole = interaction.options.getRole('role');
    const durationStr = interaction.options.getString('duration');

    const isPremium = premiumService.isPremium(interaction.guildId);
    const usesPremium = anonymous || multi || requiredRole || durationStr;
    if (usesPremium && !isPremium) {
      return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
    }

    let endsAt = null;
    if (durationStr) {
      const ms = parseDuration(durationStr);
      if (!ms) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use e.g. `10m`, `2h`, `1d`.')], ephemeral: true });
      endsAt = new Date(Date.now() + ms);
    }

    const lines = options.map((o, i) => `${polls.EMOJIS[i]} ${o}`).join('\n');
    const message = await interaction.channel.send({
      embeds: [
        require('../../utils/discord').baseEmbed({
          color: require('../../utils/discord').Colors.primary,
          title: `📊 ${question}`,
          description: lines + (endsAt ? `\n\n⏰ **Closes:** ${require('../../utils/time').timestamp(endsAt.toISOString())}` : ''),
          footer: {
            text: anonymous
              ? `${multi ? 'Multiple votes allowed. ' : 'One vote per person. '}${requiredRole ? 'Role-locked. ' : ''}Anonymous poll.`
              : `${multi ? 'Multiple votes allowed. ' : 'One vote per person. '}Poll by ${interaction.user.username}`,
          },
        }),
      ],
    });

    for (let i = 0; i < options.length; i++) {
      await message.react(polls.EMOJIS[i]).catch(() => {});
    }

    polls.createPoll({
      guildId: interaction.guildId,
      channelId: interaction.channel.id,
      messageId: message.id,
      question,
      options,
      createdBy: interaction.user.id,
      anonymous,
      roleRequired: requiredRole?.id,
      multi,
      endsAt,
    });

    return interaction.reply({ embeds: [successEmbed('Poll created.')], ephemeral: true });
  },
};
