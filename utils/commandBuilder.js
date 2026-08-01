/**
 * Compact builders for slash-command option definitions.
 * `type` accepts discord.js ApplicationCommandOptionType values (numbers or names).
 */
const { ApplicationCommandOptionType } = require('discord.js');

const T = ApplicationCommandOptionType;

/** Sub-command definition. */
function sub(name, description, options = []) {
  return { type: T.Subcommand, name, description, options };
}

/** Sub-command group definition. */
function subGroup(name, description, options = []) {
  return { type: T.SubcommandGroup, name, description, options };
}

/** Generic option builder. */
function opt(type, name, description, extra = {}) {
  const resolved = typeof type === 'string' ? T[type] ?? type : type;
  return { type: resolved, name, description, ...extra };
}

const str = (name, description, extra = {}) => opt(T.String, name, description, extra);
const int = (name, description, extra = {}) => opt(T.Integer, name, description, extra);
const num = (name, description, extra = {}) => opt(T.Number, name, description, extra);
const bool = (name, description, extra = {}) => opt(T.Boolean, name, description, extra);
const user = (name, description, extra = {}) => opt(T.User, name, description, extra);
const channel = (name, description, extra = {}) => opt(T.Channel, name, description, extra);
const role = (name, description, extra = {}) => opt(T.Role, name, description, extra);
const mention = (name, description, extra = {}) => opt(T.Mentionable, name, description, extra);
const attachment = (name, description, extra = {}) => opt(T.Attachment, name, description, extra);

/** Common required flag. */
const req = (extra = {}) => ({ required: true, ...extra });

module.exports = { T, sub, subGroup, opt, str, int, num, bool, user, channel, role, mention, attachment, req };
