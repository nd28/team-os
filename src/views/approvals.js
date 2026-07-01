/**
 * Approvals view (lead-only): list pending requests with Approve/Reject actions.
 * @module views/approvals
 */

import { state, memberById } from '../state.js';
import { el, escapeHtml } from '../util.js';
import { dueInfo, timeAgo } from '../format.js';
import { IC } from '../icons.js';
import { approveChange, rejectChange } from '../propose.js';

/**
 * Render the detail row for a `task_add` request (owner pill, priority, due, status).
 * @param {{task:object}} p
 * @returns {string}
 */
export function renderTaskAddDetail(p) {
  if (!p || !p.task) return '';
  const t = p.task;
  const owner = memberById(t.owner);
  const due = dueInfo(t.deadline);
  return `<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
    <span class="badge">${owner ? escapeHtml(owner.name) : '—'}</span>
    <span class="pill ${t.priority}">${t.priority}</span>
    <span class="due ${due.cls}">${IC.clock} ${due.txt}</span>
    <span class="muted small">${t.status}</span>
  </div>`;
}

/** @returns {HTMLElement} */
export function viewApprovals() {
  const wrap = el('<div></div>');
  const card = el('<div class="card"><h3 style="margin-top:0">Pending approvals</h3></div>');
  const list = state.pending.requests || [];
  if (!list.length) card.appendChild(el('<div class="empty">Nothing pending. Team is unified. 🤝</div>'));
  list.forEach((r) => {
    const d = el(`<div class="card" style="margin:8px 0">
      <div class="row"><b>${escapeHtml(r.summary)}</b><div class="spacer"></div><span class="badge">${r.type}</span></div>
      <div class="muted small">by ${escapeHtml(r.byName)} · ${timeAgo(r.createdAt)}</div>
      ${r.type === 'task_add' ? renderTaskAddDetail(r.payload) : ''}
      <div class="row" style="margin-top:10px"><button class="primary sm" data-a="ok">Approve</button><button class="danger sm" data-a="no">Reject</button></div>
    </div>`);
    d.querySelector('[data-a=ok]').onclick = () => approveChange(r.id);
    d.querySelector('[data-a=no]').onclick = () => { const reason = prompt('Reject reason?'); rejectChange(r.id, reason); };
    card.appendChild(d);
  });
  wrap.appendChild(card);
  return wrap;
}
