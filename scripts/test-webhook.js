/**
 * Dev test: exercises the Whop webhook pipeline end-to-end WITHOUT Discord.
 * Starts the webhook server, sends a correctly signed membership.went_valid
 * event, verifies a 200 + DB write, then confirms a tampered payload is
 * rejected (400).
 *
 * Requires a .env with WHOP_API_KEY + WHOP_WEBHOOK_SECRET set.
 *
 * Usage: npm run test:webhook
 */
require('dotenv').config();
const crypto = require('crypto');
const http = require('http');
const config = require('../config/config');
const db = require('../database/db');
const logger = require('../services/logger');
const webhookServer = require('../webhooks/server');

db.migrate();

const SECRET = process.env.WHOP_WEBHOOK_SECRET || 'whsec_testsecret';

function sign(body) {
  const id = 'msg_test_' + Date.now();
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${id}.${timestamp}.${body}`;
  const sig = crypto
    .createHmac('sha256', Buffer.from(SECRET, 'utf8'))
    .update(signedContent)
    .digest('base64');
  return {
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': `v1,${sig}`,
      'content-type': 'application/json',
    },
  };
}

function post(port, path, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  await webhookServer.start();
  const port = config.webhook.port;

  const validEvent = {
    id: 'evt_valid_001',
    type: 'membership.went_valid',
    data: {
      id: 'mem_test_abc123',
      status: 'active',
      activated_at: new Date().toISOString(),
      user: { id: 'user_test_001' },
      plan: { id: 'plan_aether_monthly' },
      product: { title: 'Aether Premium' },
      custom_field_responses: [
        { id: config.whop.customFields.discordUsername, question: 'Discord Username', answer: 'SomeUser#1234' },
        { id: config.whop.customFields.discordServerId, question: 'Discord Server ID', answer: '111111111111111111' },
      ],
    },
  };

  const validBody = JSON.stringify(validEvent);
  const { headers } = sign(validBody);

  // 1) Valid signed event → expect 200
  let res = await post(port, config.webhook.path, validBody, headers);
  console.log(`[1] Valid signed event  -> ${res.status} ${res.body}`);
  if (res.status !== 200) throw new Error('Valid event was not accepted');

  const row = db.prepare('SELECT * FROM premium_memberships WHERE membership_id = ?').get('mem_test_abc123');
  console.log(`[1] DB row             -> ${row ? `status=${row.status} guild=${row.guild_id} user=${row.discord_username}` : 'MISSING'}`);
  if (!row || row.status !== 'active') throw new Error('Membership not recorded as active');

  // 2) Duplicate event (same id) → still 200, no crash
  res = await post(port, config.webhook.path, validBody, headers);
  console.log(`[2] Duplicate event     -> ${res.status} (deduped)`);
  if (res.status !== 200) throw new Error('Duplicate event rejected');

  // 3) Tampered body (bad signature) → expect 400
  const tampered = JSON.stringify({
    ...validEvent,
    data: { ...validEvent.data, id: 'mem_EVIL', status: 'active' },
  });
  res = await post(port, config.webhook.path, tampered, headers);
  console.log(`[3] Tampered event      -> ${res.status} (must reject)`);
  if (res.status !== 400) throw new Error('Tampered event was accepted!');

  // 4) Invalid event (not a premium event) → 200, no processing
  const other = JSON.stringify({ id: 'evt_other_001', type: 'payment.succeeded', data: {} });
  const otherSigned = sign(other);
  res = await post(port, config.webhook.path, other, otherSigned.headers);
  console.log(`[4] Non-premium event   -> ${res.status} (ignored)`);

  console.log('\nAll webhook checks passed.');
  webhookServer.stop();
  process.exit(0);
}

main().catch((err) => {
  logger.error(err.message);
  webhookServer.stop();
  process.exit(1);
});
