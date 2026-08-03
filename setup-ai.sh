#!/usr/bin/env bash
#
# One-time setup for local AI on the hosting (Linux, container-friendly).
# Installs Ollama (binary to /usr/local/bin, no systemd needed) and
# downloads the Gemma 3 4B model. The bot also auto-starts/pulls at boot,
# but this gets everything ready ahead of time.
set -uo pipefail

echo "==> Installing Ollama..."
if command -v ollama >/dev/null 2>&1; then
  echo "    ollama already installed."
else
  command -v zstd >/dev/null 2>&1 || (apt-get update >/dev/null 2>&1 && apt-get install -y zstd >/dev/null 2>&1)
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) oat="ollama-linux-amd64" ;;
    aarch64|arm64) oat="ollama-linux-arm64" ;;
    *) echo "Unsupported architecture: $arch" ; exit 1 ;;
  esac
  curl -fsSL "https://ollama.com/download/${oat}.tar.zst" | zstd -d | tar -xf - -C /usr/local
  echo "    Installed to /usr/local/bin/ollama"
fi

echo "==> Ensuring Ollama is running..."
if ! curl -fsS http://localhost:11434/api/version >/dev/null 2>&1; then
  (ollama serve >/tmp/ollama.log 2>&1 &)
fi
until curl -fsS http://localhost:11434/api/version >/dev/null 2>&1; do sleep 2; done

echo "==> Downloading Gemma 3 4B (this can take a few minutes)..."
ollama pull gemma3:4b

echo "==> Verifying..."
ollama run gemma3:4b "Reply with exactly: Aether AI ready"

echo ""
echo "Done. Ollama is running on http://localhost:11434"
echo "The bot is already configured to use it (AI_BASE_URL default)."
echo "If Ollama is NOT on the same machine as the bot, set AI_BASE_URL in .env,"
echo "e.g. AI_BASE_URL=http://<hosting-ip>:11434/v1"
