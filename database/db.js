/**
 * SQLite database layer built on better-sqlite3.
 * Single connection (better-sqlite3 is synchronous, so this is safe).
 * WAL mode + busy timeout for concurrent readers/writers.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config/config');
const logger = require('../services/logger');

const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

const MIGRATIONS = [
  require('./schema'),
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

    db.transaction(() => {
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
