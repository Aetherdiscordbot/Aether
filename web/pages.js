/**
 * Dashboard page builders. Pure render functions — all data is passed in by
 * the route handlers in web/routes.js. Kept free of side effects so pages are
 * easy to test and reason about.
 */
const { esc, shortId, layout, alert } = require('./views');

/** Render the server list: every guild the user is in, with manage + bot status. */
function serverList({ user, guilds }) {
  const rows = guilds
    .map((g) => {
      const badge = g.premium
        ? '<span class="badge premium">✦ Premium</span>'
        : '<span class="badge off">Free</span>';
      const botBadge = g.botIn
        ? '<span class="badge bot">Aether in server</span>'
        : `<a class="btn secondary small" href="${esc(g.inviteUrl)}" target="_blank">Invite Aether</a>`;
      const manageLink = g.manage
        ? `<a class="btn small" href="/dashboard/${g.id}">Manage</a>`
        : '<span class="badge off">No manage perms</span>';
      const icon = g.iconUrl
        ? `<img src="${esc(g.iconUrl)}" alt="">`
        : `<img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="">`;
      return `<div class="card guild-card">
        ${icon}
        <div>
          <div class="gname">${esc(g.name)}</div>
          <div class="gid">${esc(g.id)}</div>
        </div>
        <div class="right">
          <div style="display:flex;gap:6px">${badge}${botBadge}</div>
          <div style="display:flex;gap:6px">${manageLink}</div>
        </div>
      </div>`;
    })
    .join('');

  const body = `
    <h2>Your servers</h2>
    <p class="muted">Every server you're in, with Aether status. Premium is per-server.</p>
    ${rows || '<div class="card">No servers found. <a href="/login">Re-auth</a> to refresh your server list.</div>'}`;

  return layout({ title: 'Dashboard', user, content: body });
}

/** Render a single server's overview: premium status + module states. */
function serverOverview({ user, guild, modules, premium, premiumServers }) {
  const icon = guild.iconUrl
    ? `<img src="${esc(guild.iconUrl)}" alt="" style="width:64px;height:64px;border-radius:14px;vertical-align:middle">`
    : '';
  const premiumCard = premium
    ? `<div class="card">
         <h3>✦ Premium active</h3>
         <div class="grid">
           <div class="stat"><span class="label">Plan</span><span class="value">${esc(premium.plan || 'premium')}</span></div>
           <div class="stat"><span class="label">Activated</span><span class="value">${esc((premium.activated_at || '').slice(0, 10))}</span></div>
           <div class="stat"><span class="label">Expires</span><span class="value">${esc((premium.expires_at || 'never').slice(0, 10))}</span></div>
           <div class="stat"><span class="label">Membership</span><span class="value mono">${esc(shortId(premium.membership_id))}</span></div>
         </div>
         ${premiumServers.length > 1 ? transferForm({ guildId: guild.id, premiumServers }) : '<p class="muted">Premium can be transferred to another server you own from your <a href="/dashboard">server list</a>.</p>'}
       </div>`
    : `<div class="card">
         <h3>Free plan</h3>
         <p class="muted">This server is on the free tier. Some modules require Aether Premium.</p>
         <a class="btn" href="/premium">Upgrade to Premium</a>
       </div>`;

  const moduleCards = modules
    .map((m) => {
      const state = m.enabled ? '<span class="badge on">On</span>' : '<span class="badge off">Off</span>';
      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0">${esc(m.name)}</h3>${state}
        </div>
        <p class="muted" style="font-size:13px;margin-top:8px">${esc(m.description)}</p>
        <a class="btn secondary small" href="/dashboard/${guild.id}/modules/${esc(m.key)}">Configure</a>
      </div>`;
    })
    .join('');

  const body = `
    <div class="tabbar">
      <a href="/dashboard">‹ Back to servers</a>
      <a class="active" href="/dashboard/${guild.id}">Overview</a>
    </div>
    <h2>${icon} ${esc(guild.name)} <span class="muted mono">${esc(guild.id)}</span></h2>
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
      <a class="active" href="/dashboard/${guild.id}/modules/${esc(mod.key)}">${esc(mod.name)}</a>
    </div>
    ${err}
    <h2>${esc(mod.name)} configuration</h2>
    <p class="muted">${esc(mod.description)}</p>
    <form method="post" action="/dashboard/${guild.id}/modules/${esc(mod.key)}">
      ${fields}
      <div style="display:flex;gap:10px">
        <button class="btn" type="submit">Save</button>
        <a class="btn secondary" href="/dashboard/${guild.id}">Cancel</a>
      </div>
    </form>`;
  return layout({ title: `${mod.name} · ${guild.name}`, user, content: body });
}

/** Build the field HTML for a module definition + current config. */
function buildFields(mod, config, channels, roles) {
  const channelOptions = channels
    .map((c) => `<option value="${esc(c.id)}" ${String(config?.[mod.channelField] ?? '') === c.id ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const roleOptions = roles
    .map((r) => `<option value="${esc(r.id)}" ${String(config?.[mod.roleField] ?? '') === r.id ? 'selected' : ''}>${esc(r.name)}</option>`)
    .join('');

  const row = (label, input, help) => `<div class="field"><label>${esc(label)}</label>${input}${help ? `<div class="help">${esc(help)}</div>` : ''}</div>`;

  const parts = [];
  if (mod.hasEnabled !== false) {
    parts.push(
      row(
        'Enabled',
        `<input type="checkbox" name="enabled" ${config?.enabled ? 'checked' : ''}>`,
        'Turn this module on or off for this server.'
      )
    );
  }
  if (mod.channelField) {
    parts.push(row(mod.channelLabel || 'Channel', `<select name="channelId"><option value="">— none —</option>${channelOptions}</select>`, mod.channelHelp));
  }
  if (mod.roleField) {
    parts.push(row(mod.roleLabel || 'Role', `<select name="roleId"><option value="">— none —</option>${roleOptions}</select>`, mod.roleHelp));
  }
  for (const [key, def] of Object.entries(mod.fields || {})) {
    const current = config?.[key];
    let input = '';
    switch (def.type) {
      case 'boolean':
        input = `<input type="checkbox" name="${key}" ${current ? 'checked' : ''}>`;
        break;
      case 'text':
        input = `<input type="text" name="${key}" value="${esc(current ?? def.default ?? '')}">`;
        break;
      case 'textarea':
        input = `<textarea name="${key}">${esc(current ?? def.default ?? '')}</textarea>`;
        break;
      case 'number':
        input = `<input type="number" name="${key}" value="${esc(current ?? def.default ?? '')}">`;
        break;
      default:
        input = `<input type="text" name="${key}" value="${esc(current ?? def.default ?? '')}">`;
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
    <hr style="border-color:var(--border);margin:18px 0">
    <h3 style="font-size:15px">Transfer premium</h3>
    <form method="post" action="/dashboard/${guildId}/premium/transfer" style="display:flex;gap:10px;align-items:end">
      <div class="field" style="flex:1;margin:0">
        <label>Move premium to another server you own</label>
        <select name="targetGuildId"><option value="">— select —</option>${options}</select>
      </div>
      <button class="btn small" type="submit">Transfer</button>
    </form>`;
}

module.exports = { serverList, serverOverview, moduleConfig };
