/**
 * Manage view (lead-only): set developer passwords + share link.
 * @module views/manage
 */

import { state, getGistId } from '../state.js';
import { el, escapeHtml, toast, sha256, val } from '../util.js';
import { patchGist, getGist } from '../gist.js';

/** @returns {HTMLElement} */
export function viewManage() {
  const wrap = el('<div></div>');
  const card = el(`<div class="card"><h3 style="margin-top:0">Manage developers</h3>
    <p class="muted small">Set each developer's app password. They log in with username + password + their own GitHub token (gist scope) to submit changes for your approval.</p></div>`);
  state.auth.developers.forEach((d) => {
    const row = el(`<div class="card" style="margin:8px 0">
      <label>Name</label><input class="nm" value="${escapeHtml(d.name)}" />
      <label>Username (login id)</label><input class="un" value="${escapeHtml(d.username)}" />
      <label>New password</label><input class="pw" type="password" placeholder="set / reset password" />
      <button class="primary sm" style="margin-top:10px">Save</button>
    </div>`);
    row.querySelector('button').onclick = async () => {
      const newName = row.querySelector('.nm').value.trim();
      const newUn = row.querySelector('.un').value.trim();
      const p = row.querySelector('.pw').value;
      if (!newName || !newUn) return toast('Name and username required');
      d.name = newName; d.username = newUn;
      if (p) d.passwordHash = await sha256(p);
      const m = state.team.members.find((m) => m.id === d.id); if (m) m.name = newName;
      // single PATCH with both files to avoid 409 race
      try {
        await patchGist(state.auth._token || localStorage.getItem('tos_token_' + (state.user?.username || '')), {
          'auth.json': { content: JSON.stringify(state.auth, null, 2) },
          'team.json': { content: JSON.stringify(state.team, null, 2) },
        });
        toast('Saved ' + newName);
        await getGist();
        const { render } = await import('../main.js');
        render();
      } catch (e) { toast(e.message); }
    };
    card.appendChild(row);
  });
  wrap.appendChild(card);

  const info = el(`<div class="card small"><b>Share with team (pin on WhatsApp):</b><br>https://nd28.github.io/team-os/#gist=${getGistId()}<br><span class="muted">Gist id is encoded in the URL hash. Anyone with the link can read the board; only you approve changes.</span></div>`);
  wrap.appendChild(info);
  return wrap;
}
