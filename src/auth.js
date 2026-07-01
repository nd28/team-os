/**
 * Auth flows: lead login (PAT verifies against the gist), dev login
 * (username + password + optional PAT), session restore, geolocation check-in.
 * @module auth
 */

import { state, GITHUB_API, setGistId, getGistId, currentUserToken, saveSession, devByUsername, LS } from './state.js';
import { getGist, writeFile } from './gist.js';
import { sha256, toast, val, closeModal } from './util.js';
import { memberById } from './state.js';

/**
 * @param {string} username
 * @param {string} token
 */
export async function loginLead(username, token) {
  // verify token works on this gist
  const r = await fetch(`https://api.github.com/gists/${getGistId()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('Token invalid or no gist access');
  localStorage.setItem(LS.token(username), token);
  state.user = {
    id: username, username,
    name: state.auth.lead.name || username,
    role: 'lead',
    rights: state.auth.lead.rights,
  };
  saveSession();
  await getGist(token);
  const { render } = await import('./main.js');
  render();
  const { checkin } = await import('./geolocation.js');
  checkin();
}

/**
 * @param {string} username
 * @param {string} password
 * @param {string} token
 */
export async function loginDev(username, password, token) {
  const d = devByUsername(username);
  if (!d) throw new Error('Unknown developer. Ask the lead to add you.');
  if (d.passwordHash) {
    const h = await sha256(password || '');
    if (h !== d.passwordHash) throw new Error('Wrong password.');
  } else {
    if (!password) throw new Error('Lead has not set your password yet. Enter any temporary password to continue, then ask lead to set it.');
  }
  if (token) localStorage.setItem(LS.token(username), token);
  state.user = { id: d.id, username: d.username, name: d.name, role: 'developer', rights: d.rights };
  saveSession();
  if (token) await getGist(token);
  const { render } = await import('./main.js');
  render();
  const { checkin } = await import('./geolocation.js');
  checkin();
}

/** Hard-logout (clears session, keeps token). */
export function logout() {
  state.user = null;
  localStorage.removeItem(LS.session);
  import('./main.js').then((m) => m.render());
}
