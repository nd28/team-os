/** @module auth */
import { state, getGistId, saveSession, devByUsername, LS } from './state.js';
import { getGist } from './gist.js';
import { sha256 } from './util.js';

/** @param {string} username @param {string} token */
export async function loginLead(username, token) {
  const r = await fetch(`https://api.github.com/gists/${getGistId()}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Token invalid or no gist access');
  localStorage.setItem(LS.token(username), token);
  state.user = { id: username, username, name: state.auth.lead.name || username, role: 'lead', rights: state.auth.lead.rights };
  saveSession();
  await getGist(token);
  await postLogin();
}

/** @param {string} username @param {string} password @param {string} token */
export async function loginDev(username, password, token) {
  const d = devByUsername(username);
  if (!d) throw new Error('Unknown developer. Ask the lead to add you.');
  if (d.passwordHash) {
    if (await sha256(password || '') !== d.passwordHash) throw new Error('Wrong password.');
  } else if (!password) {
    throw new Error('Lead has not set your password yet. Enter any temporary password to continue, then ask lead to set it.');
  }
  if (token) localStorage.setItem(LS.token(username), token);
  state.user = { id: d.id, username: d.username, name: d.name, role: 'developer', rights: d.rights };
  saveSession();
  if (token) await getGist(token);
  await postLogin();
}

/** Hard-logout (clears session, keeps token). */
export function logout() {
  state.user = null;
  localStorage.removeItem(LS.session);
  import('./main.js').then((m) => m.render());
}

async function postLogin() {
  const { render } = await import('./main.js');
  const { checkin } = await import('./geolocation.js');
  render();
  checkin();
}
