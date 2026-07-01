/**
 * Header rendering: avatar pill + dropdown (Check-in / Logout), theme
 * toggle, rate-limit badge. Also handles outside-click / Escape close.
 * @module views/header
 */

import { state, isLead } from '../state.js';
import { IC, IC_SUN, IC_MOON } from '../icons.js';
import { currentTheme, setTheme } from '../theme.js';
import { initials, statusOf } from '../format.js';
import { checkin } from '../geolocation.js';
import { renderRateLimit } from '../gist.js';

/** Close the avatar dropdown if open. */
export function closeUserMenu() {
  const m = document.getElementById('userMenu');
  if (m) m.classList.remove('open');
}

/** Toggle the avatar dropdown. */
export function toggleUserMenu() {
  const m = document.getElementById('userMenu');
  if (m) m.classList.toggle('open');
}

/** Re-render the right side of the header (avatar + theme + rate-limit badge). */
export function render() {
  closeUserMenu();
  const who = document.getElementById('who');
  const themeBtnHTML = `<button class="sm theme-btn" id="themeBtn" title="Toggle light/dark" style="min-height:36px;padding:6px 8px">${currentTheme() === 'light' ? IC_MOON : IC_SUN}</button>`;
  const rlBadgeHTML = `<span class="rl-badge" id="rlBadge" title="GitHub API rate limit"></span>`;
  if (state.user) {
    const st = statusOf(state.user.name);
    who.innerHTML = `
      <span class="user-wrap">
        <button class="user-btn" id="userBtn" title="${state.user.name}">
          <span class="avatar">${initials(state.user.name)}</span>
          <span class="ucol">
            <span class="uname">${state.user.name}</span>
            <span class="ustatus"><span class="status ${st}"><span class="dot"></span>${st}</span></span>
          </span>
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.6"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="user-menu" id="userMenu">
          <div class="um-head">
            <div class="un">${state.user.name}</div>
            <div class="ur">${state.user.role || 'member'}</div>
          </div>
          <button id="btnCheckin">${IC.loc} Check-in</button>
          <div class="um-sep"></div>
          <button class="danger" id="btnLogout">${IC.logout} Logout</button>
        </div>
      </span>
      ${rlBadgeHTML}${themeBtnHTML}`;

    document.getElementById('userBtn').onclick = (e) => { e.stopPropagation(); toggleUserMenu(); };
    document.getElementById('btnCheckin').onclick = () => { closeUserMenu(); checkin(); };
    document.getElementById('btnLogout').onclick = () => { closeUserMenu(); state.user = null; localStorage.removeItem('tos_session'); import('../main.js').then((m) => m.render()); };
  } else {
    who.innerHTML = `${rlBadgeHTML}${themeBtnHTML}`;
  }
  // brand is only useful for the login screen — avatar handles identity when logged in
  document.querySelector('header.top')?.classList.toggle('compact', !!state.user);
  renderRateLimit();
  const tb = document.getElementById('themeBtn');
  if (tb) tb.onclick = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

/** Wire the outside-click + Escape handlers. Call once at boot. */
export function bindGlobalMenuClosers() {
  document.addEventListener('click', (e) => {
    const m = document.getElementById('userMenu');
    const wrap = e.target.closest('.user-wrap');
    if (m && m.classList.contains('open') && !wrap) closeUserMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeUserMenu(); });
}
