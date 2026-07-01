/** @module views/board */
import { state, isLead, memberById } from '../state.js';
import { el, escapeHtml, val, toast, uid, modal, closeModal } from '../util.js';
import { dueInfo } from '../format.js';
import { IC } from '../icons.js';
import { proposeChange } from '../propose.js';
import { writeFile, getGist } from '../gist.js';

/** @param {string} id @returns {{open:number, pct:number, mine:object[]}} */
export const workloadFor = (id) => {
  const mine = state.tasks.tasks.filter((t) => t.owner === id && t.status !== 'done');
  return { open: mine.length, pct: Math.min(100, mine.length * 20), mine };
};

export function viewBoard() {
  const wrap = el('<div></div>');
  const row = el('<div class="card"><div class="row" style="gap:14px"></div></div>').firstChild;
  state.team.members.forEach((m) => {
    const w = workloadFor(m.id);
    row.appendChild(el(`<div class="status ${m.status}" title="${m.name}"><span class="dot"></span>${m.name.split(' ')[0]} <span class="muted small">· ${w.open} open</span></div>`));
  });
  wrap.appendChild(row.parentNode);

  const grid = el('<div class="grid kanban"></div>');
  state.tasks.columns.forEach((col) => {
    const c = el(`<div class="col"><h3>${col} <span class="muted">${state.tasks.tasks.filter((t) => t.status === col).length}</span></h3></div>`);
    state.tasks.tasks.filter((t) => t.status === col).forEach((t) => {
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

  const stuck = state.tasks.tasks.filter((t) => t.status === 'in-progress' && dueInfo(t.deadline).cls).length;
  if (stuck) wrap.appendChild(el(`<div class="card small">⚠ ${stuck} task(s) nearing/over deadline — offer help to the owner.</div>`));
  return wrap;
}

/** @param {object|null} t @param {string} [col] */
export function openTask(t, col) {
  const isNew = !t;
  const task = t || { id: uid(), title: '', owner: state.user.id, status: col || 'backlog', priority: 'medium', deadline: '' };
  const opt = (arr, sel) => arr.map((o) => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
  const devLocked = !isLead() && isNew;
  const members = state.team.members.map((m) => `<option value="${m.id}" ${m.id === task.owner ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('');

  modal(`<h3>${isNew ? 'New task' : 'Task'}</h3>
    <label>Title</label><input id="tt" value="${escapeHtml(task.title)}" autocomplete="off" />
    <label>Owner</label><select id="to" ${devLocked ? 'disabled' : ''}>${members}</select>
    <div class="grid-2">
      <div><label>Status</label><select id="ts" ${devLocked ? 'disabled' : ''}>${opt(state.tasks.columns, task.status)}</select></div>
      <div><label>Priority</label><select id="tp">${opt(state.tasks.priorities, task.priority)}</select></div>
    </div>
    <label>Deadline</label><input id="td" type="date" value="${task.deadline || ''}" />
    ${devLocked ? '<div class="muted small">Owner and status are fixed for developer-added tasks. Lead will review.</div>' : ''}
    <div class="row actions">
      ${isNew ? '' : '<button class="danger sm" id="tdel">Delete</button>'}
      <div class="spacer"></div>
      <button class="sm" id="tcancel">Cancel</button>
      <button class="primary sm" id="tsave">Save</button>
    </div>`);

  document.getElementById('tcancel').onclick = closeModal;

  const saveBtn = document.getElementById('tsave');
  let saving = false;
  saveBtn.onclick = async () => {
    if (saving) return; // guard double-click
    const payload = {
      id: task.id, title: val('tt').trim(),
      owner: devLocked ? state.user.id : val('to'),
      status: devLocked ? 'backlog' : val('ts'),
      priority: val('tp'), deadline: val('td'),
    };
    if (!payload.title) return toast('Title required');
    saving = true;
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      if (isNew) {
        await proposeChange({ type: 'task_add', file: 'tasks.json', fileKey: 'tasks',
          summary: `Add task "${payload.title}"`, payload: { task: payload } });
      } else {
        const orig = state.tasks.tasks.find((x) => x.id === task.id);
        if (orig.status !== payload.status) {
          await proposeChange({ type: 'task_status', file: 'tasks.json', fileKey: 'tasks',
            summary: `Move "${payload.title}" → ${payload.status}`, payload: { taskId: task.id, status: payload.status } });
        }
        if (isLead()) {
          Object.assign(orig, payload);
          await writeFile('tasks.json', state.tasks);
          toast('Saved.'); await getGist(); (await import('../main.js')).render();
        } else if (orig.status === payload.status) {
          toast('Only the lead can edit task fields. Status change sent for approval.');
        }
      }
      closeModal();
    } catch (e) {
      toast(e.message);
      // re-enable on failure — success closes the modal anyway
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  };

  if (!isNew) {
    document.getElementById('tdel').onclick = async () => {
      if (!isLead()) return toast('Only lead can delete tasks.');
      state.tasks.tasks = state.tasks.tasks.filter((x) => x.id !== task.id);
      await writeFile('tasks.json', state.tasks);
      toast('Deleted.'); closeModal();
      await getGist();
      (await import('../main.js')).render();
    };
  }
}
