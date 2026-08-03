/**
 * Simple permission helpers.
 */
const PERM_MAP = {
  Administrator: 'Administrator',
  ManageGuild: 'ManageGuild',
  ManageRoles: 'ManageRoles',
  ManageChannels: 'ManageChannels',
  KickMembers: 'KickMembers',
  BanMembers: 'BanMembers',
  ModerateMembers: 'ModerateMembers',
  ManageMessages: 'ManageMessages',
  MentionEveryone: 'MentionEveryone',
  ViewAuditLog: 'ViewAuditLog',
};

function hasPermissions(member, required = []) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  return required.every(p => member.permissions.has(PERM_MAP[p] || p));
}

function isOwner(user, owners) {
  return owners?.includes(user.id) ?? false;
}

module.exports = { hasPermissions, isOwner, PERM_MAP };