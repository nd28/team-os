/**
 * App entry point. Wires:
 *   - early theme (before paint, no flash)
 *   - tabs and view dispatch
 *   - boot → init → render
 *   - 60s gist auto-refresh + 1s rate-limit countdown
 *
 * Modules call `render()` after writes so the UI stays in sync.
 *
 * @module main
 */

import { state, isLead, setGistId, LS, restoreSession, saveSession, devByUsername } from './state.js';
import { getGist, renderRateLimit } from './gist.js';
import { el, val } from './util.js';
import { IC } from './icons.js';
import { render as renderHeader, bindGlobalMenuClosers } from './views/header.js';
import { loginHtml, bindLogin } from './views/login.js';
import { viewBoard } from './views/board.js';
import { viewTeam } from './views/team.js';
import { viewLeaves } from './views/leaves.js';
import { viewApprovals } from './views/approvals.js';
import { viewManage } from './views/manage.js';

/* ===== Tabs ===== */
/** @type {{id:string, label:string, icon:string, show:()=>boolean}[]} */
const TABS = [
  { id: 'board',     label: 'Board',     icon: 'board',   show: () => true },
  { id: 'team',      label: 'Team',      icon: 'team',    show: () => true },
  { id: 'leaves',    label: 'Leaves',    icon: 'leave',   show: () => true },
  { id: 'approvals', label: 'Approvals', icon: 'approve', show: () => isLead() },
  { id: 'manage',    label: 'Manage',    icon: 'pin',     show: () => isLead() },
];
let currentTab = 'board';

/**
 * Re-render the whole UI: header, tabs, current view.
 * Called after login, logout, every gist refresh, and after every write.
 */
export function render() {
  renderHeader();

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  TABS.filter((t) => t.show()).forEach((t) => {
    const b = el(`<button>${IC[t.icon]} ${t.label}</button>`);
    if (t.id === currentTab) b.classList.add('active');
    b.onclick = () => { currentTab = t.id; render(); };
    tabs.appendChild(b);
  });

  const v = document.getElementById('view');
  if (!state.user) { v.innerHTML = ''; v.appendChild(loginHtml()); bindLogin(); return; }
  if (!state.team) { v.innerHTML = '<div class="empty">Loading…</div>'; return; }
  v.innerHTML = '';
  if (currentTab === 'board')            v.appendChild(viewBoard());
  else if (currentTab === 'team')        v.appendChild(viewTeam());
  else if (currentTab === 'leaves')      v.appendChild(viewLeaves());
  else if (currentTab === 'approvals')   v.appendChild(viewApprovals());
  else if (currentTab === 'manage')      v.appendChild(viewManage());
}

/* ===== Boot ===== */
export async function boot() {
  let gid = (location.hash.match(/gist=([a-f0-9]+)/) || [])[1] || localStorage.getItem(LS.gist) || '';
  if (!gid) {
    document.getElementById('view').innerHTML = `<div class="card" style="max-width:480px;margin:30px auto">
      <h2 style="margin-top:0">Team OS</h2><p class="muted">Open the link the lead pinned on WhatsApp — it contains the gist id in the URL hash (<code>#gist=…</code>).</p>
      <label>Or paste gist id</label><input id="gid" placeholder="8613…d11a08" />
      <button class="primary" id="gset" style="margin-top:10px">Continue</button></div>`;
    document.getElementById('gset').onclick = async () => {
      gid = val('gid').trim();
      setGistId(gid);
      location.hash = `gist=${gid}`;
      localStorage.setItem(LS.gist, gid);
      await init();
    };
    return;
  }
  setGistId(gid);
  localStorage.setItem(LS.gist, gid);
  await init();
}

export async function init() {
  // restore session first so getGist uses token (authenticated = 5000/hr)
  const saved = restoreSession();
  if (saved) state.user = saved;
  try {
    await getGist();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="card">Failed to load gist: ${e.message}</div>`;
    return;
  }
  if (saved) {
    // refresh name/role from latest gist data in case lead changed it
    if (saved.role === 'lead') {
      saved.name = state.auth.lead.name || saved.username;
      saved.rights = state.auth.lead.rights;
    } else {
      const d = devByUsername(saved.username);
      if (d) { saved.name = d.name; saved.rights = d.rights; }
      else   { localStorage.removeItem(LS.session); state.user = null; }
    }
    saveSession();
    render();
    const { checkin } = await import('./geolocation.js');
    checkin();
  } else {
    render();
  }
  // refresh every 60s so everyone sees latest
  setInterval(async () => { try { await getGist(); if (state.user) render(); } catch (_) {} }, 60000);
  // countdown rate-limit badge every second
  setInterval(renderRateLimit, 1000);
  // close user menu on outside click / Escape
  bindGlobalMenuClosers();
}

/* ===== Early theme (run before paint) ===== */
(function applyEarlyTheme() {
  try {
    const saved = localStorage.getItem('tos_theme');
    const theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (_) {}
})();

/* Kick everything off */
boot();
