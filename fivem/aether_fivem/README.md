# Aether FiveM Bridge

Connects your FiveM server to the Aether Discord bot: live player list,
Discord account linking, staff tools and chat relay.

## Requirements

- Aether installed in your Discord server (v1.0.0+)
- A FiveM server (any `fx_version cerulean` / latest rec build)

## Install

1. Copy the `aether_fivem` folder into your server's `resources/` directory.
2. Add `ensure aether_fivem` to your `server.cfg`.
3. Edit `config.lua`:
   - `Config.Secret` — the FiveM secret shown on the Aether dashboard
     (Dashboard > your server > FiveM).
   - `Config.GuildId` — your Discord server ID.
   - `Config.Framework` — `qbcore`, `esx` or `none` (needed for money
     commands).
4. Restart the resource (`restart aether_fivem`) and watch for the green
   startup lines in the console.

## In-game commands

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `/verify <code>` | Link your Discord account (code from Discord `/verify`) |

## What the bridge sends

- **Heartbeat + players** — every poll interval (default 5s): player ID,
  name, ping, connected time, license and Discord identifiers. This powers
  the live player list in the dashboard and `/player` commands.
- **Command queue** — commands run from Discord (announce, kick, heal,
  revive, freeze, teleport, goto, bring, spectate, money, vehicle) are
  picked up on the next poll and confirmed back to the bot.

## Troubleshooting

- `Config.Secret is still REPLACE_ME` — edit `config.lua` and restart.
- Nothing shows in the dashboard — make sure the bot is online and
  `Config.BotUrl` is reachable from your server (`curl https://aether.ocrp.cc/health`).
- Money commands fail — set `Config.Framework` to `qbcore` or `esx`.
