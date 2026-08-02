#!/bin/bash
# Panel startup: run the Cloudflare Tunnel (if configured) alongside the bot.
# Expects /home/container/cloudflared binary present and CLOUDFLARED_TOKEN set
# to enable the tunnel. Runs from /home/container (the Pterodactyl workdir).

cd /home/container || exit 1

# Auto-download the cloudflared binary on first run (if missing).
CLOUDFLARED_VERSION="2025.5.0"
if [ ! -x ./cloudflared ]; then
  echo "[start-panel] Downloading cloudflared $CLOUDFLARED_VERSION"
  curl -fsSL -o ./cloudflared "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64" \
    && chmod +x ./cloudflared \
    && echo "[start-panel] cloudflared installed"
fi

# Tunnel token: read from env var, else from gitignored file cloudflared.token.
if [ -z "$CLOUDFLARED_TOKEN" ] && [ -f ./cloudflared.token ]; then
  CLOUDFLARED_TOKEN=$(cat ./cloudflared.token)
fi

if [ -x ./cloudflared ] && [ -n "$CLOUDFLARED_TOKEN" ]; then
  echo "[start-panel] Starting Cloudflare Tunnel"
  ./cloudflared tunnel run --token "$CLOUDFLARED_TOKEN" &
  CLOUDFLARED_PID=$!
  trap 'kill $CLOUDFLARED_PID 2>/dev/null' EXIT
else
  echo "[start-panel] Cloudflare Tunnel skipped (missing binary or token)"
fi

exec /usr/local/bin/node /home/container/index.js
