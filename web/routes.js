/**
 * Website + dashboard routes (Express).
 *
 * Auth: Discord OAuth2 (services/auth.js), session-backed. The webhook
 * receiver in webhooks/server.js stays untouched on its own path.
 */
const express = require('express');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../services/logger');
const authService = require('../services/auth');
const settings = require('../services/settings');
const premiumService = require('../services/premium');
const db = require('../database/db');
const pages = require('./pages');
const modules = require('./modules');
const { layout, alert } = require('./views');

/** Build the router. `getClient` returns the Discord client once logged in. */
function buildRouter(getClient, opts = {}) {
  const router = express.Router();

  // ── Session middleware ─────────────────────────────────────────────────
  const session = require('express-session');
  router.use(
    session({
      secret: config.web.sessionSecret || crypto.randomBytes(32).toString('hex'),
      store: opts.sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
    })
  );

  // ── Helpers ────────────────────────────────────────────────────────────
  function requireAuth(req, res, next) {
    if (req.session?.user) return next();
    return res.redirect('/login');
  }

  function requireOwner(req, res, next) {
    const u = req.session?.user;
    if (u && config.owners.includes(u.id)) return next();
    return res.status(403).send(layout({ title: 'Forbidden', user: currentUser(req), content: alert('error', 'You are not the bot owner.') }));
  }

  function currentUser(req) {
    const u = req.session?.user;
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl || `https://cdn.discordapp.com/embed/avatars/0.png`,
      guilds: u.guilds || [],
      isOwner: config.owners.includes(u.id),
    };
  }

  function guildIcon(guild) {
    if (!guild?.icon) return null;
    const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
  }

  /** Merge nested config objects (dotted keys like "antiRaid.enabled"). */
  function deepMerge(base, extra) {
    for (const [key, value] of Object.entries(extra || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        deepMerge(base[key], value);
      } else {
        base[key] = value;
      }
    }
    return base;
  }

  /** Every guild the user is in, with manage/bot/premium status. */
  async function allGuilds(user) {
    const client = getClient();
    const guilds = user.guilds || [];
    return guilds.map((g) => {
      const botIn = Boolean(client && client.guilds.cache.has(g.id));
      return {
        ...g,
        botIn,
        manage: authService.canManageGuild(g),
        inviteUrl: `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=${config.web.invitePermissions}&scope=bot%20applications.commands&guild_id=${g.id}`,
        iconUrl: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}?size=128`
          : null,
        premium: premiumService.isPremium(g.id),
      };
    });
  }

  /** Only guilds the user can manage (used for premium transfer targets). */
  async function manageableGuilds(user) {
    const all = await allGuilds(user);
    return all.filter((g) => g.manage);
  }

  // ── Public: landing ────────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const cmdCount = require('../handlers/commandHandler').commands.size;
    const moduleCount = modules.MODULES.length;
    res.send(
      layout({
        title: 'Home',
        user: currentUser(req),
        content: `
        <div class="hero">
          <div class="chip">🪐 All-in-one Discord bot</div>
          <h1>One bot to run your<br><span class="grad">entire server</span></h1>
          <p>Leveling, economy, tickets, automod, giveaways, verification and more — with a premium plan that covers every module on one server.</p>
          <div class="cta">
            <a class="btn" href="/invite">Add to Discord</a>
            <a class="btn secondary" href="/dashboard">Open dashboard</a>
          </div>
          <div class="stats">
            <div class="stat"><span class="value">${moduleCount}</span><span class="label">Modules</span></div>
            <div class="stat"><span class="value">${cmdCount}+</span><span class="label">Commands</span></div>
            <div class="stat"><span class="value">100%</span><span class="label">Free to start</span></div>
          </div>
        </div>
        <div class="section-title">Everything your server needs</div>
        <p class="section-sub">Fully configurable from the dashboard — no coding required.</p>
        <div class="grid">
          ${features}
        </div>
        <div class="hero" style="padding-top:40px">
          <h2 style="margin-bottom:10px">Ready to level up?</h2>
          <p style="max-width:480px">Invite Aether to your server and open the dashboard. Free modules work instantly — upgrade any time.</p>
          <div class="cta">
            <a class="btn" href="/invite">Invite Aether</a>
            <a class="btn secondary" href="/premium">See Premium</a>
          </div>
        </div>`,
      })
    );
  });

  // ── Public: invite redirect ────────────────────────────────────────────
  router.get('/invite', (req, res) => {
    res.redirect(
      `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=${config.web.invitePermissions}&scope=bot%20applications.commands`
    );
  });

  // ── Public: premium info ───────────────────────────────────────────────
  router.get('/premium', (req, res) => {
    const prem = require('../config/premiumCommands');
    const premiumCmds = prem.commands.map((c) => `/${c}`);
    const premiumSubs = Object.entries(prem.subcommands)
      .filter(([, subs]) => subs && subs.length)
      .map(([name, subs]) => `/${name} — ${subs.join(', ')}`);
    res.send(
      layout({
        title: 'Premium',
        user: currentUser(req),
        content: `
        <div class="hero">
          <div class="chip">✦ Premium</div>
          <h1>Unlock the <span class="grad">full toolkit</span></h1>
          <p>One subscription covers every module on one server. Transferable to any server you own.</p>
        </div>
        <div class="pricing">
          <div class="chip" style="margin-bottom:4px">Aether Premium</div>
          <div class="price">$${(config.whop.price || '5.99')}</div>
          <div class="per">per month · one server</div>
          <ul>
            <li><span class="tick">✓</span> All premium modules on <b>one server</b></li>
            <li><span class="tick">✓</span> Transfer to another server anytime</li>
            <li><span class="tick">✓</span> Automatic activation via Whop</li>
            <li><span class="tick">✓</span> Cancel anytime, keep servers until expiry</li>
          </ul>
          ${config.whop.checkoutUrl && config.whop.checkoutUrl !== 'https://whop.com' ? `<a class="btn" href="${config.whop.checkoutUrl}" target="_blank">Get Premium</a>` : '<p class="muted">Checkout link not configured.</p>'}
        </div>
        <div class="section-title">Premium includes</div>
        <p class="section-sub">${esc(premiumCmds.join(' · '))}</p>
        <div class="grid">
          <div class="feature"><div class="icon">✨</div><h4>Premium servers</h4><p>Tickets, applications, security, automod, logging, backup, embed, giveaways and more — full config from the dashboard.</p></div>
          <div class="feature"><div class="icon">⚙️</div><h4>Premium setup</h4><p>${esc(premiumSubs.join('. ') || '')}</p></div>
          <div class="feature"><div class="icon">🔗</div><h4>Transferable</h4><p>Move your premium to another server you own — right from the dashboard.</p></div>
        </div>`,
      })
    );
  });

  // ── Public: commands list ──────────────────────────────────────────────
  router.get('/commands', (req, res) => {
    const commandHandler = require('../handlers/commandHandler');
    const prem = require('../config/premiumCommands');
    const all = [...commandHandler.commands.values()]
      .map((c) => ({ name: c.name, premium: prem.isPremium(c.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const free = all.filter((c) => !c.premium);
    const paid = all.filter((c) => c.premium);
    const pill = (c) => `<span class="pill${c.premium ? ' premium' : ''}">/${esc(c.name)}${c.premium ? ' ✦' : ''}</span>`;
    res.send(
      layout({
        title: 'Commands',
        user: currentUser(req),
        content: `
        <div class="hero" style="padding:48px 0 30px">
          <div class="chip">Slash commands</div>
          <h1>Command <span class="grad">library</span></h1>
          <p>Everything Aether can do — free and premium.</p>
        </div>
        <div class="card">
          <h3>✦ Premium commands</h3>
          <p class="muted">Require Aether Premium on the server.</p>
          <div class="tag-row">${paid.map(pill).join('')}</div>
        </div>
        <div class="card">
          <h3>Free commands</h3>
          <p class="muted">Available to every server.</p>
          <div class="tag-row">${free.map(pill).join('')}</div>
        </div>
        <p class="muted center">Use /help in your server for details on any command.</p>`,
      })
    );
  });

  // ── Public: server XP leaderboard ──────────────────────────────────────
  const lbCache = new Map();
  const defaultAvatar = (userId) => `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> 22n) % 6}.png`;

  async function cachedMembers(guild) {
    const hit = lbCache.get(guild.id);
    if (hit && Date.now() - hit.ts < 60_000) return hit.members;
    const members = await guild.members.fetch({ cache: false }).catch(() => new Map());
    const map = new Map([...members.values()].map((m) => [m.id, m]));
    lbCache.set(guild.id, { ts: Date.now(), members: map });
    return map;
  }

  router.get('/server/:guildId/leaderboard', async (req, res) => {
    const guildId = String(req.params.guildId || '');
    if (!/^\d{10,20}$/.test(guildId)) {
      return res.status(404).send(layout({ title: 'Not found', user: currentUser(req), content: alert('error', 'Unknown server.') }));
    }

    const leveling = require('../modules/leveling/levelingService');
    const rows = db.prepare('SELECT user_id, xp, level FROM xp WHERE guild_id = ?').all(guildId);
    const ranked = rows
      .map((r) => ({ ...r, total: leveling.totalXp(guildId, r.user_id) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 25);

    const client = getClient();
    const discordGuild = client?.guilds.cache.get(guildId);
    const members = discordGuild ? await cachedMembers(discordGuild) : new Map();

    const rowsHtml = ranked
      .map((r, i) => {
        const member = members.get(r.user_id);
        const name = member ? (member.nickname || member.user.username) : `User ${r.user_id.slice(-4)}`;
        const avatar = member
          ? member.user.displayAvatarURL({ size: 64 })
          : defaultAvatar(r.user_id);
        const medal = ['🥇', '🥈', '🥉'][i];
        const needed = leveling.xpForLevel(r.level);
        const percent = Math.min(100, Math.max(1, Math.round((r.xp / needed) * 100)));
        return `<div class="lb-row${medal ? ' top' + (i + 1) : ''}">
          <div class="lb-rank">${medal || i + 1}</div>
          <img class="lb-avatar" src="${esc(avatar)}" alt="">
          <div class="lb-main">
            <div class="lb-name">${esc(name)} <span class="lb-lvl">Lv ${r.level}</span></div>
            <div class="lb-bar"><div class="lb-fill" style="width:${percent}%"></div></div>
            <div class="lb-xp">${r.xp.toLocaleString()} / ${needed.toLocaleString()} XP · ${percent}% to level ${r.level + 1}</div>
          </div>
          <div class="lb-total">${r.total.toLocaleString()} XP</div>
        </div>`;
      })
      .join('');

    const guildName = discordGuild ? discordGuild.name : `Server ${guildId}`;
    const icon = discordGuild?.icon
      ? `<img class="lb-icon" src="https://cdn.discordapp.com/icons/${guildId}/${discordGuild.icon}.${discordGuild.icon.startsWith('a_') ? 'gif' : 'png'}?size=128" alt="">`
      : `<span class="lb-icon" style="display:grid;place-items:center;font-size:28px">🪐</span>`;

    const body = ranked.length
      ? `
      <div class="hero" style="padding:48px 0 30px">
        ${icon}
        <h1>${esc(guildName)} <span class="grad">Leaderboard</span></h1>
        <p>Top 25 by total XP — progress bars show how close members are to the next level.</p>
      </div>
      <div class="lb-card">${rowsHtml}</div>
      <p class="muted center" style="margin-top:26px">Want your server here? <a href="/invite">Invite Aether</a> and members earn XP by chatting.</p>`
      : `
      <div class="hero" style="padding:48px 0 30px">
        ${icon}
        <h1>${esc(guildName)} <span class="grad">Leaderboard</span></h1>
        <p>No XP data yet for this server.</p>
      </div>
      <div class="card" style="max-width:520px;margin:0 auto;text-align:center">
        <p class="muted">Aether hasn't recorded any XP here yet — invite the bot and enable the leveling module to get started.</p>
        <a class="btn" href="/invite">Invite Aether</a>
      </div>`;

    res.send(layout({ title: `${guildName} · Leaderboard`, user: currentUser(req), content: body }));
  });

  // ── Public: ticket transcript viewer ───────────────────────────────────
  router.get('/transcript/:guildId/:ticketId', async (req, res) => {
    const { guildId, ticketId } = req.params;
    if (!/^\d{10,20}$/.test(guildId) || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
      return res.status(404).send(layout({ title: 'Not found', user: currentUser(req), content: alert('error', 'Transcript not found.') }));
    }
    const ticketService = require('../modules/tickets/ticketService');
    const ticket = ticketService.getTranscript(ticketId);
    if (!ticket || ticket.guild_id !== guildId) {
      return res.status(404).send(layout({ title: 'Not found', user: currentUser(req), content: alert('error', 'Transcript not found.') }));
    }
    const client = getClient();
    const discordGuild = client?.guilds.cache.get(guildId);
    res.send(
      pages.transcriptPage({
        guild: { name: discordGuild ? discordGuild.name : `Server ${guildId}` },
        ticket,
      })
    );
  });

  // ── OAuth: login/callback/logout ───────────────────────────────────────
  router.get('/login', (req, res) => {
    if (!authService.isConfigured()) {
      return res
        .status(503)
        .send(layout({ title: 'Login unavailable', user: null, content: alert('error', 'OAuth is not configured (missing OAUTH_CLIENT_SECRET / OAUTH_REDIRECT_URI).') }));
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    res.redirect(authService.buildAuthorizeUrl(state));
  });

  router.get('/auth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      return res.send(layout({ title: 'Login failed', user: null, content: alert('error', `Discord auth error: ${error}`) }));
    }
    if (!state || state !== req.session.oauthState) {
      return res.status(400).send(layout({ title: 'Login failed', user: null, content: alert('error', 'Invalid OAuth state. Try logging in again.') }));
    }
    if (!code) {
      return res.status(400).send(layout({ title: 'Login failed', user: null, content: alert('error', 'Missing authorization code.') }));
    }
    try {
      const tokens = await authService.exchangeCode(code);
      const [user, guilds] = await Promise.all([
        authService.fetchUser(tokens.access_token),
        authService.fetchGuilds(tokens.access_token),
      ]);
      req.session.user = {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
          : null,
        guilds: Array.isArray(guilds) ? guilds : [],
      };
      req.session.oauthState = null;
      logger.info(`Dashboard login: ${user.username} (${user.id})`);
      res.redirect('/dashboard');
    } catch (err) {
      logger.error(`OAuth callback failed: ${err.message}`);
      res.status(502).send(layout({ title: 'Login failed', user: null, content: alert('error', 'Could not complete login with Discord. Please try again.') }));
    }
  });

  router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  // ── Dashboard ──────────────────────────────────────────────────────────
  router.get('/dashboard', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const guilds = await allGuilds(user);
    res.send(pages.serverList({ user, guilds }));
  });

  // ── Premium: Multi-Server overview (all manageable servers) ────────────
  router.get('/dashboard/multi', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const guilds = await manageableGuilds(user);
    if (!guilds.some((g) => premiumService.isPremium(g.id))) {
      return res.status(403).send(layout({ title: 'Premium required', user, content: alert('error', 'This view requires Aether Premium on at least one of your servers.') }));
    }
    const client = getClient();
    const withStats = guilds.map((g) => ({
      ...g,
      modulesEnabled: modules.MODULES.filter((m) => settings.getSetting(g.id, m.key)?.enabled ?? m.defaultEnabled === true).length,
      iconUrl: g.iconUrl,
      premium: premiumService.isPremium(g.id),
      _clientGuild: client?.guilds.cache.get(g.id),
    }));
    res.send(pages.multiServerPage({ user, guilds: withStats, isPremium: true }));
  });

  // ── Premium: Analytics / AI / Automation / Multi-Server tabs ──────────
  function requireGuildPremium(req, res, next) {
    const user = currentUser(req);
    const guild = user?.guilds?.find((g) => g.id === req.params.guildId);
    if (!guild || !authService.canManageGuild(guild)) {
      return res.status(403).send(layout({ title: 'Forbidden', user, content: alert('error', 'You cannot manage that server.') }));
    }
    if (!premiumService.isPremium(guild.id)) {
      return res.status(403).send(layout({ title: 'Premium required', user, content: alert('error', 'This tab requires Aether Premium on this server.') }));
    }
    req.guild = guild;
    req.user = user;
    next();
  }

  router.get('/dashboard/:guildId/analytics', requireAuth, requireGuildPremium, (req, res) => {
    const analyticsService = require('../services/analytics');
    const guildId = req.params.guildId;
    const series = analyticsService.activitySeries(guildId, 14);
    const events = analyticsService.memberEvents(guildId, 25);
    const totals = analyticsService.totals(guildId, 30);
    res.send(pages.analyticsPage({ user: req.user, guild: { ...req.guild, iconUrl: guildIcon(req.guild) }, series, events, totals, isPremium: true }));
  });

  router.get('/dashboard/:guildId/ai', requireAuth, requireGuildPremium, (req, res) => {
    const analyticsService = require('../services/analytics');
    const guildId = req.params.guildId;
    const usage = analyticsService.aiTotals(guildId);
    const row = db.prepare('SELECT value FROM automation_config WHERE guild_id = ? AND key = ?').get(guildId, 'ai_enabled');
    const enabled = row ? JSON.parse(row.value) !== false : true;
    res.send(
      pages.aiCenterPage({
        user: req.user,
        guild: { ...req.guild, iconUrl: guildIcon(req.guild) },
        usage,
        enabled,
        chatModel: config.ai.chatModel,
        imageModel: config.ai.imageModel,
        isPremium: true,
      })
    );
  });

  router.post('/dashboard/:guildId/ai', requireAuth, requireGuildPremium, (req, res) => {
    const guildId = req.params.guildId;
    const enable = req.body?.action === 'enable';
    db.prepare(
      `INSERT INTO automation_config (guild_id, key, value) VALUES (?, 'ai_enabled', ?)
       ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value`
    ).run(guildId, JSON.stringify(enable));
    logger.info(`Dashboard: ${req.user.username} set ai_enabled=${enable} for ${guildId}`);
    res.redirect(`/dashboard/${guildId}/ai?${enable ? 'enabled=1' : 'disabled=1'}`);
  });

  router.get('/dashboard/:guildId/automation', requireAuth, requireGuildPremium, (req, res) => {
    const scheduledTasks = require('../services/scheduledTasks');
    const client = getClient();
    const discordGuild = client?.guilds.cache.get(req.params.guildId);
    const channels = discordGuild
      ? [...discordGuild.channels.cache.values()]
          .filter((c) => c.isTextBased())
          .map((c) => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
    res.send(
      pages.automationPage({
        user: req.user,
        guild: { ...req.guild, iconUrl: guildIcon(req.guild) },
        tasks: scheduledTasks.pending(req.params.guildId),
        channels,
        isPremium: true,
      })
    );
  });

  router.post('/dashboard/:guildId/automation/message', requireAuth, requireGuildPremium, (req, res) => {
    const scheduledTasks = require('../services/scheduledTasks');
    const guildId = req.params.guildId;
    const content = String(req.body?.content || '').trim();
    const runAt = req.body?.runAt;
    if (!content || !runAt) return res.redirect(`/dashboard/${guildId}/automation?err=1`);
    try {
      scheduledTasks.create({
        guildId,
        type: 'scheduled_message',
        channelId: String(req.body.channelId),
        payload: { content },
        runAt,
        createdBy: req.user.id,
      });
      logger.info(`Dashboard: ${req.user.username} scheduled a message in ${guildId}`);
      res.redirect(`/dashboard/${guildId}/automation?ok=1`);
    } catch (err) {
      logger.error(`Scheduled message failed: ${err.message}`);
      res.redirect(`/dashboard/${guildId}/automation?err=1`);
    }
  });

  router.post('/dashboard/:guildId/automation/cancel', requireAuth, requireGuildPremium, (req, res) => {
    const scheduledTasks = require('../services/scheduledTasks');
    const guildId = req.params.guildId;
    scheduledTasks.cancel(Number(req.body?.taskId), guildId);
    res.redirect(`/dashboard/${guildId}/automation?cancelled=1`);
  });

  router.get('/dashboard/:guildId/servers', requireAuth, requireGuildPremium, async (req, res) => {
    const guilds = await manageableGuilds(req.user);
    const withStats = guilds.map((g) => ({
      ...g,
      modulesEnabled: modules.MODULES.filter((m) => settings.getSetting(g.id, m.key)?.enabled ?? m.defaultEnabled === true).length,
      premium: premiumService.isPremium(g.id),
    }));
    res.send(pages.multiServerPage({ user: req.user, guilds: withStats, isPremium: true }));
  });


  // ── Single server overview ─────────────────────────────────────────────
  router.get('/dashboard/:guildId', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const guild = user.guilds.find((g) => g.id === req.params.guildId);
    if (!guild || !authService.canManageGuild(guild)) {
      return res.status(403).send(layout({ title: 'Forbidden', user, content: alert('error', 'You cannot manage that server.') }));
    }
    const premiumRow = premiumService.getPremiumServer(guild.id);
    const premium = premiumRow
      ? { ...premiumRow, active: premiumService.isPremium(guild.id) }
      : null;
    const allOwned = await manageableGuilds(user);
    const moduleStates = modules.MODULES.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      premium: m.premium === true,
      enabled: m.hasEnabled === false ? true : settings.getSetting(guild.id, m.key)?.enabled ?? m.defaultEnabled === true,
    }));
    res.send(
      pages.serverOverview({
        user,
        guild: { ...guild, iconUrl: guildIcon(guild) },
        modules: moduleStates,
        premium,
        premiumServers: allOwned.filter((g) => g.premium),
      })
    );
  });

  // ── Module config GET ──────────────────────────────────────────────────
  router.get('/dashboard/:guildId/modules/:moduleKey', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const guild = user.guilds.find((g) => g.id === req.params.guildId);
    if (!guild || !authService.canManageGuild(guild)) {
      return res.status(403).send(layout({ title: 'Forbidden', user, content: alert('error', 'You cannot manage that server.') }));
    }
    const mod = modules.getModule(req.params.moduleKey);
    if (!mod) return res.status(404).send(layout({ title: 'Not found', user, content: alert('error', 'Unknown module.') }));

    const premium = premiumService.isPremium(guild.id);
    if (mod.premium === true && !premium) {
      return res.status(403).send(layout({ title: 'Premium required', user, content: alert('error', 'This module requires Aether Premium on this server.') }));
    }

    const client = getClient();
    const discordGuild = client?.guilds.cache.get(guild.id);
    const channels = discordGuild
      ? [...discordGuild.channels.cache.values()]
          .map((c) => ({ id: c.id, name: c.name, type: c.type }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
    const roles = discordGuild
      ? [...discordGuild.roles.cache.values()]
          .filter((r) => r.id !== discordGuild.id)
          .map((r) => ({ id: r.id, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const stored = settings.getSetting(guild.id, mod.key, {});
    const current = deepMerge(modules.defaultsFor(mod), stored);
    res.send(pages.moduleConfig({ user, guild, module: mod, config: current, channels, roles, errors: [] }));
  });

  // ── Module config POST ─────────────────────────────────────────────────
  router.post('/dashboard/:guildId/modules/:moduleKey', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const guild = user.guilds.find((g) => g.id === req.params.guildId);
    if (!guild || !authService.canManageGuild(guild)) {
      return res.status(403).send(layout({ title: 'Forbidden', user, content: alert('error', 'You cannot manage that server.') }));
    }
    const mod = modules.getModule(req.params.moduleKey);
    if (!mod) return res.status(404).send(layout({ title: 'Not found', user, content: alert('error', 'Unknown module.') }));

    if (mod.premium === true && !premiumService.isPremium(guild.id)) {
      return res.status(403).send(layout({ title: 'Premium required', user, content: alert('error', 'This module requires Aether Premium on this server.') }));
    }

    const parsed = modules.parseModuleConfig(mod, req.body);
    const existing = settings.getSetting(guild.id, mod.key, {});
    settings.setSetting(guild.id, mod.key, deepMerge(existing, parsed));
    logger.info(`Dashboard: ${user.username} updated ${mod.key} config for ${guild.id}`);

    // Verification: (re)send the panel to the configured channel so the save
    // actually takes effect, mirroring /verify setup.
    if (mod.key === 'verification') {
      const cfg = settings.getSetting(guild.id, 'verification', {});
      const client = getClient();
      const discordGuild = client?.guilds.cache.get(guild.id);
      const channel = discordGuild?.channels.cache.get(cfg.channelId);
      if (cfg.enabled && cfg.roleId && channel?.isTextBased()) {
        require('../modules/verification/verificationService')
          .publishPanel(discordGuild, channel)
          .catch((err) => logger.error(`Dashboard: verification panel publish failed: ${err.message}`));
      }
    }

    // Tickets: (re)send the open-ticket panel to the configured panel channel,
    // mirroring /ticket panel.
    if (mod.key === 'ticket') {
      const cfg = settings.getSetting(guild.id, 'ticket', {});
      const client = getClient();
      const discordGuild = client?.guilds.cache.get(guild.id);
      const channel = discordGuild?.channels.cache.get(cfg.panelChannelId);
      if (cfg.enabled && channel?.isTextBased()) {
        require('../modules/tickets/ticketService')
          .sendPanel(discordGuild, channel)
          .catch((err) => logger.error(`Dashboard: ticket panel publish failed: ${err.message}`));
      }
    }

    res.redirect(`/dashboard/${guild.id}/modules/${mod.key}?saved=1`);
  });

  // ── Premium transfer ───────────────────────────────────────────────────
  router.post('/dashboard/:guildId/premium/transfer', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const fromGuildId = req.params.guildId;
    const toGuildId = String(req.body.targetGuildId || '').trim();

    if (!toGuildId || toGuildId === fromGuildId) {
      return res.status(400).send(layout({ title: 'Transfer failed', user, content: alert('error', 'Choose a different target server.') }));
    }

    const source = user.guilds.find((g) => g.id === fromGuildId);
    const target = user.guilds.find((g) => g.id === toGuildId);
    if (!source || !target || !authService.canManageGuild(source) || !authService.canManageGuild(target)) {
      return res.status(403).send(layout({ title: 'Transfer failed', user, content: alert('error', 'You must own (or be able to manage) both servers.') }));
    }

    const premiumRow = premiumService.getPremiumServer(fromGuildId);
    if (!premiumRow || !premiumService.isPremium(fromGuildId)) {
      return res.status(400).send(layout({ title: 'Transfer failed', user, content: alert('error', 'This server does not have active premium.') }));
    }

    try {
      premiumService.transferServerPremium({ fromGuildId, toGuildId, actorId: user.id });
      logger.info(`Dashboard: ${user.username} transferred premium ${fromGuildId} → ${toGuildId}`);
      res.redirect(`/dashboard/${toGuildId}?transferred=1`);
    } catch (err) {
      logger.error(`Premium transfer failed: ${err.message}`);
      res.status(400).send(layout({ title: 'Transfer failed', user, content: alert('error', err.message) }));
    }
  });

  // ── Owner dashboard ────────────────────────────────────────────────────
  router.get('/owner', requireAuth, requireOwner, (req, res) => {
    const user = currentUser(req);
    const client = getClient();

    const guilds = [...(client?.guilds.cache.values() || [])];
    const premiumRows = db.prepare('SELECT * FROM premium_servers ORDER BY activated_at DESC').all();
    const ticketsByStatus = db.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all();
    const openTickets = ticketsByStatus.find((t) => t.status === 'open')?.n || 0;
    const closedTickets = ticketsByStatus.find((t) => t.status === 'closed')?.n || 0;

    const stats = {
      guilds: client?.guilds.cache.size || 0,
      members: guilds.reduce((n, g) => n + (g.memberCount || 0), 0),
      premiumServers: premiumRows.map((p) => ({ ...p, active: premiumService.isPremium(p.guild_id) })),
      premiumTotal: premiumRows.length,
      premiumActive: premiumRows.filter((p) => premiumService.isPremium(p.guild_id)).length,
      openTickets,
      closedTickets,
      giveaways: db.prepare('SELECT COUNT(*) AS n FROM giveaways WHERE ended = 0').get().n,
      reminders: db.prepare('SELECT COUNT(*) AS n FROM reminders WHERE sent = 0').get().n,
      pendingMemberships: db.prepare("SELECT COUNT(*) AS n FROM premium_memberships WHERE status = 'pending'").get().n,
      recentTickets: db.prepare('SELECT * FROM tickets ORDER BY created_at DESC LIMIT 8').all(),
      commands: require('../handlers/commandHandler').commands.size,
      modules: modules.MODULES.length,
      uptime: process.uptime(),
      dbSize: (require('fs').statSync(config.dbPath).size / 1024 / 1024).toFixed(1) + ' MB',
      discordReady: Boolean(client?.isReady?.()),
    };

    const notice =
      req.query.ok === '1' ? alert('success', 'Premium updated.') : req.query.err === '1' ? alert('error', 'Invalid server ID.') : '';
    res.send(pages.ownerPage({ user, stats, notice }));
  });

  router.post('/owner/premium', requireAuth, requireOwner, (req, res) => {
    const { action, guildId, plan, expiresAt } = req.body;
    if (!/^\d{10,20}$/.test(String(guildId || ''))) {
      return res.redirect('/owner?err=1');
    }
    if (action === 'grant') {
      db.prepare(
        `INSERT INTO premium_servers (guild_id, plan, status, activated_at, expires_at) VALUES (?, ?, 'active', ?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET plan = excluded.plan, status = 'active', expires_at = excluded.expires_at`
      ).run(String(guildId), String(plan || 'premium'), new Date().toISOString(), expiresAt ? new Date(expiresAt).toISOString() : null);
      logger.info(`Owner dashboard: granted premium to ${guildId} (${plan || 'premium'})`);
    } else if (action === 'revoke') {
      db.prepare('DELETE FROM premium_servers WHERE guild_id = ?').run(String(guildId));
      logger.info(`Owner dashboard: revoked premium from ${guildId}`);
    } else {
      return res.redirect('/owner?err=1');
    }
    res.redirect('/owner?ok=1');
  });

  // ── Health ─────────────────────────────────────────────────────────────
  router.get('/health', (req, res) => {
    const client = getClient();
    res.json({ ok: true, service: 'aether-web', uptime: process.uptime(), discord: Boolean(client?.isReady()) });
  });

  return router;
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const features = `
  <div class="feature"><div class="icon">🎫</div><h4>Tickets</h4><p>Custom support tickets with claims, transcripts and categories.</p></div>
  <div class="feature"><div class="icon">📈</div><h4>Leveling</h4><p>XP, roles and a full leaderboard for active members.</p></div>
  <div class="feature"><div class="icon">🪙</div><h4>Economy</h4><p>Currency, daily rewards, work, shop and item inventory.</p></div>
  <div class="feature"><div class="icon">🛡️</div><h4>Security</h4><p>Anti-raid, anti-spam, account-age gates and join lockdown.</p></div>
  <div class="feature"><div class="icon">🤖</div><h4>Automod</h4><p>Word filters, caps, links, mentions and emoji limits.</p></div>
  <div class="feature"><div class="icon">🎉</div><h4>Giveaways</h4><p>Reaction giveaways with winner selection and rerolls.</p></div>
  <div class="feature"><div class="icon">💡</div><h4>Suggestions</h4><p>Member suggestions with staff approve/deny.</p></div>
  <div class="feature"><div class="icon">✅</div><h4>Verification</h4><p>Verify-button gate with role assignment.</p></div>
  <div class="feature"><div class="icon">👋</div><h4>Welcome</h4><p>Welcome/goodbye messages and automatic roles.</p></div>
  <div class="feature"><div class="icon">📋</div><h4>Logging</h4><p>Full audit logging across channels.</p></div>
  <div class="feature"><div class="icon">🗃️</div><h4>Backup</h4><p>Snapshot and restore your server configuration.</p></div>
  <div class="feature"><div class="icon">🪐</div><h4>Premium</h4><p>Everything above, transferred between servers you own.</p></div>`;

module.exports = { buildRouter };
