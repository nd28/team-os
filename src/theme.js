/**
 * Theme (light/dark) toggling. Applies `data-theme` to <html> and updates
 * the theme-color meta + the toggle button icon. Persists to localStorage.
 * @module theme
 */

import { IC_SUN, IC_MOON } from './icons.js';

/** @returns {'dark'|'light'} */
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * Apply a theme, persist it, refresh the theme-color meta, and refresh the toggle icon.
 * @param {'dark'|'light'} t
 */
export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('tos_theme', t);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f6f8fa' : '#0d1117');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = t === 'light' ? IC_MOON : IC_SUN;
}
