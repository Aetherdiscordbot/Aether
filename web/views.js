/**
 * Server-rendered HTML helpers for the Aether website + dashboard.
 * Minimal template system: every page is built from a shared layout and a
 * small set of widgets, keeping the dashboard dependency-light.
 *
 * Design: "Aurora" — deep-space glassmorphism with gradient accents.
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
:root, [data-theme='aether'] {
  --bg: #060813;
  --bg-2: #0b0e20;
  --card: rgba(255,255,255,.045);
  --card-2: rgba(255,255,255,.07);
  --card-3: rgba(255,255,255,.02);
  --border: rgba(255,255,255,.09);
  --border-2: rgba(255,255,255,.16);
  --text: #eef1ff;
  --muted: #98a2c8;
  --violet: #8b5cf6;
  --indigo: #6366f1;
  --cyan: #22d3ee;
  --magenta: #e879f9;
  --success: #34d399;
  --error: #f87171;
  --warning: #fbbf24;
  --premium: #f1c40f;
  --radius: 16px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --display: 'Sora', var(--font);
  --grad: linear-gradient(100deg, #a78bfa 0%, #818cf8 45%, #22d3ee 100%);
  --shadow: 0 20px 60px rgba(2,6,23,.5);
  --nav-bg: rgba(6,8,19,.72);
  --footer-bg: rgba(6,8,19,.6);
  --input-bg: rgba(255,255,255,.05);
  --input-focus: rgba(255,255,255,.07);
  --knob: #cbd5f5;
  --opt-bg: #12152b;
  --hover-bg: rgba(255,255,255,.12);
  --tooltip-bg: rgba(17,21,44,.95);
  --grid-line: rgba(148,163,216,.05);
  --on-bg: rgba(52,211,153,.12);
  --off-bg: rgba(152,162,200,.1);
  --premium-bg: rgba(241,196,15,.14);
  --warn-bg: rgba(248,113,113,.14);
  --error-bg: rgba(248,113,113,.1);
  --violet-bg: rgba(139,92,246,.16);
  --chip-bg: rgba(139,92,246,.12);
  --violet-text: #c4b5fd;
  --premium-text: #fcd34d;
  --warn-text: #fca5a5;
  --track-bg: rgba(255,255,255,.08);
  --embed-bg: rgba(255,255,255,.03);
  --aurora-1: rgba(139,92,246,.28);
  --aurora-2: rgba(34,211,238,.16);
  --aurora-3: rgba(232,121,249,.12);
  --page-top: #070a19;
  --page-bottom: #060813;
  --scroll-thumb: #2a3157;
  --scroll-track: #0b0e20;
  --ring: rgba(139,92,246,.22);
}

[data-theme='dark'] {
  --bg: #0c0d13;
  --bg-2: #15161e;
  --card: rgba(255,255,255,.05);
  --card-2: rgba(255,255,255,.08);
  --card-3: rgba(255,255,255,.03);
  --border: rgba(255,255,255,.1);
  --border-2: rgba(255,255,255,.19);
  --text: #f1f2f7;
  --muted: #9aa1b2;
  --violet: #8f7bff;
  --indigo: #6366f1;
  --cyan: #38bdf8;
  --magenta: #e879f9;
  --success: #34d399;
  --error: #f87171;
  --warning: #fbbf24;
  --premium: #f5c518;
  --grad: linear-gradient(100deg, #8f7bff 0%, #6366f1 45%, #38bdf8 100%);
  --shadow: 0 20px 60px rgba(0,0,0,.55);
  --nav-bg: rgba(12,13,19,.78);
  --footer-bg: rgba(12,13,19,.7);
  --input-bg: rgba(255,255,255,.06);
  --input-focus: rgba(255,255,255,.09);
  --knob: #d7d9e6;
  --opt-bg: #191b26;
  --hover-bg: rgba(255,255,255,.14);
  --tooltip-bg: rgba(21,23,34,.96);
  --grid-line: rgba(148,163,216,.05);
  --on-bg: rgba(52,211,153,.14);
  --off-bg: rgba(154,161,178,.12);
  --premium-bg: rgba(245,197,24,.16);
  --warn-bg: rgba(248,113,113,.16);
  --error-bg: rgba(248,113,113,.12);
  --violet-bg: rgba(143,123,255,.18);
  --chip-bg: rgba(143,123,255,.14);
  --violet-text: #b9a9ff;
  --premium-text: #fadc5c;
  --warn-text: #fca5a5;
  --track-bg: rgba(255,255,255,.09);
  --embed-bg: rgba(255,255,255,.04);
  --aurora-1: rgba(143,123,255,.22);
  --aurora-2: rgba(56,189,248,.12);
  --aurora-3: rgba(232,121,249,.1);
  --page-top: #0d0e16;
  --page-bottom: #0c0d13;
  --scroll-thumb: #31344a;
  --scroll-track: #15161e;
  --ring: rgba(143,123,255,.24);
}

[data-theme='light'] {
  --bg: #f5f6fa;
  --bg-2: #eaecf4;
  --card: #ffffff;
  --card-2: #f1f3fa;
  --card-3: #fafbfe;
  --border: rgba(15,23,42,.09);
  --border-2: rgba(15,23,42,.17);
  --text: #171a26;
  --muted: #5b6478;
  --violet: #7c3aed;
  --indigo: #4f46e5;
  --cyan: #0891b2;
  --magenta: #c026d3;
  --success: #059669;
  --error: #dc2626;
  --warning: #d97706;
  --premium: #b45309;
  --grad: linear-gradient(100deg, #7c3aed 0%, #4f46e5 45%, #0891b2 100%);
  --shadow: 0 20px 50px rgba(15,23,42,.1);
  --nav-bg: rgba(255,255,255,.82);
  --footer-bg: rgba(255,255,255,.75);
  --input-bg: #ffffff;
  --input-focus: #ffffff;
  --knob: #ffffff;
  --opt-bg: #ffffff;
  --hover-bg: rgba(15,23,42,.07);
  --tooltip-bg: #1e2233;
  --grid-line: rgba(15,23,42,.04);
  --on-bg: rgba(5,150,105,.12);
  --off-bg: rgba(91,100,120,.1);
  --premium-bg: rgba(180,83,9,.12);
  --warn-bg: rgba(220,38,38,.1);
  --error-bg: rgba(220,38,38,.08);
  --violet-bg: rgba(124,58,237,.12);
  --chip-bg: rgba(124,58,237,.1);
  --violet-text: #6d28d9;
  --premium-text: #b45309;
  --warn-text: #b91c1c;
  --track-bg: rgba(15,23,42,.09);
  --embed-bg: rgba(15,23,42,.04);
  --aurora-1: rgba(124,58,237,.14);
  --aurora-2: rgba(8,145,178,.09);
  --aurora-3: rgba(192,38,211,.07);
  --page-top: #fbfcfe;
  --page-bottom: #f5f6fa;
  --scroll-thumb: #c3c9de;
  --scroll-track: #eaecf4;
  --ring: rgba(124,58,237,.2);
}

* { box-sizing: border-box; }
html { scrollbar-color: var(--scroll-thumb) var(--scroll-track); }
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
main.container { flex: 1 0 auto; width: 100%; }
/* ── Aurora background ─────────────────────────────────────────────── */
body::before {
  content: '';
  position: fixed; inset: 0; z-index: -2; pointer-events: none;
  background:
    radial-gradient(42% 38% at 18% -6%, var(--aurora-1), transparent 70%),
    radial-gradient(38% 34% at 88% 4%, var(--aurora-2), transparent 70%),
    radial-gradient(50% 44% at 50% 108%, var(--aurora-3), transparent 72%),
    linear-gradient(180deg, var(--page-top) 0%, var(--page-bottom) 100%);
}
body::after {
  content: '';
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(75% 55% at 50% 0%, #000 20%, transparent 100%);
  -webkit-mask-image: radial-gradient(75% 55% at 50% 0%, #000 20%, transparent 100%);
}
::selection { background: var(--ring); }
a { color: var(--violet); text-decoration: none; transition: color .15s ease; }
a:hover { text-decoration: none; color: var(--violet-text); }
h1, h2, h3, h4 { font-family: var(--display); line-height: 1.2; letter-spacing: -.02em; }
h2 { font-size: 26px; margin: 0 0 8px; }
h3 { font-size: 17px; margin: 0 0 8px; }
h4 { font-size: 15px; margin: 0 0 4px; }

/* ── Nav ───────────────────────────────────────────────────────────── */
.nav {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 32px;
  position: sticky; top: 0; z-index: 50;
  background: var(--nav-bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 1px solid var(--border);
}
.nav .brand {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--display); font-weight: 800; font-size: 21px; color: var(--text);
  letter-spacing: -.02em;
}
.nav .brand .grad { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.nav .links { display: flex; align-items: center; gap: 4px; font-size: 14px; flex-wrap: wrap; }
.nav .links > a:not(.btn):not(.theme-switch) { padding: 8px 13px; border-radius: 10px; color: var(--muted); }
.nav .links > a:not(.btn):hover { color: var(--text); background: var(--card-2); }
.nav .user { display: flex; align-items: center; gap: 10px; margin-left: 8px; }
.nav .user .uname { font-size: 13px; font-weight: 600; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav .avatar { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--border-2); }

/* ── Theme switcher ────────────────────────────────────────────────── */
.theme-switch { display: inline-flex; align-items: center; gap: 2px; background: var(--card-2); border: 1px solid var(--border); border-radius: 999px; padding: 3px; margin-left: 10px; }
.theme-switch button {
  border: none; background: transparent; cursor: pointer; height: 26px;
  border-radius: 999px; font-size: 12px; font-weight: 700; opacity: .55;
  padding: 0 12px; color: var(--text); transition: all .15s ease;
  line-height: 1; font-family: inherit;
}
.theme-switch button:hover { opacity: .9; }
.theme-switch button.active { opacity: 1; background: var(--grad); color: #fff; box-shadow: 0 2px 12px var(--ring); }

/* ── Layout ────────────────────────────────────────────────────────── */
.container { max-width: 1120px; margin: 0 auto; padding: 36px 28px 64px; }
footer {
  text-align: center; color: var(--muted); font-size: 13px;
  padding: 28px 20px 34px; border-top: 1px solid var(--border);
  background: var(--footer-bg);
}
footer a { color: var(--muted); }
footer a:hover { color: var(--text); }

/* ── Buttons ───────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--grad); color: #fff !important;
  padding: 11px 22px; border-radius: 12px; border: none; cursor: pointer;
  font-size: 14px; font-weight: 700; text-decoration: none !important;
  box-shadow: 0 8px 24px rgba(99,102,241,.35);
  transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(99,102,241,.5); filter: brightness(1.05); }
.btn.secondary { background: var(--card-2); color: var(--text) !important; border: 1px solid var(--border-2); box-shadow: none; }
.btn.secondary:hover { background: var(--hover-bg); border-color: var(--violet); }
.btn.danger { background: linear-gradient(100deg, #ef4444, #f97316); box-shadow: 0 8px 24px rgba(239,68,68,.3); }
.btn.small { padding: 7px 14px; font-size: 13px; border-radius: 10px; }

/* ── Cards / grid ──────────────────────────────────────────────────── */
.card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 22px; margin-bottom: 18px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.card:hover { border-color: var(--border-2); transform: translateY(-2px); box-shadow: var(--shadow); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 18px; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.stat .value { font-size: 22px; font-weight: 700; font-family: var(--display); }

/* ── Badges / pills ────────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 11px;
  border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap;
}
.badge.premium { background: var(--premium-bg); color: var(--premium-text); border: 1px solid rgba(241,196,15,.35); }
.badge.on { background: var(--on-bg); color: var(--success); border: 1px solid rgba(52,211,153,.35); }
.badge.off { background: var(--off-bg); color: var(--muted); border: 1px solid var(--border-2); }
.badge.bot { background: var(--violet-bg); color: var(--violet-text); border: 1px solid rgba(139,92,246,.4); }
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--card-2); border: 1px solid var(--border);
  padding: 4px 12px; border-radius: 999px; font-size: 13px; color: var(--muted);
}
.pill.premium { border-color: rgba(241,196,15,.4); color: var(--premium-text); background: var(--premium-bg); }
.tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }

/* ── Server list ───────────────────────────────────────────────────── */
.server-section { margin-bottom: 32px; }
.server-section-title {
  display: flex; align-items: center; gap: 10px;
  color: var(--muted); font-size: 13px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; margin-bottom: 16px;
}
.server-section-title .count {
  background: var(--card-2); border: 1px solid var(--border);
  border-radius: 999px; padding: 1px 10px; font-size: 12px; color: var(--text);
}
.server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 22px 14px; }
.server-item { display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; }
.server-avatar {
  position: relative; width: 64px; height: 64px; border-radius: 50%;
  display: block; border: 3px solid transparent;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
  background: var(--card-2);
}
a.server-avatar:hover { transform: translateY(-3px) scale(1.05); text-decoration: none; box-shadow: 0 10px 26px rgba(0,0,0,.45); }
.server-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; background: var(--card-2); }
.server-avatar.premium { border-color: var(--premium); box-shadow: 0 0 0 1px rgba(241,196,15,.35), 0 0 18px rgba(241,196,15,.4); }
.server-avatar.hasbot { border-color: #a78bfa; box-shadow: 0 0 14px rgba(139,92,246,.4); }
.server-avatar.locked { opacity: .4; filter: grayscale(.75); }
.server-badge {
  position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #fff;
  border: 2px solid var(--bg-2);
}
.server-badge.ok { background: var(--success); }
.server-tooltip {
  position: absolute; top: -36px; left: 50%; transform: translateX(-50%);
  background: var(--tooltip-bg); color: var(--text); border: 1px solid var(--border-2);
  font-size: 12px; padding: 4px 12px; border-radius: 8px; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .15s ease; z-index: 5;
  box-shadow: var(--shadow);
}
.server-item:hover .server-tooltip { opacity: 1; }
.invite-mini {
  font-size: 11px; color: var(--violet-text); border: 1px solid rgba(139,92,246,.55);
  border-radius: 999px; padding: 2px 12px; text-decoration: none; font-weight: 700;
  transition: all .15s ease;
}
.invite-mini:hover { background: var(--chip-bg); text-decoration: none; }

/* ── Forms ─────────────────────────────────────────────────────────── */
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text); }
.field .help { color: var(--muted); font-size: 12px; margin-top: 6px; }
input[type=text], input[type=number], select, textarea {
  width: 100%; background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border-2); border-radius: 11px; padding: 10px 14px;
  font-size: 14px; font-family: var(--font);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
input[type=text]:focus, input[type=number]:focus, select:focus, textarea:focus {
  outline: none; border-color: var(--violet);
  box-shadow: 0 0 0 3px var(--ring); background: var(--input-focus);
}
textarea { min-height: 96px; font-family: ui-monospace, 'Cascadia Code', monospace; font-size: 13px; }
select option { background: var(--opt-bg); color: var(--text); }

/* Toggle switch for checkboxes (module enabled + booleans) */
input[type=checkbox] {
  appearance: none; -webkit-appearance: none;
  width: 42px; height: 24px; border-radius: 999px; cursor: pointer;
  background: var(--off-bg); border: 1px solid var(--border-2);
  position: relative; transition: background .18s ease, border-color .18s ease;
  vertical-align: middle; margin: 0 6px 2px 2px;
}
input[type=checkbox]::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%; background: var(--knob);
  transition: transform .18s ease, background .18s ease;
}
input[type=checkbox]:checked { background: var(--grad); border-color: transparent; }
input[type=checkbox]:checked::after { transform: translateX(18px); background: #fff; }

/* ── Alerts ────────────────────────────────────────────────────────── */
.alert {
  padding: 13px 18px; border-radius: 12px; margin-bottom: 18px; font-size: 14px;
  border: 1px solid; backdrop-filter: blur(8px);
}
.alert.success { background: var(--on-bg); color: var(--success); border-color: rgba(52,211,153,.35); }
.alert.error { background: var(--error-bg); color: var(--error); border-color: rgba(248,113,113,.35); }

/* ── Hero / landing ────────────────────────────────────────────────── */
.hero { text-align: center; padding: 72px 0 44px; position: relative; }
.hero .chip {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: var(--violet-text); background: var(--chip-bg);
  border: 1px solid rgba(139,92,246,.35); border-radius: 999px;
  padding: 6px 16px; margin-bottom: 22px;
}
.hero h1 { font-size: clamp(38px, 6vw, 62px); font-weight: 800; margin: 0 0 18px; letter-spacing: -.03em; }
.hero h1 .grad { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hero p { color: var(--muted); font-size: 17px; max-width: 620px; margin: 0 auto 30px; }
.hero .cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.hero .stats {
  display: flex; justify-content: center; gap: 48px; flex-wrap: wrap;
  margin-top: 52px; padding-top: 34px; border-top: 1px solid var(--border);
}
.hero .stats .stat .value {
  font-size: 30px;
  background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}

.feature {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 22px;
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.feature:hover { transform: translateY(-3px); border-color: var(--violet); box-shadow: var(--shadow); }
.feature h4::before {
  content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 3px;
  background: var(--grad); margin-right: 9px; transform: translateY(-1px);
}
.feature h4 { font-size: 16px; }
.feature p { color: var(--muted); font-size: 14px; margin: 0; }

.section-title { text-align: center; font-size: clamp(26px, 4vw, 34px); margin: 56px 0 10px; }
.section-sub { text-align: center; color: var(--muted); margin: 0 0 34px; }

/* ── Public leaderboard ─────────────────────────────────────────────── */
.lb-icon { width: 68px; height: 68px; border-radius: 18px; border: 2px solid var(--border-2); box-shadow: var(--shadow); }
.lb-card { max-width: 700px; margin: 0 auto; }
.lb-row {
  display: flex; align-items: center; gap: 14px;
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 18px; margin-bottom: 10px;
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.lb-row:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.lb-row.top1 { border-color: rgba(241,196,15,.45); background: linear-gradient(160deg, rgba(241,196,15,.1), rgba(139,92,246,.06)); }
.lb-row.top2 { border-color: rgba(203,213,225,.35); }
.lb-row.top3 { border-color: rgba(196,137,94,.4); }
.lb-rank { width: 40px; text-align: center; font-size: 20px; font-weight: 700; color: var(--muted); flex-shrink: 0; }
.lb-avatar { width: 46px; height: 46px; border-radius: 50%; border: 2px solid var(--border-2); flex-shrink: 0; }
.lb-main { flex: 1; min-width: 0; }
.lb-name { font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lb-lvl {
  font-size: 12px; font-weight: 600; color: var(--premium-text);
  border: 1px solid rgba(241,196,15,.4); background: var(--premium-bg);
  padding: 2px 8px; border-radius: 999px;
}
.lb-bar { height: 8px; background: var(--track-bg); border-radius: 999px; margin: 7px 0 4px; overflow: hidden; }
.lb-fill { height: 100%; border-radius: 999px; background: var(--grad); }
.lb-xp { font-size: 12px; color: var(--muted); }
.lb-total { font-weight: 700; color: var(--muted); white-space: nowrap; font-size: 14px; }
.lb-hero-icon { display: inline-block; }

/* ── Ticket transcript page ────────────────────────────────────────── */
.tr-wrap { max-width: 780px; margin: 0 auto; }
.tr-head { display: flex; align-items: center; gap: 16px; justify-content: center; margin: 26px 0 20px; }
.tr-title { font-family: var(--display); font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
.tr-sub { color: var(--muted); font-size: 13px; }
.tr-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  padding: 8px 22px;
}
.tr-msg { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.tr-msg:last-child { border-bottom: none; }
.tr-ava { width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--border-2); flex-shrink: 0; }
.tr-body { flex: 1; min-width: 0; }
.tr-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.tr-author { font-weight: 700; font-size: 14px; color: var(--violet-text); }
.tr-time { color: var(--muted); font-size: 11px; }
.tr-content { font-size: 14.5px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
.tr-img img { max-width: 100%; max-height: 420px; border-radius: 12px; margin-top: 6px; border: 1px solid var(--border); }
.tr-file { display: inline-block; margin-top: 6px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--chip-bg); font-size: 13px; }
.tr-embed {
  margin-top: 6px; padding: 10px 14px; border-radius: 10px; border-left: 3px solid var(--border-2);
  background: var(--embed-bg); color: var(--muted); font-size: 13px;
}
.tr-note { text-align: center; color: var(--muted); padding: 26px 0; }
.tr-pre { white-space: pre-wrap; font-size: 12.5px; color: var(--muted); max-height: 70vh; overflow: auto; }

/* ── Premium page ──────────────────────────────────────────────────── */
.pricing {
  max-width: 520px; margin: 0 auto;
  background: linear-gradient(160deg, rgba(241,196,15,.08), rgba(139,92,246,.08) 55%, rgba(34,211,238,.06));
  border: 1px solid rgba(241,196,15,.35);
  border-radius: 20px; padding: 30px; text-align: center;
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 0 60px rgba(241,196,15,.12);
}
.pricing .price { font-family: var(--display); font-size: 40px; font-weight: 800; margin: 8px 0 4px; }
.pricing .per { color: var(--muted); font-size: 13px; }
.pricing ul { list-style: none; margin: 22px 0; padding: 0; text-align: left; display: grid; gap: 10px; }
.pricing li { display: flex; gap: 10px; align-items: center; font-size: 14px; color: var(--text); }
.pricing li .tick { color: var(--success); font-weight: 800; }

/* ── Tabs / module config ──────────────────────────────────────────── */
.tabbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 26px; }
.tabbar a {
  padding: 8px 16px; color: var(--muted); border-radius: 999px;
  font-size: 13.5px; font-weight: 600; border: 1px solid transparent;
  transition: all .15s ease;
}
.tabbar a:first-child { margin-right: 6px; font-weight: 700; color: var(--violet); }
.tabbar a:first-child:hover { background: var(--chip-bg); color: var(--violet-text); }
.tabbar a.active {
  color: var(--text); background: var(--card-2);
  border-color: var(--border-2); box-shadow: inset 0 0 0 1px var(--border);
}
.tabbar a.locked { opacity: .5; }
.tabbar a.locked:hover { opacity: .8; }
.tabbar a:not(.active):not(:first-child):hover { color: var(--text); background: var(--card); border-color: var(--border); }

/* ── Server overview ───────────────────────────────────────────────── */
.guild-header {
  display: flex; align-items: center; gap: 16px; margin-bottom: 24px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px 24px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
}
.guild-header .gh-name { font-family: var(--display); font-size: 25px; font-weight: 800; letter-spacing: -.02em; }
.guild-header .gh-id {
  font-family: ui-monospace, 'Cascadia Code', monospace; font-size: 12px; color: var(--muted);
  background: var(--card-2); border: 1px solid var(--border); border-radius: 999px;
  padding: 3px 12px; display: inline-block; margin-top: 6px;
}
.guild-header .gh-actions { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; }
.premium-hero {
  border-radius: var(--radius); padding: 24px; margin-bottom: 22px;
  background: linear-gradient(140deg, rgba(241,196,15,.12), rgba(139,92,246,.12) 55%, rgba(34,211,238,.1));
  border: 1px solid rgba(241,196,15,.3);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
}
.premium-hero h3 { color: var(--premium-text); }
.premium-hero .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; margin: 16px 0; }
.premium-hero .stats .stat { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }

.module-card { display: flex; flex-direction: column; gap: 4px; height: 100%; }
.module-card .mc-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.module-card .mc-name { font-family: var(--display); font-weight: 700; font-size: 15px; }
.module-card p { color: var(--muted); font-size: 13px; margin: 4px 0 12px; flex: 1; }
.module-card.locked { opacity: .55; filter: saturate(.6); }

.muted { color: var(--muted); }
.mono { font-family: ui-monospace, 'Cascadia Code', monospace; font-size: 13px; }
.center { text-align: center; }
hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }

/* ── Owner dashboard ────────────────────────────────────────────────── */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.stat-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; display: flex; flex-direction: column; gap: 4px;
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
}
.stat-card .value {
  font-family: var(--display); font-size: 22px; font-weight: 800;
  background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.stat-card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }

/* ── Status page ───────────────────────────────────────────────────── */
.status-row {
  display: flex; align-items: center; gap: 12px; padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.status-row:last-child { border-bottom: none; }
.status-row > span:first-child { font-weight: 700; min-width: 150px; }
.status-row > span:last-child { margin-left: auto; color: var(--muted); font-size: 12.5px; text-align: right; }

.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th {
  text-align: left; color: var(--muted); font-weight: 600; font-size: 11.5px;
  text-transform: uppercase; letter-spacing: .05em; padding: 12px 10px; border-bottom: 1px solid var(--border);
}
.tbl td { padding: 10px; border-bottom: 1px solid var(--border); }
.tbl tr:last-child td { border-bottom: none; }
.tbl td .badge { font-size: 11px; }

/* ── Premium tabs ────────────────────────────────────────────────────── */
.chart { display: flex; align-items: flex-end; gap: 6px; padding: 18px 16px 10px; min-height: 170px; overflow-x: auto; }
.bar-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; flex: 1; min-width: 18px; }
.bar { width: 100%; max-width: 26px; background: linear-gradient(180deg, var(--cyan), var(--indigo)); border-radius: 6px 6px 0 0; min-height: 4px; opacity: .9; }
.bar-col:hover .bar { opacity: 1; filter: brightness(1.2); }
.bar-day { font-size: 10px; color: var(--muted); }
.server-cell { display: flex; align-items: center; gap: 10px; }
.server-cell img { width: 34px; height: 34px; border-radius: 9px; }
.server-cell b { display: block; }
.server-cell .mono { display: block; font-size: 11px; }
textarea { background: var(--input-bg); border: 1px solid var(--border-2); color: var(--text); border-radius: 10px; padding: 10px 12px; font: inherit; width: 100%; box-sizing: border-box; }
textarea:focus { outline: none; border-color: var(--violet); }
.badge.warn { background: var(--warn-bg); color: var(--warn-text); }

/* ── Error pages ─────────────────────────────────────────────────────── */
.error-page { text-align: center; padding: 90px 0 50px; }
.error-code {
  font-family: var(--display); font-size: clamp(72px, 18vw, 120px); font-weight: 800; line-height: 1;
  background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
  letter-spacing: -.03em; text-shadow: 0 20px 60px rgba(139, 92, 246, .25);
}
.error-title { font-family: var(--display); font-size: 24px; font-weight: 700; margin-top: 14px; }
.error-msg { color: var(--muted); max-width: 460px; margin: 10px auto 28px; line-height: 1.6; }
.error-page .cta { display: flex; gap: 10px; justify-content: center; }
`;

/** Full HTML page around inner content. */
function layout({ title, user, content }) {
  const navUser = user
    ? `<div class="user">
         <img class="avatar" src="${esc(user.avatarUrl)}" alt="">
         <span class="uname">${esc(user.username)}</span>
         <a class="btn secondary small" href="/logout">Log out</a>
       </div>`
    : `<a class="btn small" href="/login">Log in with Discord</a>`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="aether">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · Aether</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script>
(function () {
  var themes = ['aether', 'dark', 'light'];
  var saved = null;
  try { saved = localStorage.getItem('aether-theme'); } catch (e) {}
  var theme = themes.indexOf(saved) !== -1 ? saved : 'aether';
  document.documentElement.setAttribute('data-theme', theme);
  document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('[data-theme-btn]');
    buttons.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme-btn') === theme);
      b.addEventListener('click', function () {
        var value = b.getAttribute('data-theme-btn');
        document.documentElement.setAttribute('data-theme', value);
        try { localStorage.setItem('aether-theme', value); } catch (e) {}
        buttons.forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-theme-btn') === value); });
      });
    });
  });
})();
</script>
</head>
<body>
<nav class="nav">
  <a class="brand" href="/"><span class="grad">Aether</span></a>
  <div class="links">
    <a href="/">Home</a>
    <a href="/commands">Commands</a>
    <a href="/premium">Premium</a>
    <a href="/dashboard">Dashboard</a>
    ${user?.isOwner ? '<a href="/owner">Owner</a>' : ''}
    ${navUser}
    <span class="theme-switch" role="group" aria-label="Theme">
      <button type="button" data-theme-btn="aether" title="Aether theme">Aether</button>
      <button type="button" data-theme-btn="dark" title="Dark theme">Dark</button>
      <button type="button" data-theme-btn="light" title="Light theme">Light</button>
    </span>
  </div>
</nav>
<main class="container">${content}</main>
<footer><b>Aether</b> — all-in-one premium Discord bot · <a href="/health">Status</a> · <a href="/dashboard">Dashboard</a></footer>
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
