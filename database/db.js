/**
 * SQLite database layer built on node:sqlite (DatabaseSync).
 * Single connection (DatabaseSync is synchronous, so this is safe).
 * WAL mode + busy timeout for concurrent readers/writers.
 *
 * Uses Node's built-in SQLite so no native install scripts / prebuilt
 * binaries are required (hosting panels that block npm install scripts
 * install this cleanly).
 */
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config/config');
const logger = require('../services/logger');

const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(config.dbPath, {
  timeout: 5000,
  enableForeignKeyConstraints: true,
});

// WAL mode is faster but not supported on all filesystems (e.g., network mounts).
// Fall back to DELETE journal mode if WAL fails.
try {
  db.exec('PRAGMA journal_mode = WAL');
} catch (e) {
  logger.warn(`WAL mode not supported, falling back to DELETE: ${e.message}`);
  db.exec('PRAGMA journal_mode = DELETE');
}
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA busy_timeout = 5000');

/** Runs fn inside a transaction, rolling back on error. Mirrors DatabaseSync-style transactions. */
function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}

const MIGRATIONS = [
  require('./schema'),
  require('./schema-v2'),
  require('./schema-v3'),
  require('./schema-v4'),
];

/** Applies all migrations in order, tracking applied versions. */
function migrate() {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`
  );

  for (const migration of MIGRATIONS) {
    const applied = db
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .get(migration.version);
    if (applied) continue;

    transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        new Date().toISOString()
      );
    })();

    logger.info(`Database migration ${migration.version} applied (${migration.name})`);
  }
}

module.exports = db;
module.exports.migrate = migrate;
