/**
 * Display formatting helpers: dates, durations, initials, status, leave windows.
 * All read from `state` but never mutate it.
 * @module format
 */

import { memberById } from './state.js';

/**
 * Two-letter initials (first + last word). Falls back to first char.
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

/**
 * Resolve the current status of a member by name. Defaults to 'active' when unknown.
 * @param {string} name
 * @returns {'active'|'remote'|'away'|'on-leave'|string}
 */
export function statusOf(name) {
  if (!name || !window.state.team) return 'active';
  const m = window.state.team.members.find((x) => x.name && x.name.toLowerCase() === name.toLowerCase());
  return m?.status || 'active';
}

/**
 * Compute the deadline chip text/class (overdue, today, soon, days-out).
 * @param {string} d  ISO date YYYY-MM-DD
 * @returns {{cls: 'over'|'soon'|'', txt: string}}
 */
export function dueInfo(d) {
  if (!d) return { cls: '', txt: '—' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const days = Math.round((dd - today) / 86400000);
  if (days < 0) return { cls: 'over', txt: `overdue ${-days}d` };
  if (days === 0) return { cls: 'soon', txt: 'today' };
  if (days <= 2) return { cls: 'soon', txt: `in ${days}d` };
  return { cls: '', txt: `${days}d` };
}

/**
 * Human-friendly time-ago string ("3m ago", "2h ago", "4d ago", "just now").
 * @param {string} iso  ISO timestamp
 * @returns {string}
 */
export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/**
 * Is a leave request active today?
 * @param {{from:string, to:string}} l
 * @returns {boolean}
 */
export function activeLeave(l) {
  const today = new Date().toISOString().slice(0, 10);
  return l.from <= today && l.to >= today;
}
