#!/usr/bin/env bash
#
# One-time setup for local AI on the hosting (Linux).
# Installs Ollama and downloads the Gemma 3 4B model.
# The bot auto-pulls the model at startup too, but this gets everything ready.
set -euo pipefail

echo "==> Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

echo "==> Ensuring Ollama service is running..."
sudo systemctl enable ollama 2>/dev/null || true
sudo systemctl start ollama 2>/dev/null || true

echo "==> Downloading Gemma 3 4B (this can take a few minutes)..."
ollama pull gemma3:4b

echo "==> Verifying..."
ollama run gemma3:4b "Reply with exactly: Aether AI ready"

echo ""
echo "Done. Ollama is running on http://localhost:11434"
echo "The bot is already configured to use it (AI_BASE_URL default)."
echo "If Ollama is NOT on the same machine as the bot, set AI_BASE_URL in .env,"
echo "e.g. AI_BASE_URL=http://<hosting-ip>:11434/v1"
