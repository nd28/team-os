/**
 * Global mutable app state + localStorage keys + auth helpers.
 * `state` is attached to `window` so other modules (format.js, etc.) can
 * access it without an import cycle. Modules that *write* to state should
 * import the named helpers here.
 * @module state
 */

/** @typedef {{id:string, username:string, name:string, role:'lead'|'developer', rights:string[]}} User */
/** @typedef {{auth:any, team:any, tasks:any, leaves:any, pending:any, user:User|null, raw:any, rateLimit:any}} AppState */

export const GITHUB_API = 'https://api.github.com';

/** Active gist id parsed from the URL hash on boot. */
export let GIST_ID = '';

/** @param {string} id */
export function setGistId(id) { GIST_ID = id; }

/** @returns {string} */
export function getGistId() { return GIST_ID; }

/** The single source of truth for the app. Mutated freely. */
export const state = /** @type {AppState} */ ({
  auth: null, team: null, tasks: null, leaves: null, pending: null,
  user: null, raw: null, rateLimit: null,
});

// Expose for legacy modules that read state without an import.
if (typeof window !== 'undefined') window.state = state;

/** localStorage key builders. */
export const LS = {
  token: (u) => `tos_token_${u}`,
  pass:  (u) => `tos_pass_${u}`,
  gist:  'tos_gist_id',
  loc:   () => 'tos_lastloc',
  session: 'tos_session',
  cache: 'tos_gist_cache',
};

/** @returns {boolean} is the current user a lead? */
export function isLead() {
  return state.user && state.user.role === 'lead';
}

/** @returns {string} the current user's GitHub PAT (or empty string) */
export function currentUserToken() {
  return state.user ? (localStorage.getItem(LS.token(state.user.username)) || '') : '';
}

/** @param {string} id @returns {object|undefined} team member by id */
export function memberById(id) {
  return state.team ? state.team.members.find((m) => m.id === id) : undefined;
}

/** @param {string} u @returns {object|undefined} developer record by username */
export function devByUsername(u) {
  return state.auth ? state.auth.developers.find((d) => d.username === u) : undefined;
}

/** Persist the current user object to localStorage. */
export function saveSession() {
  if (state.user) localStorage.setItem(LS.session, JSON.stringify(state.user));
}

/**
 * Restore the saved session only if a matching PAT exists in localStorage.
 * @returns {User|null}
 */
export function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LS.session));
    if (s && s.username && localStorage.getItem(LS.token(s.username))) return s;
  } catch (_) {}
  return null;
}

/** Clear session and trigger a re-render via the imported function. */
export function logout() {
  state.user = null;
  localStorage.removeItem(LS.session);
  // import lazily to avoid a cycle (render depends on many view modules)
  import('./main.js').then((m) => m.render());
}
