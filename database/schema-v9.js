/**
 * Schema migration v9: Prefix config.
 */
module.exports = {
  version: 9,
  name: 'prefix-config',
  up: `
    CREATE TABLE IF NOT EXISTS prefix_config (
      guild_id      TEXT PRIMARY KEY,
      prefix        TEXT NOT NULL DEFAULT '?'
    );
  `
};