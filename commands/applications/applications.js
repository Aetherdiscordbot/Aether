/**
 * /applications — create, list and manage application forms.
 */
const { errorEmbed, successEmbed } = require('../../utils/discord');
const applicationService = require('../../modules/applications/applicationService');
const db = require('../../database/db');
const { sub, str, channel, role, req } = require('../../utils/commandBuilder');

module.exports = {
  name: 'applications',
  description: 'Application system management',
  subPermissions: {
    create: ['ManageGuild'],
    delete: ['ManageGuild'],
    panel: ['ManageGuild'],
    list: ['ManageGuild'],
  },
  options: [
    sub('create', 'Create an application form', [
      str('title', 'Application title', req()),
      str('questions', 'Questions, separated by "|" (max 5)', req()),
      channel('review_channel', 'Channel where submissions are sent', req({ channel_types: [0] })),
      str('description', 'Description shown on the panel', {}),
      role('role', 'Role granted on approval', {}),
    ]),
    sub('delete', 'Delete an application form', [str('id', 'Application ID', req())]),
    sub('panel', 'Send the application panel to a channel', [
      str('id', 'Application ID', req()),
      channel('channel', 'Channel to send the panel to', req({ channel_types: [0] })),
    ]),
    sub('list', 'List all application forms'),
  ],
  async run(client, interaction) {
    const subCmd = interaction.options.getSubcommand();

    switch (subCmd) {
      case 'create': {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const reviewChannel = interaction.options.getChannel('review_channel');
        const role = interaction.options.getRole('role');
        const questions = (interaction.options.getString('questions') || '')
          .split('|')
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, applicationService.MAX_QUESTIONS);

        if (!questions.length) return interaction.reply({ embeds: [errorEmbed('Provide at least one question.')], ephemeral: true });

        const app = applicationService.createApp({
          guildId: interaction.guildId,
          title,
          description,
          questions,
          reviewChannelId: reviewChannel.id,
          roleId: role?.id,
        });
        return interaction.reply({
          embeds: [successEmbed(`Application **${app.title}** created.\n**ID:** \`${app.id}\`\nSend the panel with \`/applications panel\`.` )],
          ephemeral: true,
        });
      }
      case 'delete': {
        const app = applicationService.deleteApp(interaction.options.getString('id'));
        if (!app) return interaction.reply({ embeds: [errorEmbed('Application not found.')], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed(`Application **${app.title}** deleted.`)], ephemeral: true });
      }
      case 'panel': {
        const channel = interaction.options.getChannel('channel');
        const result = await applicationService.publishPanel(interaction.guild, interaction.options.getString('id'), channel);
        if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
        return interaction.reply({ embeds: [successEmbed(`Panel sent to ${channel}.`)], ephemeral: true });
      }
      case 'list': {
        const apps = db.prepare('SELECT * FROM applications WHERE guild_id = ?').all(interaction.guildId);
        if (!apps.length) return interaction.reply({ embeds: [successEmbed('No application forms yet. Create one with `/applications create`.')], ephemeral: true });
        const embed = require('../../utils/discord').baseEmbed({
          title: 'Application Forms',
          fields: apps.map((a) => ({ name: a.title, value: `ID: \`${a.id}\` · ${JSON.parse(a.questions).length} questions`, inline: false })),
        });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
