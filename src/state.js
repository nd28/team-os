/** @module state */

/** @typedef {{id:string, username:string, name:string, role:'lead'|'developer', rights:string[]}} User */
/** @typedef {{auth:any, team:any, tasks:any, leaves:any, pending:any, user:User|null, raw:any, rateLimit:any}} AppState */

export let GIST_ID = '';
export const setGistId = (id) => { GIST_ID = id; };
export const getGistId = () => GIST_ID;

/** Single source of truth. Mutated freely. */
export const state = /** @type {AppState} */ ({
  auth: null, team: null, tasks: null, leaves: null, pending: null,
  user: null, raw: null, rateLimit: null,
});

// Expose for legacy / non-importing code paths.
if (typeof window !== 'undefined') window.state = state;

export const LS = {
  token: (u) => `tos_token_${u}`,
  pass:  (u) => `tos_pass_${u}`,
  gist:  'tos_gist_id',
  loc:   () => 'tos_lastloc',
  session: 'tos_session',
  cache: 'tos_gist_cache',
};

export const isLead = () => !!(state.user && state.user.role === 'lead');
export const currentUserToken = () => state.user ? (localStorage.getItem(LS.token(state.user.username)) || '') : '';
export const memberById = (id) => state.team ? state.team.members.find((m) => m.id === id) : undefined;
export const devByUsername = (u) => state.auth ? state.auth.developers.find((d) => d.username === u) : undefined;

export const saveSession = () => { if (state.user) localStorage.setItem(LS.session, JSON.stringify(state.user)); };

/** Restore only if a matching PAT exists in localStorage. */
export const restoreSession = () => {
  try {
    const s = JSON.parse(localStorage.getItem(LS.session));
    if (s && s.username && localStorage.getItem(LS.token(s.username))) return s;
  } catch (_) {}
  return null;
};
