/**
 * Giveaway service: create, end and reroll giveaways.
 * Winners are picked from members who reacted with 🎉.
 */
const { randomUUID } = require('crypto');
const db = require('../../database/db');
const logger = require('../../services/logger');
const { baseEmbed, Colors, successEmbed } = require('../../utils/discord');
const { formatDuration, timestamp } = require('../../utils/time');

const EMOJI = '🎉';

function createGiveaway({ guildId, channelId, prize, winners, endsAt, hostId, roleRequired }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO giveaways (id, guild_id, channel_id, prize, winners, ends_at, host_id, role_required, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    guildId,
    channelId,
    prize,
    Math.max(1, Math.floor(winners)),
    new Date(endsAt).toISOString(),
    hostId,
    roleRequired || null,
    new Date().toISOString()
  );
  return id;
}

/** Build the giveaway embed + message. */
async function publishGiveaway(client, giveaway) {
  const guild = client.guilds.cache.get(giveaway.guild_id);
  const channel = guild?.channels.cache.get(giveaway.channel_id);
  if (!channel?.isTextBased()) return null;

  const role = giveaway.role_required ? guild.roles.cache.get(giveaway.role_required) : null;
  const embed = baseEmbed({
    color: Colors.primary,
    title: '🎉 GIVEAWAY',
    description: `**${giveaway.prize}**\n\n🎁 **Winners:** ${giveaway.winners}\n⏰ **Ends:** ${timestamp(giveaway.ends_at)} (${formatDuration(Math.max(0, Date.parse(giveaway.ends_at) - Date.now()))})\n` + (role ? `🔒 **Requires:** ${role}\n` : '') + `👤 **Hosted by:** <@${giveaway.host_id}>\n\nReact with ${EMOJI} to enter!`,
    footer: { text: `ID: ${giveaway.id}` },
  });

  const message = await channel.send({ embeds: [embed] });
  await message.react(EMOJI).catch(() => {});
  db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(message.id, giveaway.id);
  return message;
}

/** Check all giveaways that should have ended and resolve them. */
async function processGiveaways(client) {
  const now = new Date().toISOString();
  const due = db.prepare("SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?").all(now);
  for (const giveaway of due) {
    try {
      await endGiveaway(client, giveaway.id, false);
    } catch (err) {
      logger.error(`Giveaway ${giveaway.id} ending failed: ${err.message}`);
    }
  }
}

/** End a giveaway and pick winners. */
async function endGiveaway(client, id, manual = false) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
  if (!giveaway || giveaway.ended) return null;

  const guild = client.guilds.cache.get(giveaway.guild_id);
  const channel = guild?.channels.cache.get(giveaway.channel_id);

  let entrants = [];
  if (giveaway.message_id && channel?.isTextBased()) {
    try {
      const message = await channel.messages.fetch(giveaway.message_id);
      const reaction = message.reactions.cache.get(EMOJI);
      if (reaction) {
        const users = await reaction.users.fetch();
        entrants = [...users.values()].filter((u) => !u.bot && u.id !== giveaway.host_id);
      }
    } catch { /* message deleted */ }
  }

  if (giveaway.role_required) {
    const members = await guild?.members.fetch().catch(() => null);
    entrants = entrants.filter((u) => {
      const m = members?.get(u.id);
      return m?.roles.cache.has(giveaway.role_required);
    });
  }

  const winners = [];
  const pool = [...entrants];
  while (winners.length < giveaway.winners && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  const endedAt = new Date();
  db.prepare('UPDATE giveaways SET ended = 1, winners_picked = ? WHERE id = ?').run(JSON.stringify(winners.map((w) => w.id)), id);

  const embed = baseEmbed({
    color: Colors.success,
    title: '🎉 GIVEAWAY ENDED',
    description:
      `**${giveaway.prize}**\n\n` +
      (winners.length
        ? `**Winner${winners.length > 1 ? 's' : ''}:** ${winners.map((w) => `<@${w.id}>`).join(', ')}\n\nCongratulations!`
        : 'No valid entries — no winner could be picked.'),
    footer: { text: `Ended by ${manual ? 'moderator' : 'timer'} · ID: ${id}` },
  });

  if (channel?.isTextBased()) {
    const message = await channel.send({ embeds: [embed] });
    if (winners.length && channel.send) {
      await channel.send({
        embeds: [
          successEmbed(
            `${winners.map((w) => `<@${w.id}>`).join(', ')} — congratulations! You won **${giveaway.prize}**!`
          ),
        ],
      });
    }
    return { message, winners, giveaway };
  }
  return { winners, giveaway };
}

/** Pick a new winner for an ended giveaway. */
async function reroll(client, id) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
  if (!giveaway || !giveaway.ended) return null;

  const guild = client.guilds.cache.get(giveaway.guild_id);
  const channel = guild?.channels.cache.get(giveaway.channel_id);
  if (!channel?.isTextBased()) return null;

  const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  if (!message) return null;

  const reaction = message.reactions.cache.get(EMOJI);
  if (!reaction) return null;

  const users = await reaction.users.fetch();
  const previous = new Set(JSON.parse(giveaway.winners_picked || '[]'));
  const pool = [...users.values()].filter((u) => !u.bot && u.id !== giveaway.host_id && !previous.has(u.id));
  if (!pool.length) return null;

  const winner = pool[Math.floor(Math.random() * pool.length)];
  await channel.send({
    embeds: [successEmbed(`Rerolled winner for **${giveaway.prize}**: <@${winner.id}>!`)],
  });
  return winner;
}

module.exports = { createGiveaway, publishGiveaway, processGiveaways, endGiveaway, reroll };
