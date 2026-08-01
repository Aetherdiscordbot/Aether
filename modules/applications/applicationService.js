/**
 * Application service: create application forms, submit answers, review.
 */
const { randomUUID } = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const logService = require('../../services/logService');
const { baseEmbed, Colors, truncate } = require('../../utils/discord');

const MAX_QUESTIONS = 5;

function getApp(id) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) || null;
}

function getSubmission(id) {
  return db.prepare('SELECT * FROM application_submissions WHERE id = ?').get(id) || null;
}

function createApp({ guildId, title, description, questions, reviewChannelId, roleId }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO applications (id, guild_id, title, description, questions, review_channel_id, role_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, guildId, title, description || null, JSON.stringify(questions.slice(0, MAX_QUESTIONS)), reviewChannelId || null, roleId || null, new Date().toISOString());
  return getApp(id);
}

function deleteApp(id) {
  db.prepare('DELETE FROM application_submissions WHERE app_id = ?').run(id);
  const row = getApp(id);
  if (row) db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  return row;
}

function appEmbed(app) {
  return baseEmbed({
    color: Colors.primary,
    title: app.title,
    description: app.description || 'Apply using the button below.',
    fields: [{ name: 'Questions', value: String(JSON.parse(app.questions).length) }],
    footer: { text: `Application ID: ${app.id}` },
  });
}

function applyButton(appId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`application:start:${appId}`).setLabel('Apply Now').setStyle(ButtonStyle.Primary).setEmoji('📝')
  );
}

async function publishPanel(guild, appId, channel) {
  const app = getApp(appId);
  if (!app) return { error: 'Application not found.' };
  await channel.send({ embeds: [appEmbed(app)], components: [applyButton(app.id)] });
  return { app };
}

function hasPendingSubmission(appId, userId) {
  return !!db.prepare("SELECT id FROM application_submissions WHERE app_id = ? AND user_id = ? AND status = 'pending'").get(appId, userId);
}

function submissionEmbed(submission, app) {
  let answers = [];
  try { answers = JSON.parse(submission.answers); } catch { /* ignore */ }
  const fields = Object.entries(answers).map(([q, a]) => ({ name: truncate(q, 256), value: truncate(String(a), 1024) }));
  return baseEmbed({
    color: Colors.info,
    title: `Application Submission — ${app.title}`,
    description: `By <@${submission.user_id}>`,
    fields,
    footer: { text: `Submission ID: ${submission.id}` },
  });
}

function reviewButtons(submissionId) {
  const approve = new ButtonBuilder()
    .setCustomId(`application:approve:${submissionId}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');
  const deny = new ButtonBuilder()
    .setCustomId(`application:deny:${submissionId}`)
    .setLabel('Deny')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  return new ActionRowBuilder().addComponents(approve, deny);
}

/** Record a submitted application and forward it to the review channel. */
async function submitApplication(client, guild, appId, user, answers) {
  const app = getApp(appId);
  if (!app) return { error: 'Application not found.' };
  if (hasPendingSubmission(appId, user.id)) return { error: 'You already have a pending application.' };

  const id = randomUUID();
  db.prepare(
    `INSERT INTO application_submissions (id, app_id, guild_id, user_id, answers, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, appId, guild.id, user.id, JSON.stringify(answers), new Date().toISOString());

  const submission = getSubmission(id);
  const channel = app.review_channel_id ? guild.channels.cache.get(app.review_channel_id) : null;
  if (channel?.isTextBased()) {
    await channel.send({ embeds: [submissionEmbed(submission, app)], components: [reviewButtons(submission.id)] });
  }

  await logService.sendLog(guild, 'application', {
    color: Colors.info,
    title: 'Application Received',
    description: `${user} applied for **${app.title}**`,
  });

  return { submission, app };
}

/** Approve or deny a submission, notify the applicant and optionally grant the role. */
async function reviewSubmission(client, guild, submissionId, decision, reviewer, note) {
  const submission = getSubmission(submissionId);
  if (!submission) return { error: 'Submission not found.' };
  if (submission.status !== 'pending') return { error: 'This submission was already reviewed.' };

  const app = getApp(submission.app_id);
  const status = decision === 'approve' ? 'approved' : 'denied';
  db.prepare('UPDATE application_submissions SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = ? WHERE id = ?').run(
    status,
    reviewer.id,
    note || null,
    new Date().toISOString(),
    submissionId
  );

  const member = await guild.members.fetch(submission.user_id).catch(() => null);
  if (status === 'approved' && app?.role_id && member) {
    await member.roles.add(app.role_id).catch(() => {});
  }

  const applicant = await client.users.fetch(submission.user_id).catch(() => null);
  if (applicant) {
    applicant
      .send({
        embeds: [
          baseEmbed({
            color: status === 'approved' ? Colors.success : Colors.error,
            title: `Your application for **${app?.title || 'the server'}** was ${status}`,
            description: note || undefined,
          }),
        ],
      })
      .catch(() => {});
  }

  await logService.sendLog(guild, 'application', {
    color: status === 'approved' ? Colors.success : Colors.error,
    title: `Application ${status === 'approved' ? 'Approved' : 'Denied'}`,
    description: `<@${submission.user_id}> for **${app?.title}**\nReviewed by ${reviewer}${note ? ` — ${note}` : ''}`,
  });

  return { submission: getSubmission(submissionId) };
}

module.exports = {
  MAX_QUESTIONS,
  createApp,
  deleteApp,
  getApp,
  getSubmission,
  publishPanel,
  submitApplication,
  reviewSubmission,
  appEmbed,
  submissionEmbed,
  hasPendingSubmission,
};
