/**
 * Geolocation capture and "check-in" — updates the current member's
 * location + lastSeen + status on team.json. Presence is real-time, not
 * approval-gated (see ARCHITECTURE.md).
 * @module geolocation
 */

import { state, LS, memberById } from './state.js';
import { writeFile } from './gist.js';
import { toast } from './util.js';

/**
 * Resolve to a {lat, lng, t} object or null. Always resolves (never rejects).
 * @returns {Promise<{lat:string, lng:string, t:number}|null>}
 */
export function getLoc() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    let done = false;
    const finish = (v) => { if (!done) { done = true; res(v); } };
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude.toFixed(3), lng: p.coords.longitude.toFixed(3), t: Date.now() }),
      (e) => { if (e.code !== 1) toast('Location unavailable: ' + e.message); finish(null); },
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 60000 }
    );
    setTimeout(() => finish(null), 9000);
  });
}

/** Capture location and write presence to team.json. */
export async function checkin() {
  const loc = await getLoc();
  if (loc) localStorage.setItem(LS.loc(), JSON.stringify(loc));
  const m = memberById(state.user.id);
  if (!m) return;
  m.location = loc;
  m.lastSeen = new Date().toISOString();
  if (state.user.role === 'developer') m.status = m.status === 'on-leave' ? 'on-leave' : 'remote';
  try {
    await writeFile('team.json', state.team);
  } catch (e) {
    toast(e.message);
  }
  const { render } = await import('./main.js');
  render();
}
