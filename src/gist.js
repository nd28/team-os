/**
 * GitHub Gist I/O: fetch, patch, write single file. Caches reads for 60s
 * when unauthenticated to dodge the 60 req/hr rate limit.
 * @module gist
 */

import { state, currentUserToken, getGistId, LS } from './state.js';

/** @param {Headers} h */
export function captureRateLimit(h) {
  const lim = h.get('x-ratelimit-limit');
  const rem = h.get('x-ratelimit-remaining');
  const res = h.get('x-ratelimit-reset');
  if (lim && rem && res) {
    state.rateLimit = { limit: +lim, remaining: +rem, reset: +res };
    renderRateLimit();
  }
}

/** Update the rate-limit badge in the header. */
export function renderRateLimit() {
  const el = document.getElementById('rlBadge');
  if (!el || !state.rateLimit) return;
  const rl = state.rateLimit;
  const secs = Math.max(0, rl.reset - Math.floor(Date.now() / 1000));
  const mm = Math.floor(secs / 60), ss = secs % 60;
  const low = rl.remaining <= 5;
  el.innerHTML = `<span class="rl-dot ${low ? 'low' : ''}"></span>${rl.remaining}/${rl.limit}${secs > 0 ? ` · ${mm}:${ss.toString().padStart(2, '0')}` : ''}`;
  el.title = `GitHub API: ${rl.remaining}/${rl.limit} requests left. Resets in ${mm}:${ss.toString().padStart(2, '0')}.`;
  el.classList.toggle('low', low);
}

/**
 * Fetch the gist and populate state.{raw,auth,team,tasks,leaves,pending}.
 * Authenticated = 5000/hr; unauthenticated = 60/hr (uses 60s localStorage cache).
 * @param {string} [token]  overrides state.user token
 */
export async function getGist(token) {
  token = token || currentUserToken();
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (!token) {
    try {
      const c = JSON.parse(localStorage.getItem(LS.cache));
      if (c && c.t && Date.now() - c.t < 60000) {
        state.raw = c.raw;
        state.auth = c.auth; state.team = c.team; state.tasks = c.tasks;
        state.leaves = c.leaves; state.pending = c.pending;
        return;
      }
    } catch (_) {}
  }

  const r = await fetch(`https://api.github.com/gists/${getGistId()}?_=${Date.now()}`, { headers });
  if (!r.ok) throw new Error('Gist read failed: ' + r.status);
  captureRateLimit(r.headers);
  const j = await r.json();
  state.raw = j;
  const parse = (f) => { try { return JSON.parse(j.files[f].content); } catch (_) { return null; } };
  state.auth = parse('auth.json');
  state.team = parse('team.json');
  state.tasks = parse('tasks.json');
  state.leaves = parse('leaves.json');
  state.pending = parse('pending_approvals.json');

  if (!token) {
    try {
      localStorage.setItem(LS.cache, JSON.stringify({
        t: Date.now(), raw: state.raw,
        auth: state.auth, team: state.team, tasks: state.tasks,
        leaves: state.leaves, pending: state.pending,
      }));
    } catch (_) {}
  }
}

/**
 * PATCH a gist with one or more file replacements.
 * @param {string} token  GitHub PAT (gist scope)
 * @param {Record<string, {content: string}>} files
 */
export async function patchGist(token, files) {
  const body = { files };
  const r = await fetch(`https://api.github.com/gists/${getGistId()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let m = 'Gist write failed: ' + r.status;
    try { const e = await r.json(); m += ' ' + (e.message || ''); } catch (_) {}
    throw new Error(m);
  }
  captureRateLimit(r.headers);
  localStorage.removeItem(LS.cache); // invalidate cache after write
  return r.json();
}

/** Convenience: write one file (JSON-stringified). */
export function writeFile(file, obj) {
  return patchGist(currentUserToken(), { [file]: { content: JSON.stringify(obj, null, 2) } });
}
