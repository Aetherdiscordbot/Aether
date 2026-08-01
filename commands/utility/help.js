/**
 * /help — list all commands grouped by category.
 */
const commandHandler = require('../../handlers/commandHandler');
const { baseEmbed, Colors } = require('../../utils/discord');

module.exports = {
  name: 'help',
  description: 'Show all available commands',
  aliases: ['commands', 'cmds'],
  async run(client, interaction) {
    const commands = [...commandHandler.commands.values()].filter((c) => c.type !== 'USER' && c.type !== 'MESSAGE');
    const groups = new Map();
    for (const cmd of commands) {
      const folder = cmd.file.split(/[\\/]/).slice(-2, -1)[0] || 'misc';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(cmd);
    }

    const fields = [...groups.entries()].map(([folder, cmds]) => ({
      name: `📁 ${folder.charAt(0).toUpperCase() + folder.slice(1)}`,
      value: cmds.map((c) => `\`/${c.name}\``).join(' '),
      inline: false,
    }));

    return interaction.reply({
      embeds: [
        baseEmbed({
          color: Colors.primary,
          title: '✨ Aether Commands',
          description: `Aether is a premium all-in-one Discord bot.\nUse \`/premium info\` to learn about Premium.\n\n**${commands.length} commands loaded:**`,
          fields,
          footer: { text: 'Aether · Premium Discord bot' },
        }),
      ],
    });
  },
};
