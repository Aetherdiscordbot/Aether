/**
 * Permission helpers for command dispatch and moderation checks.
 */
const { PermissionFlagsBits } = require('discord.js');
const config = require('../config/config');

const PERMISSION_FLAGS = PermissionFlagsBits;

/** Resolve a permission string to a bigint (handles "KickMembers", "BanMembers", ...). */
function resolveFlag(name) {
  if (typeof name === 'bigint') return name;
  const key = String(name);
  if (/^[A-Za-z]+$/.test(key)) return PermissionFlagsBits[key];
  return 0n;
}

/** True if the member is a bot owner. */
function isOwner(memberOrUser) {
  if (!memberOrUser) return false;
  return config.owners.includes(memberOrUser.id);
}

/** True if the member is a guild administrator. */
function isAdmin(member) {
  if (!member?.permissions) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator) || isOwner(member);
}

/**
 * Check a member has every required permission.
 * @param {import('discord.js').GuildMember} member
 * @param {string[]|bigint[]} required
 */
function hasPermissions(member, required = []) {
  if (!required.length) return true;
  if (isAdmin(member)) return true;
  if (!member?.permissions) return false;
  return required.every((p) => member.permissions.has(resolveFlag(p)));
}

/**
 * Check the bot has every required permission in the channel.
 * @param {import('discord.js').GuildMember} botMember
 * @param {string[]} required
 */
function botHasPermissions(botMember, required = []) {
  if (!required.length) return true;
  if (!botMember?.permissions) return false;
  return required.every((p) => botMember.permissions.has(resolveFlag(p)));
}

/** Higher-ranked members (moderators/admins) are protected from lower staff. */
function canActOn(member, target, { allowOwner = true } = {}) {
  if (!target) return true;
  if (target.user?.id === member.guild.ownerId) return false;
  if (allowOwner && isOwner(target)) return false;
  if (isAdmin(target) && !isAdmin(member) && !isOwner(member)) return false;
  const memberHighest = member.roles.highest?.position ?? 0;
  const targetHighest = target.roles.highest?.position ?? 0;
  return memberHighest > targetHighest;
}

/** True if the provided string is a known permission name. */
function isValidPermission(name) {
  return Object.prototype.hasOwnProperty.call(PermissionFlagsBits, name);
}

module.exports = {
  PERMISSION_FLAGS,
  resolveFlag,
  isOwner,
  isAdmin,
  hasPermissions,
  botHasPermissions,
  canActOn,
  isValidPermission,
};
