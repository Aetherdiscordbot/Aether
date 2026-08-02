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

  // Test page: open the root of the domain in a browser to confirm the host works.
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    sendHtml(res, 200, testPage());
    return;
  }

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

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/** Minimal test page used to verify the host/domain resolves to this server. */
function testPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aether · Host Check</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e1b4b, #0f172a);
      color: #e2e8f0;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 40px 48px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    }
    .logo { font-size: 42px; }
    h1 { margin: 12px 0 6px; color: #fff; }
    p { margin: 6px 0; color: #94a3b8; }
    .ok {
      display: inline-block;
      margin-top: 16px;
      padding: 6px 16px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🪐</div>
    <h1>Aether</h1>
    <p>The host is working and responding.</p>
    <span class="ok">● Server online</span>
  </div>
</body>
</html>`;
}

module.exports = { start, stop, server };
