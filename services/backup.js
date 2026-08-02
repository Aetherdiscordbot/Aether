/**
 * Database backup service: daily VACUUM INTO snapshots + retention.
 *
 * node:sqlite supports `VACUUM INTO '<path>'` which produces a consistent
 * copy of the database without locking out writers. Backups land in
 * data/backups/ and the N most recent are kept.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('./logger');

const BACKUP_DIR = path.join(path.dirname(config.dbPath), 'backups');
const RETENTION = parseInt(process.env.BACKUP_RETENTION || '7', 10);
const MAX_AGE_MS = RETENTION * 24 * 60 * 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** Create a consistent snapshot of the database. Returns the backup path. */
function createBackup() {
  const db = require('../database/db');
  ensureDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `aether-${stamp}.db`);
  try {
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    logger.info(`Database backup created: ${file}`);
    prune();
    return file;
  } catch (err) {
    logger.error(`Database backup failed: ${err.message}`);
    return null;
  }
}

/** Remove backups older than the retention window. */
function prune() {
  let files = [];
  try {
    files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db'));
  } catch {
    return;
  }
  const now = Date.now();
  for (const f of files) {
    const full = path.join(BACKUP_DIR, f);
    try {
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(full);
        logger.debug(`Pruned old backup: ${full}`);
      }
    } catch {
      /* ignore */
    }
  }
}

/** List existing backups with size + age. */
function listBackups() {
  ensureDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(full);
      return { file: f, size: stat.size, modified: stat.mtime };
    })
    .sort((a, b) => b.modified - a.modified);
}

module.exports = { createBackup, listBackups, prune, BACKUP_DIR };
