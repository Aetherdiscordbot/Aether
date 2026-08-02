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

  function currentUser(req) {
    const u = req.session?.user;
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl || `https://cdn.discordapp.com/embed/avatars/0.png`,
      guilds: u.guilds || [],
    };
  }

  function guildIcon(guild) {
    if (!guild?.icon) return null;
    const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
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
    res.send(
      layout({
        title: 'Home',
        user: currentUser(req),
        content: `
        <div class="hero">
          <h1>🪐 The <span>Aether</span> bot</h1>
          <p>One premium all-in-one Discord bot — tickets, leveling, economy, automod, suggestions, giveaways and more.</p>
          <div class="cta">
            <a class="btn" href="/invite">Invite Aether</a>
            <a class="btn secondary" href="/dashboard">Open dashboard</a>
          </div>
        </div>
        <div class="grid">
          ${features}
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
    res.send(
      layout({
        title: 'Premium',
        user: currentUser(req),
        content: `
        <div class="hero">
          <h1>✦ Aether <span>Premium</span></h1>
          <p>Unlock the full toolkit for one server.</p>
        </div>
        <div class="grid">
          <div class="card"><h3>✨ Premium servers</h3><p class="muted">Tickets, applications, security, automod, logging, backup, embed and giveaways.</p></div>
          <div class="card"><h3>⚙️ Premium modules</h3><p class="muted">Economy, leveling, suggestions, verification, welcome and reaction-role setup.</p></div>
          <div class="card"><h3>🔗 Transferable</h3><p class="muted">Move your premium to another server you own — right from the dashboard.</p></div>
        </div>
        <div style="text-align:center;margin-top:24px">
          ${config.whop.checkoutUrl && config.whop.checkoutUrl !== 'https://whop.com' ? `<a class="btn" href="${config.whop.checkoutUrl}" target="_blank">Get Premium</a>` : '<p class="muted">Checkout link not configured.</p>'}
        </div>`,
      })
    );
  });

  // ── Public: commands list ──────────────────────────────────────────────
  router.get('/commands', (req, res) => {
    const commandHandler = require('../handlers/commandHandler');
    const cmds = [...commandHandler.commands.values()].map((c) => `/${c.name}`).sort().join(' · ');
    res.send(
      layout({
        title: 'Commands',
        user: currentUser(req),
        content: `
        <h2>Commands</h2>
        <div class="card"><p class="mono">${esc(cmds)}</p></div>
        <p class="muted">Use /help in your server for details. Some commands require Premium.</p>`,
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

  // ── Single server overview ─────────────────────────────────────────────
  router.get('/dashboard/:guildId', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const guild = user.guilds.find((g) => g.id === req.params.guildId);
    if (!guild || !authService.canManageGuild(guild)) {
      return res.status(403).send(layout({ title: 'Forbidden', user, content: alert('error', 'You cannot manage that server.') }));
    }
    const premium = premiumService.getPremiumServer(guild.id);
    const allOwned = await manageableGuilds(user);
    const moduleStates = modules.MODULES.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      enabled: m.hasEnabled === false ? true : settings.getSetting(guild.id, m.key)?.enabled === true,
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

    const client = getClient();
    const discordGuild = client?.guilds.cache.get(guild.id);
    const channels = discordGuild
      ? [...discordGuild.channels.cache.values()]
          .filter((c) => c.isTextBased && c.isTextBased())
          .map((c) => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
    const roles = discordGuild
      ? [...discordGuild.roles.cache.values()]
          .filter((r) => r.id !== discordGuild.id)
          .map((r) => ({ id: r.id, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const current = settings.getSetting(guild.id, mod.key, {});
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

    const parsed = modules.parseModuleConfig(mod, req.body);
    const existing = settings.getSetting(guild.id, mod.key, {});
    settings.setSetting(guild.id, mod.key, { ...existing, ...parsed });
    logger.info(`Dashboard: ${user.username} updated ${mod.key} config for ${guild.id}`);
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
  <div class="feature"><h4>🎫 Tickets</h4><p>Custom support tickets with claims, transcripts and categories.</p></div>
  <div class="feature"><h4>📈 Leveling</h4><p>XP, roles and a full leaderboard for active members.</p></div>
  <div class="feature"><h4>🪙 Economy</h4><p>Currency, daily rewards, work, shop and item inventory.</p></div>
  <div class="feature"><h4>🛡️ Security</h4><p>Anti-raid, anti-spam, account-age gates and join lockdown.</p></div>
  <div class="feature"><h4>🤖 Automod</h4><p>Word filters, caps, links, mentions and emoji limits.</p></div>
  <div class="feature"><h4>🎉 Giveaways</h4><p>Reaction giveaways with winner selection and rerolls.</p></div>
  <div class="feature"><h4>💡 Suggestions</h4><p>Member suggestions with staff approve/deny.</p></div>
  <div class="feature"><h4>✅ Verification</h4><p>Verify-button gate with role assignment.</p></div>
  <div class="feature"><h4>👋 Welcome</h4><p>Welcome/goodbye messages and automatic roles.</p></div>
  <div class="feature"><h4>📋 Logging</h4><p>Full audit logging across channels.</p></div>
  <div class="feature"><h4>🗃️ Backup</h4><p>Snapshot and restore your server configuration.</p></div>
  <div class="feature"><h4>🪐 Premium</h4><p>Everything above, transferred between servers you own.</p></div>`;

module.exports = { buildRouter };
