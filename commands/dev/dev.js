/**
 * /dev — developer-only utilities.
 */
const { successEmbed, errorEmbed, baseEmbed, Colors } = require('../../utils/discord');
const db = require('../../database/db');
const config = require('../../config/config');
const { sub, str, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'dev',
  description: 'Developer tools (bot owner only)',
  ownerOnly: true,
  options: [
    sub('eval', 'Evaluate JavaScript', [str('code', 'Code to evaluate', req())]),
    sub('say', 'Send a message as the bot', [str('message', 'Message to send', req()), { type: 7, name: 'channel', description: 'Channel to send to' }]),
    sub('servers', 'List all servers the bot is in'),
    sub('activity', 'Set the bot\'s status', [{ type: 3, name: 'status', description: 'Custom status text', required: true }]),
    sub('db', 'Run a read-only SQL query', [str('query', 'SQL SELECT statement', req())]),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'eval': {
        const code = interaction.options.getString('code');
        await interaction.deferReply({ ephemeral: true });
        try {
          // eslint-disable-next-line no-eval
          const result = await eval(`(async () => { ${code} })()`);
          const out = typeof result === 'string' ? result : require('util').inspect(result, { depth: 3 });
          return interaction.editReply({
            embeds: [
              baseEmbed({
                color: Colors.success,
                title: '✅ Eval',
                description: `\`\`\`js\n${String(out).slice(0, 1900)}\n\`\`\``,
              }),
            ],
          });
        } catch (err) {
          return interaction.editReply({
            embeds: [baseEmbed({ color: Colors.error, title: '❌ Eval Error', description: `\`\`\`js\n${String(err).slice(0, 1900)}\n\`\`\`` })],
          });
        }
      }
      case 'say': {
        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        await channel.send(message);
        return interaction.reply({ embeds: [successEmbed('Message sent.')], ephemeral: true });
      }
      case 'servers': {
        const lines = [...client.guilds.cache.values()].map((g) => `**${g.name}** (\`${g.id}\`) — ${g.memberCount} members`);
        return interaction.reply({
          embeds: [
            baseEmbed({
              color: Colors.info,
              title: `Servers (${client.guilds.cache.size})`,
              description: lines.join('\n').slice(0, 4000) || 'None.',
            }),
          ],
          ephemeral: true,
        });
      }
      case 'activity': {
        const status = interaction.options.getString('status');
        client.user.setActivity(status);
        return interaction.reply({ embeds: [successEmbed(`Status set to **${status}**.`)], ephemeral: true });
      }
      case 'db': {
        const query = interaction.options.getString('query').trim();
        if (!/^\s*select\b/i.test(query)) return interaction.reply({ embeds: [errorEmbed('Only SELECT queries are allowed.')], ephemeral: true });
        try {
          const rows = db.prepare(query).all().slice(0, 10);
          return interaction.reply({
            embeds: [
              baseEmbed({
                color: Colors.info,
                title: 'Query Results',
                description: `\`\`\`json\n${JSON.stringify(rows, null, 2).slice(0, 3800)}\n\`\`\``,
              }),
            ],
            ephemeral: true,
          });
        } catch (err) {
          return interaction.reply({ embeds: [errorEmbed(String(err.message))], ephemeral: true });
        }
      }
    }
  },
};
