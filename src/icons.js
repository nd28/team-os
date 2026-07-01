/**
 * Icon set: prefers Nucleo Glass premium SVGs (loaded as a side-effect import
 * from /nucleo-glass.js), falls back to inline stroke SVGs when the key is missing.
 * @module icons
 */

import { NUCLEO_GLASS } from '../nucleo-glass.js';

/**
 * Look up an icon by name. Injects the `.ic` class for sizing/styling.
 * @param {string} name
 * @param {string} fallback  inline stroke SVG used when the icon isn't in the set
 * @returns {string}
 */
export function GLASS(name, fallback) {
  if (NUCLEO_GLASS[name]) {
    return NUCLEO_GLASS[name].replace(/<svg /, '<svg class="ic" ');
  }
  return fallback;
}

/**
 * Curated icons used across the app. Add new keys as needed.
 * @type {Record<string, string>}
 */
export const IC = {
  board:   GLASS('grid',   '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="6" height="16" rx="1"/><rect x="10.5" y="4" width="6" height="11" rx="1"/><rect x="18" y="4" width="3" height="7" rx="1"/></svg>'),
  team:    GLASS('team',   '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><path d="M14 18c.4-2 2-3.2 4-3.2s3.6 1.2 4 3.2"/></svg>'),
  leave:   GLASS('leaves', '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h18M3 9l9-6 9 6M5 9v11h14V9"/></svg>'),
  approve: GLASS('clipboard-check', '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'),
  pin:     GLASS('gear',   '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6z"/></svg>'),
  loc:     GLASS('crosshairs', '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'),
  logout:  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  clock:   '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

/** Sun icon for dark mode (button shows "switch to light"). */
export const IC_SUN = GLASS('cloud-sun', '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>');

/** Moon icon for light mode (button shows "switch to dark"). */
export const IC_MOON = GLASS('cloud-moon', '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>');
