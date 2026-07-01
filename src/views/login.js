/**
 * Login view + the "token required" prompt.
 * @module views/login
 */

import { state } from '../state.js';
import { loginLead, loginDev } from '../auth.js';
import { el, val, toast, modal, closeModal } from '../util.js';
import { LS } from '../state.js';

/** @returns {HTMLElement} the login card */
export function loginHtml() {
  return el(`<div class="card" style="max-width:420px;margin:30px auto">
    <h2 style="margin-top:0">Sign in to Team OS</h2>
    <p class="muted small">Team board • Kanban • Workload • Leaves • Approvals</p>
    <div class="line"></div>
    <label>I am the…</label>
    <div class="row">
      <button id="rLead" class="primary">Team Lead</button>
      <button id="rDev">Developer</button>
    </div>
    <div id="form" class="hide" style="margin-top:12px"></div>
  </div>`);
}

/** Wire the role chooser + form handlers. Call after loginHtml() is mounted. */
export function bindLogin() {
  const form = document.getElementById('form');
  document.getElementById('rLead').onclick = () => {
    form.classList.remove('hide');
    form.innerHTML = `
      <label>Lead username</label><input id="lu" value="nd28" />
      <label>GitHub Personal Access Token <span class="muted">(gist scope; stored only in your browser)</span></label>
      <input id="lt" type="password" placeholder="ghp_…" />
      <button class="primary" id="lgo" style="margin-top:12px;width:100%">Sign in as Lead</button>
      <p class="muted small" style="margin-top:10px">Create a token at github.com/settings/tokens → scopes: <b>gist</b>.</p>`;
    document.getElementById('lgo').onclick = async () => {
      try { await loginLead(val('lu'), val('lt').trim()); toast('Welcome, lead.'); }
      catch (e) { toast(e.message); }
    };
  };
  document.getElementById('rDev').onclick = () => {
    form.classList.remove('hide');
    form.innerHTML = `
      <label>Developer username <span class="muted">(set by lead)</span></label><input id="du" placeholder="dev1" />
      <label>Password</label><input id="dp" type="password" placeholder="set by lead" />
      <label>Your GitHub token <span class="muted">(gist scope; needed to submit changes for approval)</span></label>
      <input id="dt" type="password" placeholder="ghp_…" />
      <button class="primary" id="dgo" style="margin-top:12px;width:100%">Sign in as Developer</button>
      <p class="muted small" style="margin-top:10px">Your token only writes <b>pending approvals</b> — never board data directly. Lead approves everything.</p>`;
    document.getElementById('dgo').onclick = async () => {
      try { await loginDev(val('du').trim(), val('dp'), val('dt').trim()); toast('Welcome, ' + (state.user?.name || 'dev')); }
      catch (e) { toast(e.message); }
    };
  };
}

/** Prompt the developer for their GitHub token (needed to submit approvals). */
export function openTokenPrompt() {
  modal(`<h3>Token required</h3><p class="muted small">Enter your GitHub token (gist scope). It stays in your browser.</p>
    <input id="tk" type="password" placeholder="ghp_…" />
    <button class="primary" id="tks" style="margin-top:10px;width:100%">Save</button>`);
  document.getElementById('tks').onclick = () => {
    const t = val('tk').trim();
    if (t) {
      localStorage.setItem(LS.token(state.user.username), t);
      closeModal();
    }
  };
}
