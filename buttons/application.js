/**
 * Application buttons — start an application, or review a submission.
 */
const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const applicationService = require('../modules/applications/applicationService');
const { errorEmbed, infoEmbed } = require('../utils/discord');

module.exports = {
  id: 'application',
  type: 'button',
  async run(client, interaction) {
    const [, action, id] = interaction.customId.split(':');

    if (action === 'start') {
      return startApplication(interaction, id);
    }
    if (action === 'approve' || action === 'deny') {
      return reviewPrompt(interaction, action, id);
    }
  },
};

async function startApplication(interaction, appId) {
  const app = applicationService.getApp(appId);
  if (!app) return interaction.reply({ embeds: [errorEmbed('Application not found.')], ephemeral: true });
  if (applicationService.hasPendingSubmission(appId, interaction.user.id)) {
    return interaction.reply({ embeds: [errorEmbed('You already have a pending application.')], ephemeral: true });
  }

  const questions = JSON.parse(app.questions);
  const modal = new ModalBuilder().setCustomId(`application:submit:${appId}`).setTitle(`Apply — ${app.title}`);
  for (let i = 0; i < questions.length; i++) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${i}`)
          .setLabel(questions[i].slice(0, 45))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1024)
      )
    );
  }
  return interaction.showModal(modal);
}

async function reviewPrompt(interaction, action, submissionId) {
  const submission = applicationService.getSubmission(submissionId);
  if (!submission) return interaction.reply({ embeds: [errorEmbed('Submission not found.')], ephemeral: true });
  if (submission.status !== 'pending') return interaction.reply({ embeds: [errorEmbed('Already reviewed.')], ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`application:review:${action}:${submissionId}`)
    .setTitle(action === 'approve' ? 'Approve Application' : 'Deny Application')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Note / reason')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1024)
      )
    );
  return interaction.showModal(modal);
}
