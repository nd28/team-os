/**
 * Pure DOM / utility helpers. No app state, no side effects beyond DOM mutation.
 * @module util
 */

/**
 * Parse an HTML string into a single HTMLElement. Whitespace-trimmed.
 * @param {string} html
 * @returns {HTMLElement}
 */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

/**
 * Read the current value of an input/select/textarea by id.
 * @param {string} id
 * @returns {string}
 */
export function val(id) {
  const e = document.getElementById(id);
  return e ? e.value : '';
}

/**
 * Escape `&`, `<`, `>`, `"`, `'` for safe interpolation into HTML.
 * @param {unknown} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Short pseudo-unique id (base36 + timestamp).
 * @returns {string}
 */
export function uid() {
  return 'x' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

/**
 * SHA-256 hex digest of a string using Web Crypto.
 * @param {string} s
 * @returns {Promise<string>}
 */
export async function sha256(s) {
  const b = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Show a transient bottom-center toast message. Auto-dismisses after 2.6s.
 * @param {string} m
 */
export function toast(m) {
  const d = el('<div class="toast"></div>');
  d.textContent = m;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}

/**
 * Show a modal dialog. Click on the backdrop closes it.
 * @param {string} html
 */
export function modal(html) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="modal"><div class="box">${html}</div></div>`;
  m.querySelector('.modal').onclick = (e) => {
    if (e.target.classList.contains('modal')) closeModal();
  };
}

/** Close any open modal by clearing #modal. */
export function closeModal() {
  document.getElementById('modal').innerHTML = '';
}
