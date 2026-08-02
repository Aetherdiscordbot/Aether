/**
 * Schema migration v2: premium-tier extras.
 * - polls: anonymous / role-only voting / multi-vote / timed auto-close
 * - reminders: recurring (repeat interval)
 * - embed_templates: saved premium embed templates
 */
module.exports = {
  version: 2,
  name: 'premium-tiers',
  up(db) {
    const hasColumn = (table, col) =>
      db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

    if (hasColumn('polls', 'anonymous') === false) {
      db.exec('ALTER TABLE polls ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0');
    }
    if (hasColumn('polls', 'role_required') === false) {
      db.exec('ALTER TABLE polls ADD COLUMN role_required TEXT');
    }
    if (hasColumn('polls', 'multi') === false) {
      db.exec('ALTER TABLE polls ADD COLUMN multi INTEGER NOT NULL DEFAULT 0');
    }
    if (hasColumn('polls', 'ends_at') === false) {
      db.exec('ALTER TABLE polls ADD COLUMN ends_at TEXT');
    }
    if (hasColumn('polls', 'closed') === false) {
      db.exec('ALTER TABLE polls ADD COLUMN closed INTEGER NOT NULL DEFAULT 0');
    }

    if (hasColumn('reminders', 'repeat_interval') === false) {
      db.exec("ALTER TABLE reminders ADD COLUMN repeat_interval TEXT");
    }

    if (hasColumn('giveaways', 'auto_reroll') === false) {
      db.exec('ALTER TABLE giveaways ADD COLUMN auto_reroll INTEGER NOT NULL DEFAULT 0');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS embed_templates (
        id          TEXT PRIMARY KEY,
        guild_id    TEXT NOT NULL,
        name        TEXT NOT NULL,
        data        TEXT NOT NULL,
        created_by  TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        UNIQUE (guild_id, name)
      );
    `);

    // Timed poll closing needs an index on ends_at/closed.
    db.exec('CREATE INDEX IF NOT EXISTS idx_polls_ends ON polls (closed, ends_at)');
  },
};
