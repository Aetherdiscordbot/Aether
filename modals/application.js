/**
 * Application modals — submit an application, or finalize a review.
 */
const { errorEmbed, successEmbed } = require('../utils/discord');
const applicationService = require('../modules/applications/applicationService');

module.exports = {
  id: 'application',
  type: 'modal',
  async run(client, interaction) {
    const [, flow, param, submissionId] = interaction.customId.split(':');

    if (flow === 'submit') {
      return submit(client, interaction, param);
    }
    if (flow === 'review') {
      return review(client, interaction, param, submissionId);
    }
  },
};

async function submit(client, interaction, appId) {
  const app = applicationService.getApp(appId);
  if (!app) return interaction.reply({ embeds: [errorEmbed('Application not found.')], ephemeral: true });
  if (applicationService.hasPendingSubmission(appId, interaction.user.id)) {
    return interaction.reply({ embeds: [errorEmbed('You already have a pending application.')], ephemeral: true });
  }

  const questions = JSON.parse(app.questions);
  const answers = {};
  for (let i = 0; i < questions.length; i++) {
    answers[questions[i]] = interaction.fields.getTextInputValue(`q${i}`) || '(no answer)';
  }

  const result = await applicationService.submitApplication(client, interaction.guild, appId, interaction.user, answers);
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({
    embeds: [successEmbed(`Your application for **${app.title}** was submitted. Staff will review it shortly.`)],
    ephemeral: true,
  });
}

async function review(client, interaction, action, submissionId) {
  const note = interaction.fields.getTextInputValue('note') || '';
  const result = await applicationService.reviewSubmission(client, interaction.guild, submissionId, action, interaction.user, note);
  if (result.error) return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  return interaction.reply({ embeds: [successEmbed(`Application ${action}d.`)], ephemeral: true });
}
