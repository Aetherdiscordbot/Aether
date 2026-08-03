/**
 * /giveaway — Create a giveaway.
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const giveaways = require('../../services/giveaways');

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
      const prize = interaction.options.getString('prize');
      const channel = interaction.options.getChannel('channel');
      const duration = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') || 1;
      
      const match = duration.match(/^(\d+)([smhd])$/);
      if (!match) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('Invalid duration. Use: 1s, 5m, 1h, 1d')], ephemeral: true });
      
      const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      const endsAt = new Date(Date.now() + parseInt(match[1]) * mult[match[2]]).toISOString();
      
      const gw = await giveaways.create(interaction.guildId, interaction.options.getChannel('channel').id, interaction.options.getString('prize'), interaction.options.getInteger('winners') || 1, endsAt, interaction.user.id);
      
      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🎉 GIVEAWAY')
        .setDescription(`**Prize:** ${interaction.options.getString('prize')}\n**Winners:** ${interaction.options.getInteger('winners') || 1}\n**Ends:** <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>`)
        .setFooter({ text: `Giveaway ID: ${gw.id} • React with 🎉 to enter` })
        .setTimestamp(new Date(endsAt));
      
      const msg = await interaction.options.getChannel('channel').send({ embeds: [embed] });
      await msg.react('🎉');
      
      await giveaways.create(interaction.guildId, interaction.options.getChannel('channel').id, interaction.options.getString('prize'), interaction.options.getInteger('winners') || 1, endsAt, interaction.user.id);
      
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setDescription(`✅ Giveaway created in ${channel}!`)] });
    }
  },
};