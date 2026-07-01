/**
 * Board view: kanban columns + team presence strip + stuck-tasks warning.
 * @module views/board
 */

import { state, isLead, memberById } from '../state.js';
import { el, escapeHtml, val, toast, uid, modal, closeModal } from '../util.js';
import { dueInfo } from '../format.js';
import { IC } from '../icons.js';
import { proposeChange } from '../propose.js';
import { writeFile, getGist } from '../gist.js';

/**
 * Open-task count + load percentage for a member.
 * @param {string} id  member id
 * @returns {{open:number, pct:number, mine:object[]}}
 */
export function workloadFor(id) {
  const mine = state.tasks.tasks.filter((t) => t.owner === id && t.status !== 'done');
  const n = mine.length;
  const w = Math.min(100, n * 20);
  return { open: n, pct: w, mine };
}

/** @returns {HTMLElement} the full board view */
export function viewBoard() {
  const wrap = el('<div></div>');

  // team presence strip
  const strip = el('<div class="card"><div class="row" style="gap:14px"></div></div>');
  const row = strip.firstChild;
  state.team.members.forEach((m) => {
    const w = workloadFor(m.id);
    const d = el(`<div class="status ${m.status}" title="${m.name}"><span class="dot"></span>${m.name.split(' ')[0]} <span class="muted small">· ${w.open} open</span></div>`);
    row.appendChild(d);
  });
  wrap.appendChild(strip);

  // kanban
  const grid = el('<div class="grid kanban"></div>');
  state.tasks.columns.forEach((col) => {
    const items = state.tasks.tasks.filter((t) => t.status === col);
    const c = el(`<div class="col"><h3>${col} <span class="muted">${items.length}</span></h3></div>`);
    items.forEach((t) => {
      const owner = memberById(t.owner);
      const due = dueInfo(t.deadline);
      const card = el(`<div class="task">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="m">
          <span class="badge">${owner ? escapeHtml(owner.name.split(' ')[0]) : '—'}</span>
          <span class="pill ${t.priority}">${t.priority}</span>
          <span class="due ${due.cls}">${IC.clock} ${due.txt}</span>
        </div></div>`);
      card.onclick = () => openTask(t);
      c.appendChild(card);
    });
    if (isLead() || col === 'backlog') {
      const add = el('<button class="sm" style="margin:6px 0">+ add</button>');
      add.onclick = () => openTask(null, col);
      c.appendChild(add);
    }
    grid.appendChild(c);
  });
  wrap.appendChild(grid);

  // help-offer nudge
  const stuck = state.tasks.tasks.filter((t) => t.status === 'in-progress' && dueInfo(t.deadline).cls);
  if (stuck.length) {
    wrap.appendChild(el(`<div class="card small">⚠ ${stuck.length} task(s) nearing/over deadline — offer help to the owner.</div>`));
  }
  return wrap;
}

/**
 * Open the task modal. `t=null` means "new task in column `col`".
 * @param {object|null} t
 * @param {string} [col]
 */
export function openTask(t, col) {
  const isNew = !t;
  const task = t || { id: uid(), title: '', owner: state.user.id, status: col || 'backlog', priority: 'medium', deadline: '' };
  const opts = (arr, sel) => arr.map((o) => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
  const devLocked = !isLead() && isNew; // developer adding: lock owner+status
  const members = state.team.members.map((m) => `<option value="${m.id}" ${m.id === task.owner ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('');
  modal(`<h3>${isNew ? 'New task' : 'Task'}</h3>
    <label>Title</label><input id="tt" value="${escapeHtml(task.title)}" />
    <label>Owner</label><select id="to" ${devLocked ? 'disabled' : ''}>${members}</select>
    <div class="row" style="gap:10px"><div style="flex:1"><label>Status</label><select id="ts" ${devLocked ? 'disabled' : ''}>${opts(state.tasks.columns, task.status)}</select></div>
    <div style="flex:1"><label>Priority</label><select id="tp">${opts(state.tasks.priorities, task.priority)}</select></div></div>
    <label>Deadline (YYYY-MM-DD)</label><input id="td" type="date" value="${task.deadline || ''}" />
    ${devLocked ? '<div class="muted small">Owner and status are fixed for developer-added tasks. Lead will review.</div>' : ''}
    <div class="row" style="margin-top:12px">
      ${isNew ? '' : '<button class="danger sm" id="tdel">Delete</button>'}
      <div class="spacer"></div>
      <button class="sm" id="tcancel">Cancel</button>
      <button class="primary sm" id="tsave">Save</button>
    </div>`);

  document.getElementById('tcancel').onclick = closeModal;
  document.getElementById('tsave').onclick = async () => {
    const payload = {
      id: task.id,
      title: val('tt').trim(),
      owner: devLocked ? state.user.id : val('to'),
      status: devLocked ? 'backlog' : val('ts'),
      priority: val('tp'),
      deadline: val('td'),
    };
    if (!payload.title) return toast('Title required');
    try {
      if (isNew) {
        await proposeChange({
          type: 'task_add', file: 'tasks.json', fileKey: 'tasks',
          summary: `Add task "${payload.title}"`,
          payload: { task: payload },
        });
      } else {
        const orig = state.tasks.tasks.find((x) => x.id === task.id);
        if (orig.status !== payload.status) {
          await proposeChange({
            type: 'task_status', file: 'tasks.json', fileKey: 'tasks',
            summary: `Move "${payload.title}" → ${payload.status}`,
            payload: { taskId: task.id, status: payload.status },
          });
        }
        if (isLead()) {
          Object.assign(orig, payload);
          await writeFile('tasks.json', state.tasks);
          toast('Saved.'); await getGist(); render();
        } else if (orig.status === payload.status) {
          toast('Only the lead can edit task fields. Status change sent for approval.');
        }
      }
    } catch (e) {
      toast(e.message);
      return;
    }
    closeModal();
  };

  if (!isNew) {
    document.getElementById('tdel').onclick = async () => {
      if (!isLead()) return toast('Only lead can delete tasks.');
      state.tasks.tasks = state.tasks.tasks.filter((x) => x.id !== task.id);
      await writeFile('tasks.json', state.tasks);
      toast('Deleted.');
      closeModal();
      await getGist();
      render();
    };
  }
}
