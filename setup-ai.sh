#!/usr/bin/env bash
#
# One-time setup for local AI on the hosting (Linux, container-friendly).
# Installs Ollama (binary to /usr/local/bin, no systemd needed) and
# downloads the Gemma 3 4B model. The bot also auto-starts/pulls at boot,
# but this gets everything ready ahead of time.
set -uo pipefail

echo "==> Installing Ollama..."
OLLAMA_BIN=/home/container/ollama/bin/ollama
if [[ -x $OLLAMA_BIN ]]; then
  echo "    ollama already installed."
else
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) oat="ollama-linux-amd64" ;;
    aarch64|arm64) oat="ollama-linux-arm64" ;;
    *) echo "Unsupported architecture: $arch" ; exit 1 ;;
  esac
  mkdir -p /home/container/ollama
  curl -fsSL "https://ollama.com/download/${oat}.tgz?version=0.13.5" | tar -xzf - -C /home/container/ollama
  echo "    Installed to $OLLAMA_BIN"
fi

echo "==> Ensuring Ollama is running..."
if ! curl -fsS http://localhost:11434/api/version >/dev/null 2>&1; then
  ($OLLAMA_BIN serve >/tmp/ollama.log 2>&1 &)
fi
until curl -fsS http://localhost:11434/api/version >/dev/null 2>&1; do sleep 2; done

echo "==> Downloading Gemma 3 4B (this can take a few minutes)..."
$OLLAMA_BIN pull gemma3:4b

echo "==> Verifying..."
$OLLAMA_BIN run gemma3:4b "Reply with exactly: Aether AI ready"

echo ""
echo "Done. Ollama is running on http://localhost:11434"
echo "The bot is already configured to use it (AI_BASE_URL default)."
echo "If Ollama is NOT on the same machine as the bot, set AI_BASE_URL in .env,"
echo "e.g. AI_BASE_URL=http://<hosting-ip>:11434/v1"
