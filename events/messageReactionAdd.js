/**
 * Reaction added → enforce premium poll rules:
 * - role-only polls remove reactions from members without the role
 * - single-vote polls remove older votes when a member votes again
 */
const polls = require('../services/polls');

module.exports = {
  name: 'messageReactionAdd',
  run(reaction, user) {
    if (user.bot) return;
    const message = reaction.message;
    const poll = polls.getPollByMessage(message.id);
    if (!poll) return;

    const member = message.guild?.members.cache.get(user.id);
    const emoji = reaction.emoji.name;
    const idx = polls.EMOJIS.indexOf(emoji);
    if (idx < 0) return;

    const allowed = polls.canVote(poll, member);

    if (!allowed) {
      reaction.users.remove(user.id).catch(() => {});
      return;
    }

    if (!poll.multi) {
      // Remove the member's votes on other options (single-vote poll).
      for (let i = 0; i < polls.EMOJIS.length; i++) {
        if (i === idx) continue;
        const other = message.reactions.cache.get(polls.EMOJIS[i]);
        if (other && other.users.cache.has(user.id)) {
          other.users.remove(user.id).catch(() => {});
        }
      }
    }
  },
};
