/**
 * HTTP server: Whop webhook receiver + the Aether website/dashboard.
 *
 * A single Express app on config.webhook.port serves:
 *   POST /webhooks/whop  — Whop Standard Webhooks (signature-verified)
 *   GET  /health         — uptime monitor
 *   GET  /               — landing page
 *   GET  /dashboard*     — Discord OAuth dashboard
 *
 * The dashboard needs the Discord client, which is injected after the bot
 * logs in via setClient(). Until then dashboard pages render but show no live
 * guild data (the bot isn't connected yet).
 */
const express = require('express');
const session = require('express-session');
const config = require('../config/config');
const logger = require('../services/logger');
const db = require('../database/db');
const whop = require('../services/whop');
const premiumService = require('../services/premium');
const { buildRouter } = require('../web/routes');

const MAX_BODY = 1 * 1024 * 1024; // 1MB safety cap

let app = null;
let server = null;
let discordClient = null;
const sessionStore = new session.MemoryStore();

function setClient(client) {
  discordClient = client;
}

function getClient() {
  return discordClient;
}

function createApp() {
  app = express();
  app.disable('x-powered-by');

  // Health/status endpoint for uptime monitors.
  app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'aether' });
  });

  // Raw-body webhook route (must be registered before express.json so the
  // signature verification sees the exact bytes).
  app.post(config.webhook.path, express.raw({ type: () => true, limit: MAX_BODY }), async (req, res) => {
    const body = req.body.toString('utf8');
    if (!body) {
      res.status(400).send('Bad Request');
      return;
    }

    let event;
    try {
      event = whop.verifyWebhook(body, req.headers);
    } catch (err) {
      logger.warn(`Webhook signature verification failed: ${err.message}`);
      res.status(400).send('Invalid Signature');
      return;
    }

    // Idempotency: never process the same event twice.
    const seen = db.prepare('SELECT id FROM webhook_events WHERE id = ?').get(event.id || '');
    if (!seen) {
      try {
        premiumService.handleWebhookEvent(event);
        db.prepare('INSERT INTO webhook_events (id, type, processed_at) VALUES (?, ?, ?)').run(
          event.id || 'unknown',
          event.type || 'unknown',
          new Date().toISOString()
        );
      } catch (err) {
        logger.error(`Failed to process webhook ${event.id}: ${err.message}`);
        res.status(500).send('Processing Failed');
        return;
      }
    } else {
      logger.debug(`Duplicate webhook ignored: ${event.id}`);
    }

    res.status(200).send('OK');
  });

  // Website + dashboard (session + JSON/urlencoded body parsers must come
  // before the router so dashboard POST forms are parsed).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(buildRouter(getClient, { sessionStore }));

  // 404 for everything else.
  app.use((req, res) => {
    res.status(404).send('Not Found');
  });

  // Global error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error(`Web error: ${err.stack || err.message}`);
    if (res.headersSent) return;
    res.status(500).send('Internal Server Error');
  });

  return app;
}

/** Start listening. Safe to call once. */
function start() {
  if (server) return server;
  if (!app) app = createApp();
  return new Promise((resolve, reject) => {
    server = app.listen(config.webhook.port, () => {
      logger.info(`Web server listening on :${config.webhook.port} (webhook ${config.webhook.path} + dashboard)`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

function stop() {
  if (server) server.close();
}

module.exports = { start, stop, server: () => server, setClient, getClient, createApp };
