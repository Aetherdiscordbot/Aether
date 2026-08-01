/**
 * Whop webhook receiver.
 *
 * Accepts POST /webhooks/whop, verifies the Standard Webhooks signature via
 * the Whop SDK (throws on tampering), dedupes events by ID, then hands them
 * to the premium fulfillment service. Responds 2xx fast so Whop doesn't retry.
 */
const http = require('http');
const config = require('../config/config');
const logger = require('../services/logger');
const db = require('../database/db');
const whop = require('../services/whop');
const premiumService = require('../services/premium');

const MAX_BODY = 1 * 1024 * 1024; // 1MB safety cap

let server = null;

function createServer() {
  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error(`Webhook handler error: ${err.message}`);
      send(res, 500, 'Internal Server Error');
    });
  });

  return server;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health/status endpoint for uptime monitors.
  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, JSON.stringify({ ok: true, service: 'aether-webhooks' }));
    return;
  }

  if (req.method !== 'POST' || url.pathname !== config.webhook.path) {
    send(res, 404, 'Not Found');
    return;
  }

  const body = await readBody(req);
  if (!body) {
    send(res, 400, 'Bad Request');
    return;
  }

  let event;
  try {
    event = whop.verifyWebhook(body, req.headers);
  } catch (err) {
    logger.warn(`Webhook signature verification failed: ${err.message}`);
    send(res, 400, 'Invalid Signature');
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
      send(res, 500, 'Processing Failed');
      return;
    }
  } else {
    logger.debug(`Duplicate webhook ignored: ${event.id}`);
  }

  send(res, 200, 'OK');
}

/** Start listening. Safe to call once. */
function start() {
  if (server) return server;
  const srv = createServer();
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(config.webhook.port, () => {
      logger.info(
        `Webhook server listening on :${config.webhook.port}${config.webhook.path}`
      );
      resolve(srv);
    });
  });
}

function stop() {
  if (server) server.close();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(text);
}

module.exports = { start, stop, server };
