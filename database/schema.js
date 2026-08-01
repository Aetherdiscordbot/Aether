/**
 * Schema migration v1: every table used by Aether.
 */
module.exports = {
  version: 1,
  name: 'core-schema',
  up(db) {
    // ── Generic per-guild key/value settings ─────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        guild_id TEXT NOT NULL,
        key       TEXT NOT NULL,
        value     TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (guild_id, key)
      );
    `);

    // ── Moderation ───────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS moderation_cases (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action      TEXT NOT NULL,
        reason      TEXT,
        duration    TEXT,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON moderation_cases (guild_id, user_id);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS warnings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason      TEXT,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guild_id, user_id);
    `);

    // ── Tickets ──────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id          TEXT PRIMARY KEY,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'General',
        status      TEXT NOT NULL DEFAULT 'open',
        claimed_by  TEXT,
        created_at  TEXT NOT NULL,
        closed_at   TEXT,
        transcript  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets (guild_id, status);
    `);

    // ── Applications ─────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id              TEXT PRIMARY KEY,
        guild_id        TEXT NOT NULL,
        title           TEXT NOT NULL,
        description     TEXT,
        questions       TEXT NOT NULL,
        review_channel_id TEXT,
        role_id         TEXT,
        created_at      TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS application_submissions (
        id          TEXT PRIMARY KEY,
        app_id      TEXT NOT NULL,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        answers     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        reviewer_id TEXT,
        review_note TEXT,
        created_at  TEXT NOT NULL,
        reviewed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_submissions_app ON application_submissions (app_id, status);
    `);

    // ── Suggestions ──────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id          TEXT PRIMARY KEY,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        user_id     TEXT NOT NULL,
        content     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reason      TEXT,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_suggestions_guild ON suggestions (guild_id, status);
    `);

    // ── Giveaways ────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id            TEXT PRIMARY KEY,
        guild_id      TEXT NOT NULL,
        channel_id    TEXT NOT NULL,
        message_id    TEXT,
        prize         TEXT NOT NULL,
        winners       INTEGER NOT NULL DEFAULT 1,
        ends_at       TEXT NOT NULL,
        host_id       TEXT NOT NULL,
        role_required TEXT,
        ended         INTEGER NOT NULL DEFAULT 0,
        winners_picked TEXT,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_giveaways_ended ON giveaways (ended, ends_at);
    `);

    // ── Welcome / Verification / Reaction roles ──────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS reaction_roles (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT NOT NULL,
        panel_name  TEXT NOT NULL,
        role_id     TEXT NOT NULL,
        label       TEXT,
        emoji       TEXT,
        style       TEXT NOT NULL DEFAULT 'PRIMARY',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rr_message ON reaction_roles (message_id);
    `);

    // ── Leveling ─────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS xp (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        xp       INTEGER NOT NULL DEFAULT 0,
        level    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_xp_leaderboard ON xp (guild_id, xp DESC);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS level_rewards (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        level    INTEGER NOT NULL,
        role_id  TEXT NOT NULL,
        UNIQUE (guild_id, level)
      );
    `);

    // ── Economy ──────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS economy (
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        balance      INTEGER NOT NULL DEFAULT 0,
        last_daily   TEXT,
        last_work    TEXT,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS shop_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT,
        price       INTEGER NOT NULL,
        role_id     TEXT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        item_id  INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (guild_id, user_id, item_id)
      );
    `);

    // ── Reminders / polls ────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        channel_id  TEXT,
        guild_id    TEXT,
        message     TEXT NOT NULL,
        remind_at   TEXT NOT NULL,
        sent        INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (remind_at, sent);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS polls (
        id          TEXT PRIMARY KEY,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        question    TEXT NOT NULL,
        options     TEXT NOT NULL,
        created_by  TEXT NOT NULL,
        created_at  TEXT NOT NULL
      );
    `);

    // ── Backups ──────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id         TEXT PRIMARY KEY,
        guild_id   TEXT NOT NULL,
        created_by TEXT NOT NULL,
        size       INTEGER NOT NULL DEFAULT 0,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_backups_guild ON backups (guild_id);
    `);

    // ── Security / AutoMod / Staff ────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS staff_members (
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        rank        TEXT NOT NULL DEFAULT 'staff',
        added_by    TEXT NOT NULL,
        notes       TEXT,
        created_at  TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS staff_actions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        action     TEXT NOT NULL,
        reason     TEXT,
        performed_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_staff_actions ON staff_actions (guild_id, user_id);
    `);

    // ── Whop Premium ─────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS premium_servers (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id          TEXT UNIQUE NOT NULL,
        owner_id          TEXT,
        whop_customer_id  TEXT,
        membership_id     TEXT,
        plan              TEXT NOT NULL DEFAULT 'premium',
        status            TEXT NOT NULL DEFAULT 'active',
        whitelisted       INTEGER NOT NULL DEFAULT 0,
        activated_at      TEXT NOT NULL,
        expires_at        TEXT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS premium_memberships (
        membership_id   TEXT PRIMARY KEY,
        discord_user_id TEXT,
        discord_username TEXT,
        guild_id        TEXT,
        whop_customer_id TEXT,
        plan            TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        fulfilled       INTEGER NOT NULL DEFAULT 0,
        data            TEXT,
        activated_at    TEXT,
        expires_at      TEXT,
        updated_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_prem_memberships_guild ON premium_memberships (guild_id);
      CREATE INDEX IF NOT EXISTS idx_prem_memberships_fulfilled ON premium_memberships (status, fulfilled);
    `);

    // ── Webhook dedupe (idempotency) ─────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id           TEXT PRIMARY KEY,
        type         TEXT NOT NULL,
        processed_at TEXT NOT NULL
      );
    `);

    // ── Invite tracking ──────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS invite_cache (
        guild_id    TEXT NOT NULL,
        code        TEXT NOT NULL,
        inviter_id  TEXT,
        uses        INTEGER NOT NULL DEFAULT 0,
        channel_id  TEXT,
        created_at  TEXT,
        PRIMARY KEY (guild_id, code)
      );
    `);
  },
};
