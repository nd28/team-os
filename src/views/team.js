/**
 * Team view: per-member workload meters (lead can edit) + upcoming-deadlines list.
 * @module views/team
 */

import { state, isLead, memberById } from '../state.js';
import { el, escapeHtml, toast } from '../util.js';
import { dueInfo, timeAgo, activeLeave } from '../format.js';
import { workloadFor } from './board.js';
import { IC } from '../icons.js';
import { proposeChange } from '../propose.js';
import { writeFile, getGist } from '../gist.js';

/** @returns {HTMLElement} */
export function viewTeam() {
  const wrap = el('<div></div>');

  const meters = el('<div class="card"><h3 style="margin-top:0">Workload & Ownership</h3><div class="meters"></div></div>');
  const mm = meters.querySelector('.meters');
  state.team.members.forEach((m) => {
    const w = workloadFor(m.id);
    const onLeave = state.leaves.leaves.some((l) => l.member === m.id && l.status === 'approved' && activeLeave(l));
    const card = el(`<div class="meter card" style="margin:0">
      <div class="row"><b>${escapeHtml(m.name)}</b><div class="spacer"></div><span class="status ${onLeave ? 'on-leave' : m.status}"><span class="dot"></span>${onLeave ? 'on leave' : m.status}</span></div>
      <div class="muted small">${escapeHtml(m.responsibilities || '')}</div>
      <div class="small" style="margin-top:6px">${IC.loc} ${m.location ? `<a href="https://www.openstreetmap.org/?mlat=${m.location.lat}&mlon=${m.location.lng}#map=12/${m.location.lat}/${m.location.lng}" target="_blank">${m.location.lat},${m.location.lng}</a>` : '—'} · last seen ${m.lastSeen ? timeAgo(m.lastSeen) : '—'}</div>
      <div class="bar"><i style="width:${m.workload || 0}%"></i></div>
      <div class="muted small">${m.workload || 0}% load · ${w.open} open task(s)</div>
      ${isLead() ? `<details><summary class="small">edit</summary>
        <label>Responsibilities</label><input class="med-r" value="${escapeHtml(m.responsibilities || '')}" />
        <label>Workload %</label><input class="med-w" type="number" min="0" max="100" value="${m.workload}" />
        <label>Status</label><select class="med-s">${state.team.statusOptions.map((o) => `<option ${o === m.status ? 'selected' : ''}>${o}</option>`).join('')}</select>
        <button class="primary sm" style="margin-top:8px">Save member</button></details>` : ''}
    </div>`);
    if (isLead()) {
      card.querySelector('button').onclick = async () => {
        try {
          await proposeChange({
            type: 'profile_update', file: 'team.json', fileKey: 'team',
            summary: `Update profile for ${m.name}`,
            payload: {
              memberId: m.id,
              responsibilities: card.querySelector('.med-r').value,
              workload: +card.querySelector('.med-w').value,
              status: card.querySelector('.med-s').value,
            },
          });
        } catch (e) { toast(e.message); }
      };
    }
    mm.appendChild(card);
  });
  wrap.appendChild(meters);

  // upcoming deadlines
  const up = state.tasks.tasks.filter((t) => t.status !== 'done' && t.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const dl = el('<div class="card"><h3 style="margin-top:0">Upcoming deadlines</h3></div>');
  if (!up.length) dl.appendChild(el('<div class="empty">none</div>'));
  up.forEach((t) => {
    const o = memberById(t.owner);
    const d = dueInfo(t.deadline);
    dl.appendChild(el(`<div class="row" style="margin:6px 0"><span>${escapeHtml(t.title)}</span><span class="badge">${o ? escapeHtml(o.name.split(' ')[0]) : '—'}</span><div class="spacer"></div><span class="due ${d.cls} small">${t.deadline} (${d.txt})</span></div>`));
  });
  wrap.appendChild(dl);
  return wrap;
}
