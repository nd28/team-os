/**
 * Leaves view: list of all leave requests, lead can approve/reject; either
 * role can submit a new request via openLeave().
 * @module views/leaves
 */

import { state, isLead, memberById } from '../state.js';
import { el, escapeHtml, toast, uid, val, modal, closeModal } from '../util.js';
import { proposeChange } from '../propose.js';
import { writeFile, getGist } from '../gist.js';

/** @returns {HTMLElement} */
export function viewLeaves() {
  const wrap = el('<div></div>');
  const card = el(`<div class="card"><h3 style="margin-top:0">Leave requests</h3>
    <button class="primary sm" id="reqLeave">Request leave</button></div>`);
  card.querySelector('#reqLeave').onclick = () => openLeave();
  wrap.appendChild(card);

  state.leaves.leaves.forEach((l) => {
    const m = memberById(l.member);
    const d = el(`<div class="card leavecard">
      <div><b>${m ? escapeHtml(m.name) : l.member}</b> <span class="muted small">${l.from} → ${l.to}</span><div class="muted small">${escapeHtml(l.reason || '')}</div></div>
      <span class="pill ${l.status === 'approved' ? 'low' : l.status === 'rejected' ? 'high' : 'medium'}">${l.status}</span>
      ${isLead() && l.status === 'pending' ? '<div class="row"><button class="primary sm" data-a="approve">Approve</button><button class="danger sm" data-a="reject">Reject</button></div>' : ''}
    </div>`);
    if (isLead() && l.status === 'pending') {
      d.querySelector('[data-a=approve]').onclick = async () => {
        l.status = 'approved';
        await writeFile('leaves.json', state.leaves);
        toast('Approved leave.');
        await getGist();
        const { render } = await import('../main.js');
        render();
      };
      d.querySelector('[data-a=reject]').onclick = async () => {
        l.status = 'rejected';
        await writeFile('leaves.json', state.leaves);
        toast('Rejected leave.');
        await getGist();
        const { render } = await import('../main.js');
        render();
      };
    }
    wrap.appendChild(d);
  });
  if (!state.leaves.leaves.length) wrap.appendChild(el('<div class="empty">No leave requests yet.</div>'));
  return wrap;
}

/** Open the "Request leave" modal. */
export function openLeave() {
  modal(`<h3>Request leave</h3>
    <label>From</label><input id="lf" type="date" />
    <label>To</label><input id="lt2" type="date" />
    <label>Reason</label><input id="lr" placeholder="optional" />
    <div class="row" style="margin-top:12px"><div class="spacer"></div><button class="sm" id="lc">Cancel</button><button class="primary sm" id="ls">Submit</button></div>`);
  document.getElementById('lc').onclick = closeModal;
  document.getElementById('ls').onclick = async () => {
    const from = val('lf'), to = val('lt2');
    if (!from || !to) return toast('Dates required');
    const leave = { id: uid(), member: state.user.id, from, to, reason: val('lr'), status: isLead() ? 'approved' : 'pending' };
    try {
      await proposeChange({
        type: 'leave_request', file: 'leaves.json', fileKey: 'leaves',
        summary: `Leave ${from}→${to} (${state.user.name})`,
        payload: { leave },
      });
    } catch (e) { toast(e.message); return; }
    closeModal();
  };
}
