/**
 * /giveaway — Create a giveaway.
 */
const { EmbedBuilder, ChannelType } = require('discord.js');
const giveaways = require('../../services/giveaways');

async function getEntries(guild, gw) {
  const channel = guild.channels.cache.get(gw.channel_id);
  if (!channel) return [];
  const message = await channel.messages.fetch(gw.message_id).catch(() => null);
  if (!message) return [];
  const reactions = message.reactions.cache.get('🎉');
  const users = reactions ? await reactions.users.fetch() : null;
  return users ? [...users.filter(u => !u.bot).keys()] : [];
}

module.exports = {
  name: 'giveaway',
  description: 'Manage giveaways',
  permissions: ['ManageGuild'],
  options: [
    { name: 'create', description: 'Create a giveaway', type: 1, options: [
      { name: 'prize', description: 'What to give away', type: 3, required: true },
      { name: 'channel', description: 'Channel to host in', type: 7, required: true, channel_types: [ChannelType.GuildText] },
      { name: 'duration', description: 'Duration (e.g., 1h, 30m, 1d)', type: 3, required: true },
      { name: 'winners', description: 'Number of winners', type: 4, required: false },
    ]},
    { name: 'end', description: 'End a giveaway early', type: 1, options: [
      { name: 'message_id', description: 'Giveaway message ID', type: 3, required: true },
    ]},
    { name: 'reroll', description: 'Reroll winners', type: 1, options: [
      { name: 'message_id', description: 'Giveaway message ID', type: 3, required: true },
    ]},
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const guildId = interaction.guildId;
      const prize = interaction.options.getString('prize');
      const channel = interaction.options.getChannel('channel');
      const duration = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') || 1;

      const match = duration.match(/^(\d+)([smhd])$/);
      if (!match) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Invalid duration. Use: 1s, 5m, 1h, 1d')], ephemeral: true });

      const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      const endsAt = new Date(Date.now() + parseInt(match[1]) * mult[match[2]]).toISOString();

      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🎉 GIVEAWAY')
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>`)
        .setFooter({ text: 'React with 🎉 to enter' })
        .setTimestamp(new Date(endsAt));

      const msg = await channel.send({ embeds: [embed] });
      await msg.react('🎉');

      await giveaways.create(guildId, channel.id, prize, winners, endsAt, interaction.user.id, {}, msg.id);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Giveaway created in ${channel}!`)] });
    }

    if (sub === 'end') {
      const msgId = interaction.options.getString('message_id');
      const gw = await giveaways.getByMessage(interaction.guildId, msgId);
      if (!gw || gw.ended) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Giveaway not found or already ended.')], ephemeral: true });

      const entries = await getEntries(interaction.guild, gw);
      const channel = interaction.guild.channels.cache.get(gw.channel_id);

      if (!entries.length) {
        if (channel) channel.send({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('🎉 Giveaway Ended').setDescription('No valid entries.')] });
      } else {
        const winners = entries.sort(() => 0.5 - Math.random()).slice(0, gw.winners);
        if (channel) {
          channel.send({
            content: winners.map(w => `<@${w}>`).join(' '),
            embeds: [new EmbedBuilder().setColor(0x44ff44).setTitle('🎉 Giveaway Ended!').setDescription(`**Prize:** ${gw.prize}\n**Winners:** ${winners.map(w => `<@${w}>`).join(', ')}`).setTimestamp()],
          });
        }
      }
      await giveaways.end(interaction.guildId, gw.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Giveaway ended.')] });
    }

    if (sub === 'reroll') {
      const msgId = interaction.options.getString('message_id');
      const gw = await giveaways.getByMessage(interaction.guildId, msgId);
      if (!gw) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Giveaway not found.')], ephemeral: true });

      const entries = await getEntries(interaction.guild, gw);
      if (!entries.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('No entries to reroll.')], ephemeral: true });

      const winners = entries.sort(() => 0.5 - Math.random()).slice(0, gw.winners);
      const channel = interaction.guild.channels.cache.get(gw.channel_id);
      if (channel) {
        channel.send({
          content: winners.map(w => `<@${w}>`).join(' '),
          embeds: [new EmbedBuilder().setColor(0x44ff44).setTitle('🎉 Reroll').setDescription(`**New winners:** ${winners.map(w => `<@${w}>`).join(', ')}`).setTimestamp()],
        });
      }
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription('✅ Winners rerolled.')] });
    }
  },
};
