/**
 * Dashboard smoke test: verifies the server list renders all user guilds
 * with manage/invite status, via a real HTTP request + seeded session.
 */
process.env.OAUTH_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_REDIRECT_URI = 'https://aether.ocrp.cc/auth/callback';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.DISCORD_TOKEN = 'x';
process.env.CLIENT_ID = '123';

const http = require('http');
const express = require('express');
const session = require('express-session');
const { buildRouter } = require('../web/routes');

const MANAGE_GUILD = 1n << 5n;

// Standalone app with an injectable in-memory store we can seed.
const store = new session.MemoryStore();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware matching routes.js so the router's session reads our seed.
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  })
);

const getClient = () => ({ guilds: { cache: new Map([['111', 'g1'], ['333', 'g3']]) } });
app.use(buildRouter(getClient));

function seedSession(user) {
  const sid = 'seeded-session-id';
  return new Promise((resolve) => {
    store.set(sid, { user, cookie: { httpOnly: true, sameSite: 'lax' } }, () => resolve(sid));
  });
}

function request(path) {
  return new Promise((resolve) => {
    http
      .get({ hostname: '127.0.0.1', port: 8081, path }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', (err) => resolve({ status: 0, body: err.message }));
  });
}

(async () => {
  const server = app.listen(8081);

  const sid = await seedSession({
    id: '1',
    username: 'tester',
    avatarUrl: null,
    guilds: [
      { id: '111', name: 'Manageable Premium', icon: null, permissions: String(MANAGE_GUILD) },
      { id: '222', name: 'Manageable No Bot', icon: null, permissions: String(MANAGE_GUILD) },
      { id: '333', name: 'No Perms With Bot', icon: null, permissions: '0' },
      { id: '444', name: 'No Perms No Bot', icon: null, permissions: '0' },
    ],
  });

  // Seed premium for guild 111 so the gold ring renders, then clean up.
  const db = require('../database/db');
  db.migrate();
  const seeded = Date.now();
  db.prepare(
    `INSERT INTO premium_servers (guild_id, plan, status, activated_at) VALUES (?, 'premium', 'active', ?)`
  ).run('111', new Date(seeded).toISOString());

  // Manual request with the session cookie (signed by cookie-signature via express-session).
  const cookie = require('cookie-signature');
  const signed = cookie.sign(sid, process.env.SESSION_SECRET);
  const cookieHeader = `connect.sid=s:${signed}`;

  const res = await new Promise((resolve) => {
    http
      .get({ hostname: '127.0.0.1', port: 8081, path: '/dashboard', headers: { Cookie: cookieHeader } }, (r) => {
        let body = '';
        r.on('data', (c) => (body += c));
        r.on('end', () => resolve({ status: r.statusCode, body }));
      })
      .on('error', (err) => resolve({ status: 0, body: err.message }));
  });

  const checks = {
    'Status 200': res.status === 200,
    'Manageable 111 clickable': res.body.includes('/dashboard/111'),
    'Invite mini-button for 222 (bot not in)': res.body.includes('invite-mini'),
    'Lock badge for non-manageable 333/444': (res.body.match(/server-badge lock/g) || []).length === 2,
    'Premium ring on 111': res.body.includes('server-avatar premium'),
    'Bot checkmark on 111 (manageable)': (res.body.match(/server-badge ok/g) || []).length === 1,
    'Both sections rendered': res.body.includes('You can manage') && res.body.includes('Other servers'),
    'No empty-state text': !res.body.includes('No servers found'),
  };
  console.log(checks);
  const allOk = Object.values(checks).every(Boolean);
  console.log(allOk ? 'DASHBOARD CHECKS PASSED' : 'DASHBOARD CHECKS FAILED');

  // Clean up the seeded premium row.
  db.prepare('DELETE FROM premium_servers WHERE guild_id = ?').run('111');

  server.close();
  process.exit(allOk ? 0 : 1);
})();
