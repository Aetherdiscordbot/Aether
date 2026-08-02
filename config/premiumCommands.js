/**
 * Premium command registry — the single source of truth for which commands
 * (or subcommands) require Aether Premium.
 *
 * `commands`    → whole commands that require Premium (every subcommand).
 * `subcommands` → premium subcommands inside otherwise-free commands.
 *
 * The command handler, /help and /premium info all read this registry, so
 * adding a premium feature is a one-line change here.
 */
module.exports = {
  commands: [
    'ticket',
    'applications',
    'security',
    'automod',
    'logging',
    'backup',
    'ai',
  ],
  subcommands: {
    economy: ['setup', 'shop-add', 'shop-remove', 'config'],
    leveling: ['setup', 'reward', 'reward-remove', 'config'],
    suggestions: ['setup', 'approve', 'deny', 'delete'],
    verify: ['setup', 'panel', 'disable'],
    welcome: ['setup', 'disable', 'autorole', 'leave', 'test'],
    react: ['create', 'remove', 'list'],
    role: ['mass'],
    nick: ['mass'],
    embed: ['template-save', 'template-use', 'template-list', 'template-delete'],
  },
};

/** True if a command (or one of its subcommands) is premium. */
function isPremium(commandName, subcommand = null) {
  if (module.exports.commands.includes(commandName)) return true;
  if (!subcommand) return false;
  const premiumSubs = module.exports.subcommands[commandName];
  return Array.isArray(premiumSubs) && premiumSubs.includes(subcommand);
}

/** Human-readable summary: list of premium commands + their premium subcommands. */
function describe() {
  const lines = module.exports.commands.map((name) => `\`/${name}\``);
  const linesSub = Object.entries(module.exports.subcommands)
    .filter(([, subs]) => subs && subs.length)
    .map(([name, subs]) => `\`/${name}\` → ${subs.map((s) => `\`${s}\``).join(', ')}`);
  return { commands: lines, subcommands: linesSub };
}

module.exports.isPremium = isPremium;
module.exports.describe = describe;
