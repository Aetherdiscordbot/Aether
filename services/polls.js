/**
 * Poll service: create polls, enforce role-only voting, close timed polls.
 * Premium extras: anonymous, role-only, multi-vote, timed auto-close.
 */
const { randomUUID } = require('crypto');
const db = require('../database/db');
const logger = require('./logger');
const { baseEmbed, Colors } = require('../utils/discord');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function createPoll({ guildId, channelId, messageId, question, options, createdBy, anonymous, roleRequired, multi, endsAt }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO polls (id, guild_id, channel_id, message_id, question, options, created_by, anonymous, role_required, multi, ends_at, closed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    guildId,
    channelId,
    messageId,
    question,
    JSON.stringify(options),
    createdBy,
    anonymous ? 1 : 0,
    roleRequired || null,
    multi ? 1 : 0,
    endsAt ? new Date(endsAt).toISOString() : null,
    new Date().toISOString()
  );
  return id;
}

function getPollByMessage(messageId) {
  return db.prepare('SELECT * FROM polls WHERE message_id = ? AND closed = 0').get(messageId);
}

/** Close a poll, count reactions and post the result embed. */
async function closePoll(client, poll, { manual = false } = {}) {
  const guild = client.guilds.cache.get(poll.guild_id);
  const channel = guild?.channels.cache.get(poll.channel_id);
  if (!channel?.isTextBased()) return null;

  const options = JSON.parse(poll.options || '[]');
  const counts = options.map((_, i) => 0);
  let voters = new Set();

  try {
    const message = await channel.messages.fetch(poll.message_id);
    for (let i = 0; i < options.length; i++) {
      const reaction = message.reactions.cache.get(EMOJIS[i]);
      if (!reaction) continue;
      const users = await reaction.users.fetch();
      for (const u of users.values()) {
        if (u.bot) continue;
        voters.add(u.id);
        counts[i]++;
      }
    }
  } catch {
    /* message deleted — counts stay 0 */
  }

  const total = voters.size;
  const rows = options
    .map((o, i) => ({ option: o, votes: counts[i] }))
    .sort((a, b) => b.votes - a.votes);

  db.prepare('UPDATE polls SET closed = 1 WHERE id = ?').run(poll.id);

  const lines = rows.map((r, i) => {
    const pct = total ? Math.round((r.votes / total) * 100) : 0;
    const bar = '▰'.repeat(Math.round(pct / 10)) + '▱'.repeat(10 - Math.round(pct / 10));
    return `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} **${r.option}** — ${r.votes} vote${r.votes === 1 ? '' : 's'} (${pct}%)\n\`${bar}\``;
  }).join('\n');

  const embed = baseEmbed({
    color: Colors.primary,
    title: `📊 ${poll.question}`,
    description: `**Poll closed** — ${total} vote${total === 1 ? '' : 's'}\n\n${lines}`,
    footer: { text: manual ? 'Closed by moderator' : 'Poll finished' },
  });

  const msg = await channel.send({ embeds: [embed] });
  return { message: msg, rows, total };
}

/** Close any timed polls that are due. */
function processDue(client) {
  const now = new Date().toISOString();
  const due = db.prepare('SELECT * FROM polls WHERE closed = 0 AND ends_at IS NOT NULL AND ends_at <= ?').all(now);
  for (const poll of due) {
    closePoll(client, poll).catch((err) => logger.error(`Poll ${poll.id} auto-close failed: ${err.message}`));
  }
}

/** Is the user allowed to vote on this poll? */
function canVote(poll, member) {
  if (!poll.role_required) return true;
  return Boolean(member?.roles.cache.has(poll.role_required));
}

module.exports = { EMOJIS, createPoll, getPollByMessage, closePoll, processDue, canVote };
