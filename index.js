/**
 * Whop webhook receiver + Discord bot entry.
 * No dashboard, no website — just the bot + Whop webhook.
 */
const express = require('express');
const crypto = require('crypto');
const config = require('./config/config');
const logger = require('./services/logger');
const { supabase, init } = require('./database/db');
const premiumService = require('./services/premium');
const { startBot } = require('./bot');

const app = express();
app.disable('x-powered-by');

const WHOP_SECRET = config.whop.webhookSecret;

// Raw body for signature verification
app.post(config.whop.webhookPath, express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
  const body = req.body.toString('utf8');
  const sig = req.headers['whop-signature'] || req.headers['x-whop-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  const expected = crypto.createHmac('sha256', WHOP_SECRET).update(body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    logger.warn('Whop signature mismatch');
    return res.status(400).send('Invalid signature');
  }

  let event;
  try { event = JSON.parse(body); } catch { return res.status(400).send('Bad JSON'); }

  // Idempotency
  const { data: seen } = await supabase.from('webhook_events').select('id').eq('id', event.id).single();
  if (seen) return res.status(200).send('OK');

  try {
    await premiumService.handleWebhookEvent(event);
    await supabase.from('webhook_events').insert({ id: event.id, type: event.type });
  } catch (e) {
    logger.error(`Whop webhook failed: ${e.message}`);
    return res.status(500).send('Processing failed');
  }
  res.status(200).send('OK');
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'aether' }));

app.listen(config.whop.webhookPort, async () => {
  logger.info(`Webhook server listening on :${config.whop.webhookPort} (${config.whop.webhookPath})`);
  await init();
  await startBot();
});