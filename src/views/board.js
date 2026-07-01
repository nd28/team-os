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
  const grid = el('<div class="grid kanban"></div>');
  state.tasks.columns.forEach((col) => {
    const c = el(`<div class="col"><h3>${col} <span class="muted">${state.tasks.tasks.filter((t) => t.status === col).length}</span></h3></div>`);
    state.tasks.tasks.filter((t) => t.status === col).forEach((t) => {
      const owner = memberById(t.owner);
      const due = dueInfo(t.deadline);
      const ownerHTML = owner
        ? `<span class="owner-badge" title="${escapeHtml(owner.name)} — ${owner.status}"><span class="status-dot ${owner.status}"></span>${escapeHtml(owner.name.split(' ')[0])}</span>`
        : '<span class="owner-badge">—</span>';
      const card = el(`<div class="task">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="m">
          ${ownerHTML}
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
  const cur = state.team.members.find((m) => m.id === task.owner) || state.team.members[0];
  const ownerOpts = state.team.members.map((m) => {
    const w = workloadFor(m.id);
    return `<div class="owner-option ${m.id === cur.id ? 'selected' : ''}" data-id="${m.id}" data-name="${escapeHtml(m.name)}" data-status="${m.status}">
      <span class="status-dot ${m.status}"></span>
      <span class="name">${escapeHtml(m.name)}</span>
      <span class="workload">${w.open} open · ${w.pct}%</span>
      <span class="bar"><i style="width:${w.pct}%"></i></span>
    </div>`;
  }).join('');
  const ownerPickerHTML = devLocked
    ? `<div class="owner-picker disabled"><div class="owner-trigger"><span class="status-dot ${cur.status}"></span><span class="name">${escapeHtml(cur.name)}</span></div><input type="hidden" id="to" value="${cur.id}" /></div>`
    : `<div class="owner-picker" id="ownerPicker">
        <button type="button" class="owner-trigger" id="ownerTrigger">
          <span class="status-dot ${cur.status}"></span>
          <span class="name">${escapeHtml(cur.name)}</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="owner-menu" id="ownerMenu">${ownerOpts}</div>
        <input type="hidden" id="to" value="${cur.id}" />
      </div>`;

  // Segmented Status control — each button shows column + live task count
  const statusSegs = state.tasks.columns.map((col) => {
    const n = state.tasks.tasks.filter((t) => t.status === col && t.id !== task.id).length;
    return `<button type="button" class="seg-btn ${col === task.status ? 'active' : ''}" data-val="${col}" ${devLocked ? 'disabled' : ''}>
      <span class="seg-label">${col}</span><span class="seg-count">${n}</span>
    </button>`;
  }).join('');
  const statusSegHTML = devLocked
    ? `<div class="seg-group seg-status" role="radiogroup">${statusSegs}</div><input type="hidden" id="ts" value="${task.status}" />`
    : `<div class="seg-group seg-status" id="tsGroup" role="radiogroup">${statusSegs}</div><input type="hidden" id="ts" value="${task.status}" />`;

  // Segmented Priority control — colored by urgency
  const priSegs = state.tasks.priorities.map((p) =>
    `<button type="button" class="seg-btn ${p === task.priority ? 'active' : ''}" data-val="${p}">${p}</button>`
  ).join('');
  const prioritySegHTML = `<div class="seg-group seg-priority" id="tpGroup" role="radiogroup">${priSegs}</div><input type="hidden" id="tp" value="${task.priority}" />`;

  modal(`<h3>${isNew ? 'New task' : 'Task'}</h3>
    <input id="tt" class="title-input" placeholder="What needs to be done?" value="${escapeHtml(task.title)}" autocomplete="off" />
    <div class="modal-divider"></div>
    <label>Owner</label>${ownerPickerHTML}
    <div class="grid-2">
      <div><label>Status</label>${statusSegHTML}</div>
      <div><label>Priority</label>${prioritySegHTML}</div>
    </div>
    <label>Deadline</label><input id="td" type="date" value="${task.deadline || ''}" />
    ${devLocked ? '<div class="muted small">Owner and status are fixed for developer-added tasks. Lead will review.</div>' : ''}
    <div class="row actions">
      ${isNew ? '' : '<button class="danger sm" id="tdel">Delete</button>'}
      <div class="spacer"></div>
      <button class="sm" id="tcancel">Cancel</button>
      <button class="primary sm" id="tsave">Save</button>
    </div>`);

  // Title is the hero — focus it the instant the modal opens
  const titleInput = document.getElementById('tt');
  titleInput.focus();
  // for edit-mode, select-all so user can immediately retype
  if (!isNew) titleInput.select();

  // Segmented controls: click to set + sync hidden input
  const wireSeg = (groupId, hiddenId) => {
    const g = document.getElementById(groupId);
    if (!g) return;
    g.querySelectorAll('.seg-btn:not([disabled])').forEach((btn) => {
      btn.onclick = () => {
        g.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.getElementById(hiddenId).value = btn.dataset.val;
      };
    });
  };
  wireSeg('tsGroup', 'ts');
  wireSeg('tpGroup', 'tp');

  // Owner picker — wire up only if not locked. AbortController cleans up
  // document-level listeners on close (no leak across modal opens).
  if (!devLocked) {
    const trigger = document.getElementById('ownerTrigger');
    const menu = document.getElementById('ownerMenu');
    const hidden = document.getElementById('to');
    const ac = new AbortController();
    const close = () => { ac.abort(); menu.classList.remove('open'); };
    trigger.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
    menu.querySelectorAll('.owner-option').forEach((opt) => {
      opt.onclick = () => {
        hidden.value = opt.dataset.id;
        trigger.querySelector('.name').textContent = opt.dataset.name;
        trigger.querySelector('.status-dot').className = `status-dot ${opt.dataset.status}`;
        menu.querySelectorAll('.owner-option').forEach((o) => o.classList.toggle('selected', o.dataset.id === opt.dataset.id));
        close();
      };
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#ownerPicker')) close(); }, { signal: ac.signal });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal: ac.signal });
  }

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
