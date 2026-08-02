/**
 * Server-rendered HTML helpers for the Aether website + dashboard.
 * Minimal template system: every page is built from a shared layout and a
 * small set of widgets, keeping the dashboard dependency-light.
 */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a Discord ID as a short snippet for display. */
function shortId(id) {
  return id ? `…${String(id).slice(-6)}` : '—';
}

const CSS = `
:root {
  --bg: #0b0d13;
  --card: #131722;
  --card-2: #1a1f2e;
  --border: #252b3d;
  --text: #e7e9f0;
  --muted: #8a91a8;
  --primary: #8b5cf6;
  --primary-2: #6d3fe0;
  --success: #22c55e;
  --error: #ef4444;
  --warning: #f59e0b;
  --premium: #f1c40f;
  --radius: 12px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.55;
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 28px; border-bottom: 1px solid var(--border);
  background: rgba(11,13,19,0.85); position: sticky; top: 0; z-index: 10;
}
.nav .brand { font-weight: 800; font-size: 18px; color: var(--text); display: flex; align-items: center; gap: 8px; }
.nav .brand span { color: var(--primary); }
.nav .links { display: flex; align-items: center; gap: 16px; font-size: 14px; }
.nav .user { display: flex; align-items: center; gap: 8px; }
.nav .avatar { width: 28px; height: 28px; border-radius: 50%; }
.container { max-width: 1080px; margin: 0 auto; padding: 28px; }
.btn {
  display: inline-block; background: var(--primary); color: #fff;
  padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer;
  font-size: 14px; font-weight: 600; text-decoration: none;
}
.btn:hover { background: var(--primary-2); text-decoration: none; }
.btn.secondary { background: var(--card-2); color: var(--text); border: 1px solid var(--border); }
.btn.secondary:hover { background: var(--card-2); border-color: var(--primary); }
.btn.danger { background: var(--error); }
.btn.small { padding: 6px 12px; font-size: 13px; }
.card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px; margin-bottom: 18px;
}
.card h3 { margin: 0 0 12px; font-size: 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
.stat .value { font-size: 22px; font-weight: 700; }
.badge {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
}
.badge.premium { background: rgba(241,196,15,.15); color: var(--premium); }
.badge.on { background: rgba(34,197,94,.15); color: var(--success); }
.badge.off { background: rgba(148,163,184,.15); color: var(--muted); }
.badge.bot { background: rgba(139,92,246,.15); color: var(--primary); }
.guild-card { display: flex; align-items: center; gap: 14px; }
.guild-card img { width: 52px; height: 52px; border-radius: 12px; }
.guild-card .gname { font-weight: 700; }
.guild-card .gid { color: var(--muted); font-size: 12px; }
.guild-card .right { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.server-section { margin-bottom: 28px; }
.server-section-title {
  color: var(--muted); font-size: 12px; text-transform: uppercase;
  letter-spacing: .8px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
}
.server-section-title .count { background: var(--card-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 9px; font-size: 11px; }
.server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 20px 12px; }
.server-item { display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; }
.server-avatar {
  position: relative; width: 62px; height: 62px; border-radius: 50%;
  display: block; border: 3px solid transparent;
  transition: transform .15s ease, border-color .15s ease;
}
a.server-avatar:hover { transform: scale(1.1); text-decoration: none; }
.server-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; background: var(--card-2); }
.server-avatar.premium { border-color: var(--premium); box-shadow: 0 0 14px rgba(241,196,15,.35); }
.server-avatar.hasbot { border-color: var(--primary); }
.server-avatar.locked { opacity: .45; filter: grayscale(.6); }
.server-badge {
  position: absolute; bottom: -3px; right: -3px; width: 19px; height: 19px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #fff; border: 2px solid var(--bg);
}
.server-badge.ok { background: var(--success); }
.server-badge.lock { background: var(--card-2); color: var(--muted); }
.server-tooltip {
  position: absolute; top: -34px; left: 50%; transform: translateX(-50%);
  background: var(--card-2); color: var(--text); border: 1px solid var(--border);
  font-size: 12px; padding: 3px 10px; border-radius: 6px; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .12s ease; z-index: 5;
}
.server-item:hover .server-tooltip { opacity: 1; }
.invite-mini {
  font-size: 11px; color: var(--primary); border: 1px solid var(--primary);
  border-radius: 999px; padding: 2px 11px; text-decoration: none; font-weight: 600;
}
.invite-mini:hover { background: rgba(139,92,246,.15); text-decoration: none; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; }
.field .help { color: var(--muted); font-size: 12px; margin-top: 4px; }
input[type=text], input[type=number], select, textarea {
  width: 100%; background: var(--card-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; font-size: 14px;
}
textarea { min-height: 90px; font-family: ui-monospace, monospace; }
input[type=checkbox] { transform: scale(1.2); }
.alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.alert.success { background: rgba(34,197,94,.12); color: var(--success); border: 1px solid rgba(34,197,94,.3); }
.alert.error { background: rgba(239,68,68,.12); color: var(--error); border: 1px solid rgba(239,68,68,.3); }
.hero { text-align: center; padding: 56px 0 30px; }
.hero h1 { font-size: 44px; margin: 0 0 12px; }
.hero h1 span { color: var(--primary); }
.hero p { color: var(--muted); font-size: 17px; max-width: 560px; margin: 0 auto 24px; }
.hero .cta { display: flex; gap: 12px; justify-content: center; }
.feature { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
.feature h4 { margin: 0 0 6px; }
.feature p { color: var(--muted); font-size: 14px; margin: 0; }
.muted { color: var(--muted); }
.mono { font-family: ui-monospace, monospace; font-size: 13px; }
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pill { background: var(--card-2); border: 1px solid var(--border); padding: 3px 10px; border-radius: 999px; font-size: 12px; }
footer { text-align: center; color: var(--muted); font-size: 13px; padding: 30px; border-top: 1px solid var(--border); margin-top: 30px; }
.tabbar { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.tabbar a { padding: 9px 16px; color: var(--muted); border-radius: 8px 8px 0 0; font-size: 14px; }
.tabbar a.active { color: var(--text); background: var(--card-2); border: 1px solid var(--border); border-bottom-color: var(--card-2); }
.tabbar a:hover { text-decoration: none; }
`;

/** Full HTML page around inner content. */
function layout({ title, user, content }) {
  const navUser = user
    ? `<div class="user">
         <img class="avatar" src="${esc(user.avatarUrl)}" alt="">
         <span>${esc(user.username)}</span>
       </div>
       <a class="btn secondary small" href="/logout">Log out</a>`
    : `<a class="btn secondary small" href="/login">Log in with Discord</a>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · Aether</title>
<style>${CSS}</style>
</head>
<body>
<nav class="nav">
  <a class="brand" href="/">🪐 <span>Aether</span></a>
  <div class="links">
    <a href="/">Home</a>
    <a href="/commands">Commands</a>
    <a href="/dashboard">Dashboard</a>
    <a href="/premium">Premium</a>
    ${navUser}
  </div>
</nav>
<main class="container">${content}</main>
<footer>🪐 Aether — all-in-one premium Discord bot. · <a href="/health">Status</a></footer>
</body>
</html>`;
}

function alert(type, message) {
  return `<div class="alert ${type}">${esc(message)}</div>`;
}

function redirect(html) {
  return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${esc(html)}"></head><body></body></html>`;
}

module.exports = { esc, shortId, layout, alert, redirect };
