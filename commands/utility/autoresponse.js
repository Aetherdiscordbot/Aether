/**
 * /autoresponse — automatic keyword replies.
 * Free: up to 10 responses, exact/starts/ends/contains matching.
 * Premium: unlimited responses + regex match type + per-trigger cooldown.
 */
const { baseEmbed, Colors, errorEmbed, successEmbed } = require('../../utils/discord');
const premiumService = require('../../services/premium');
const autoResponses = require('../../services/autoResponses');
const { sub, str, int, req } = require('../../utils/commandBuilder');

const FREE_LIMIT = 10;

module.exports = {
  name: 'autoresponse',
  description: 'Automatic responses to keywords',
  aliases: ['autoreply', 'ar'],
  cooldown: 5,
  options: [
    sub('add', 'Add an automatic response', [
      str('trigger', 'Word or phrase that triggers the response', req({ max_length: 200 })),
      str('response', 'What the bot replies with', req({ max_length: 2000 })),
      str('match', 'Match type', {
        choices: [
          { name: 'exact', value: 'exact' },
          { name: 'starts', value: 'starts' },
          { name: 'ends', value: 'ends' },
          { name: 'contains', value: 'contains' },
          { name: 'regex (premium)', value: 'regex' },
        ],
      }),
      int('cooldown', 'Cooldown in seconds between replies (premium)', { min: 0, max: 3600 }),
    ]),
    sub('list', 'List all auto-responses', []),
    sub('remove', 'Remove an auto-response', [str('trigger', 'Trigger to remove', req({ max_length: 200 }))]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();
    const premium = premiumService.isPremium(interaction.guildId);

    if (subCmd === 'add') {
      const trigger = interaction.options.getString('trigger');
      const response = interaction.options.getString('response');
      const matchType = interaction.options.getString('match') || 'exact';
      const cooldown = interaction.options.getInteger('cooldown') || 0;

      if (matchType === 'regex' && !premium) {
        return interaction.reply({
          embeds: [errorEmbed('Regex matching requires Aether Premium on this server.')],
          ephemeral: true,
        });
      }
      if (cooldown > 0 && !premium) {
        return interaction.reply({
          embeds: [errorEmbed('Cooldowns require Aether Premium on this server.')],
          ephemeral: true,
        });
      }
      if (!premium && autoResponses.count(interaction.guildId) >= FREE_LIMIT) {
        return interaction.reply({
          embeds: [errorEmbed(`Free servers can have up to ${FREE_LIMIT} auto-responses. Upgrade to Premium for unlimited.`)],
          ephemeral: true,
        });
      }

      const err = autoResponses.add({
        guildId: interaction.guildId,
        trigger,
        response,
        matchType,
        cooldown,
        createdBy: interaction.user.id,
      });
      if (err) return interaction.reply({ embeds: [errorEmbed(err)], ephemeral: true });
      return interaction.reply({
        embeds: [successEmbed(`Auto-response added: **"${trigger}"** (${matchType})`)],
      });
    }

    if (subCmd === 'remove') {
      const trigger = interaction.options.getString('trigger');
      if (!autoResponses.remove(interaction.guildId, trigger)) {
        return interaction.reply({ embeds: [errorEmbed('No auto-response with that trigger exists.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed(`Removed auto-response **"${trigger}"**.`)] });
    }

    const rows = autoResponses.list(interaction.guildId);
    if (!rows.length) {
      return interaction.reply({ embeds: [errorEmbed('No auto-responses configured. Use `/autoresponse add`.')], ephemeral: true });
    }
    const fields = rows.map((r, i) => ({
      name: `${i + 1}. ${r.trigger}`,
      value: `» ${r.response}\n` + `Match: \`${r.match_type}\`${r.cooldown ? ` · cooldown ${r.cooldown}s` : ''}`,
    }));
    return interaction.reply({
      embeds: [
        baseEmbed({
          color: Colors.primary,
          title: `🤖 Auto-responses (${rows.length}${premium ? '' : `/${FREE_LIMIT}`})`,
          fields,
        }),
      ],
    });
  },
};
