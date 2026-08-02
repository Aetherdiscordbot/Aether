/**
 * Dashboard page builders. Pure render functions — all data is passed in by
 * the route handlers in web/routes.js. Kept free of side effects so pages are
 * easy to test and reason about.
 */
const { esc, shortId, layout, alert } = require('./views');
const config = require('../config/config');

const MODULE_ICONS = {
  ticket: '🎫',
  leveling: '📈',
  economy: '🪙',
  verification: '✅',
  suggestions: '💡',
  security: '🛡️',
  automod: '🤖',
  logging: '📋',
  welcome: '👋',
  applications: '📝',
  backup: '💾',
  embed: '🧩',
  giveaway: '🎉',
  react: '🔘',
  staff: '⭐',
};

/** Render the server list: circular icons, manageable servers first. */
function serverList({ user, guilds }) {
  const manage = guilds.filter((g) => g.manage);
  const other = guilds.filter((g) => !g.manage);

  const item = (g) => {
    const icon = g.iconUrl
      ? `<img src="${esc(g.iconUrl)}" alt="" loading="lazy">`
      : `<img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" loading="lazy">`;
    const premiumCls = g.premium ? ' premium' : '';
    const botCls = g.botIn ? ' hasbot' : '';
    const badge = g.botIn ? '<span class="server-badge ok">✓</span>' : '';
    const tooltip = `<span class="server-tooltip">${esc(g.name)}</span>`;
    if (g.manage) {
      const invite = g.botIn
        ? ''
        : `<a class="invite-mini" href="${esc(g.inviteUrl)}" target="_blank" rel="noopener">Invite</a>`;
      return `<div class="server-item">${tooltip}<a class="server-avatar${premiumCls}${botCls}" href="/dashboard/${esc(g.id)}">${icon}${badge}</a>${invite}</div>`;
    }
    return `<div class="server-item">${tooltip}<span class="server-avatar locked">${icon}<span class="server-badge lock">🔒</span></span></div>`;
  };

  const section = (title, list, empty) => `
    ${list.length ? `
      <div class="server-section">
        <div class="server-section-title">${title} <span class="count">${list.length}</span></div>
        <div class="server-grid">${list.map(item).join('')}</div>
      </div>` : ''}`;

  const body = `
    <h2>Your servers</h2>
    <p class="muted">Servers you can manage with Aether appear on top. Premium is per-server.</p>
    ${manage.length ? section('You can manage', manage) : `<div class="card">No manageable servers found. <a href="/invite">Invite Aether</a> to a server or <a href="/login">re-auth</a>.</div>`}
    ${section('Other servers', other)}
    ${!guilds.length ? '<div class="card">No servers found. <a href="/login">Re-auth</a> to refresh your server list.</div>' : ''}`;

  return layout({ title: 'Dashboard', user, content: body });
}

/** Render a single server's overview: premium status + module states. */
function serverOverview({ user, guild, modules, premium, premiumServers }) {
  const icon = guild.iconUrl
    ? `<img src="${esc(guild.iconUrl)}" alt="">`
    : '';
  const isActive = premium?.active === true;

  let premiumCard;
  if (isActive) {
    premiumCard = `
      <div class="premium-hero">
        <h3>✦ Premium active</h3>
        <div class="stats">
          <div class="stat"><span class="label">Plan</span><span class="value">${esc(premium.plan || 'premium')}</span></div>
          <div class="stat"><span class="label">Activated</span><span class="value">${esc((premium.activated_at || '').slice(0, 10))}</span></div>
          <div class="stat"><span class="label">Expires</span><span class="value">${esc((premium.expires_at || 'never').slice(0, 10))}</span></div>
          <div class="stat"><span class="label">Membership</span><span class="value mono">${esc(shortId(premium.membership_id))}</span></div>
        </div>
        ${premiumServers.length > 1 ? transferForm({ guildId: guild.id, premiumServers }) : '<p class="muted">Premium can be transferred to another server you own from your <a href="/dashboard">server list</a>.</p>'}
      </div>`;
  } else if (premium) {
    premiumCard = `
      <div class="premium-hero" style="border-color:rgba(248,113,113,.4)">
        <h3 style="color:var(--error)">✦ Premium expired</h3>
        <p class="muted">This server's premium subscription has expired. Premium modules are locked until it's renewed.</p>
        <a class="btn" href="${esc(config.whop.checkoutUrl || '/premium')}" target="_blank" rel="noopener">Renew Premium</a>
      </div>`;
  } else {
    premiumCard = `
      <div class="premium-hero">
        <h3>Free plan</h3>
        <p class="muted">This server is on the free tier. Some modules require Aether Premium.</p>
        <a class="btn" href="/premium">Upgrade to Premium</a>
      </div>`;
  }

  const moduleCards = modules
    .map((m) => {
      const state = m.enabled ? '<span class="badge on">On</span>' : '<span class="badge off">Off</span>';
      const gate = m.premium && !isActive
        ? '<span class="badge premium">Premium</span>'
        : '';
      const disabled = m.premium && !isActive;
      return `<div class="card module-card${disabled ? ' locked' : ''}">
        <div class="mc-top">
          <span class="mc-ico">${esc(MODULE_ICONS[m.key] || '🧩')}</span>
          <span style="display:flex;gap:6px;align-items:center">${state}${gate}</span>
        </div>
        <span class="mc-name">${esc(m.name)}</span>
        <p>${esc(m.description)}</p>
        <a class="btn secondary small" href="/dashboard/${guild.id}/modules/${esc(m.key)}">${disabled ? '🔒 Locked' : 'Configure'}</a>
      </div>`;
    })
    .join('');

  const body = `
    <div class="tabbar">
      <a href="/dashboard">‹ Back to servers</a>
      <a class="active" href="/dashboard/${guild.id}">Overview</a>
    </div>
    <div class="guild-header">
      ${icon}
      <div>
        <div class="gh-name">${esc(guild.name)}</div>
        <div class="gh-id">${esc(guild.id)}</div>
      </div>
      <a class="btn secondary small" style="margin-left:auto" href="/server/${guild.id}/leaderboard">📈 Public leaderboard</a>
    </div>
    ${premiumCard}
    <h3>Modules</h3>
    <div class="grid">${moduleCards}</div>`;

  return layout({ title: `Dashboard · ${guild.name}`, user, content: body });
}

/** Render module config page: one form per module key. */
function moduleConfig({ user, guild, module: mod, config, channels, roles, errors }) {
  const err = errors?.length ? errors.map((e) => alert('error', e)).join('') : '';
  const fields = buildFields(mod, config, channels, roles);
  const body = `
    <div class="tabbar">
      <a href="/dashboard/${guild.id}">‹ ${esc(guild.name)}</a>
      <a class="active" href="/dashboard/${guild.id}/modules/${esc(mod.key)}">${esc(MODULE_ICONS[mod.key] || '🧩')} ${esc(mod.name)}</a>
    </div>
    ${err}
    <h2>${esc(mod.name)} configuration</h2>
    <p class="muted">${esc(mod.description)}</p>
    <div class="card" style="max-width:680px">
      <form method="post" action="/dashboard/${guild.id}/modules/${esc(mod.key)}">
        ${fields}
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn" type="submit">Save changes</button>
          <a class="btn secondary" href="/dashboard/${guild.id}">Cancel</a>
        </div>
      </form>
    </div>`;
  return layout({ title: `${mod.name} · ${guild.name}`, user, content: body });
}

/** Build the field HTML for a module definition + current config. */
function buildFields(mod, config, channels, roles) {
  const row = (label, input, help) => `<div class="field"><label>${esc(label)}</label>${input}${help ? `<div class="help">${esc(help)}</div>` : ''}</div>`;
  const channelOptions = (field, selected) =>
    channels
      .filter((c) => !field.channelTypes || field.channelTypes.includes(c.type))
      .map(
        (c) =>
          `<option value="${esc(c.id)}" ${String(selected ?? '') === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
      )
      .join('');
  const roleOptions = (selected) =>
    roles.map((r) => `<option value="${esc(r.id)}" ${String(selected ?? '') === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

  const parts = [];

  // Module-level enabled toggle (hidden input so unchecking saves false).
  parts.push(
    row(
      'Enabled',
      `<input type="hidden" name="enabled" value="off"><input type="checkbox" name="enabled" value="on" ${config?.enabled ? 'checked' : ''}>`,
      'Turn this module on or off for this server.'
    )
  );

  for (const [key, def] of Object.entries(mod.fields || {})) {
    const current = config?.[key];
    let input = '';
    switch (def.type) {
      case 'boolean':
        // Hidden input guarantees the field is submitted even when unchecked.
        input = `<input type="hidden" name="${key}" value="off"><input type="checkbox" name="${key}" value="on" ${current ? 'checked' : ''}>`;
        break;
      case 'channel':
        input = `<select name="${key}"><option value="">— none —</option>${channelOptions(def, current)}</select>`;
        break;
      case 'role':
        input = `<select name="${key}"><option value="">— none —</option>${roleOptions(current)}</select>`;
        break;
      case 'roleList':
      case 'channelList': {
        const opts =
          def.type === 'roleList'
            ? roles.map((r) => `<option value="${esc(r.id)}" ${(current || []).includes(r.id) ? 'selected' : ''}>${esc(r.name)}</option>`).join('')
            : channels
                .filter((c) => !def.channelTypes || def.channelTypes.includes(c.type))
                .map((c) => `<option value="${esc(c.id)}" ${(current || []).includes(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`)
                .join('');
        input = `<select name="${key}" multiple size="6">${opts}</select>`;
        break;
      }
      case 'select': {
        const opts = def.options
          .map((o) => `<option value="${esc(o)}" ${String(current ?? '') === o ? 'selected' : ''}>${esc(o)}</option>`)
          .join('');
        input = `<select name="${key}"><option value="">— none —</option>${opts}</select>`;
        break;
      }
      case 'list':
        input = `<textarea name="${key}">${esc(Array.isArray(current) ? current.join(', ') : current ?? '')}</textarea>`;
        break;
      case 'numberList':
        input = `<input type="text" name="${key}" value="${esc(Array.isArray(current) ? current.join(', ') : current ?? '')}">`;
        break;
      case 'number':
        input = `<input type="number" name="${key}" value="${esc(current ?? '')}">`;
        break;
      case 'textarea':
        input = `<textarea name="${key}">${esc(current ?? '')}</textarea>`;
        break;
      default: // text
        input = `<input type="text" name="${key}" value="${esc(current ?? '')}">`;
    }
    parts.push(row(def.label, input, def.help));
  }
  return parts.join('');
}

/** Transfer form shown when a premium server can move to another owned server. */
function transferForm({ guildId, premiumServers }) {
  const options = premiumServers
    .filter((g) => g.id !== guildId)
    .map((g) => `<option value="${esc(g.id)}">${esc(g.name)} (${esc(g.id)})</option>`)
    .join('');
  if (!options) return '';
  return `
    <hr>
    <h3 style="font-size:15px">Transfer premium</h3>
    <form method="post" action="/dashboard/${guildId}/premium/transfer" style="display:flex;gap:10px;align-items:end">
      <div class="field" style="flex:1;margin:0">
        <label>Move premium to another server you own</label>
        <select name="targetGuildId"><option value="">— select —</option>${options}</select>
      </div>
      <button class="btn small" type="submit">Transfer</button>
    </form>`;
}

/** Public ticket transcript page: Discord-style message log. */
function transcriptPage({ guild, ticket }) {
  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const messageRows = (ticket.data || [])
    .map((m) => {
      const time = fmt(m.timestamp);
      const content = m.content ? `<div class="tr-content">${esc(m.content)}</div>` : '';
      const attachments = (m.attachments || [])
        .map((a) =>
          /\.(png|jpe?g|gif|webp)$/i.test(a.url)
            ? `<a class="tr-img" href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.url)}" alt="" loading="lazy"></a>`
            : `<a class="tr-file" href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name || a.url)}</a>`
        )
        .join('');
      const embeds = m.embeds ? '<div class="tr-embed">Embed message</div>' : '';
      return `<div class="tr-msg">
        <img class="tr-ava" src="${esc(m.author?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png')}" alt="" loading="lazy">
        <div class="tr-body">
          <div class="tr-meta"><span class="tr-author">${esc(m.author?.tag || m.author?.id || 'Unknown')}</span><span class="tr-time">${time}</span></div>
          ${content}${attachments}${embeds}
        </div>
      </div>`;
    })
    .join('');

  const body = `
    <div class="tr-wrap">
      <div class="tr-head">
        <div class="tr-icon">🎫</div>
        <div>
          <div class="tr-title">${esc(guild.name)} — Ticket transcript</div>
          <div class="tr-sub">${esc(ticket.category || 'General')} · ${esc(ticket.status)} · opened ${fmt(ticket.created_at)}${ticket.closed_at ? ` · closed ${fmt(ticket.closed_at)}` : ''} · by <b>${esc(ticket.user_id)}</b></div>
        </div>
      </div>
      <div class="tr-card">
        ${messageRows || (ticket.text ? `<pre class="tr-pre">${esc(ticket.text)}</pre>` : '<div class="tr-note">No transcript recorded for this ticket.</div>')}
      </div>
      <p class="muted center" style="margin-top:18px">Powered by <a href="/">Aether</a> · transcript for ticket <code>${esc(ticket.id)}</code></p>
    </div>`;

  return layout({ title: `Transcript · ${guild.name}`, user: null, content: body });
}

module.exports = { serverList, serverOverview, moduleConfig, transcriptPage };
