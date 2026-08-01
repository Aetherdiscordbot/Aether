/**
 * voiceStateUpdate: voice-activity logging + voice XP accumulation.
 */
const logService = require('../services/logService');
const levelingService = require('../modules/leveling/levelingService');
const { Colors, truncate } = require('../utils/discord');
const { formatDuration } = require('../utils/time');

const voiceTimers = new Map(); // "guild:user" -> { joinedAt, channelId }

module.exports = {
  name: 'voiceStateUpdate',
  run(client, oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    if (!oldState.guild || oldState.guild.members?.me?.id === oldState.guild.id) return;

    const key = `${newState.guild.id}:${member.id}`;
    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;

    // Left a channel entirely.
    if (oldChannel && !newChannel) {
      handleLeave(key, newState, member, oldChannel);
      return;
    }

    // Joined a channel.
    if (!oldChannel && newChannel) {
      voiceTimers.set(key, { joinedAt: Date.now(), channelId: newChannel });
      logVoice(newState.guild, member, newState.channel, 'joined');
      return;
    }

    // Moved between channels.
    if (oldChannel && newChannel && oldChannel !== newChannel) {
      handleLeave(key, newState, member, oldChannel);
      voiceTimers.set(key, { joinedAt: Date.now(), channelId: newChannel });
      logVoice(newState.guild, member, newState.channel, 'moved to');
    }
  },
};

function handleLeave(key, state, member, oldChannelId) {
  const timer = voiceTimers.get(key);
  if (timer) {
    const minutes = (Date.now() - timer.joinedAt) / 60000;
    if (minutes >= 1) levelingService.handleVoiceXp(state.guild.id, member.id, Math.floor(minutes));
    voiceTimers.delete(key);
  }
  logVoice(state.guild, member, state.guild.channels.cache.get(oldChannelId), 'left');
}

function logVoice(guild, member, channel, action) {
  logService.sendLog(guild, 'voice', {
    color: Colors.info,
    title: 'Voice Activity',
    description: `${member.user} ${action} ${channel ? channel.toString() : 'unknown channel'}`,
    footer: { text: `ID: ${member.id}` },
  });
}
