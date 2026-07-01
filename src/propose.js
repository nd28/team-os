/**
 * Approval flow.
 *
 * BUGFIX (was: `req.apply(state)` was called but no caller ever passed an
 * `apply` function → TypeError on every lead-initiated change). We now use
 * `applyRequestToState` which already knows how to mutate state for all four
 * request types (task_add, task_status, leave_request, profile_update).
 *
 * @module propose
 */

import { state, currentUserToken, memberById, isLead } from './state.js';
import { getGist, writeFile, patchGist } from './gist.js';
import { uid, toast } from './util.js';

/**
 * @typedef {Object} ChangeRequest
 * @property {'task_add'|'task_status'|'leave_request'|'profile_update'} type
 * @property {string} file        gist file to write
 * @property {string} fileKey     key on `state` (e.g. "tasks")
 * @property {string} summary     human label
 * @property {any}    payload     shape depends on type (see applyRequestToState)
 */

/**
 * Lead: apply directly + write. Dev: append to pending_approvals.json.
 * @param {ChangeRequest} req
 */
export async function proposeChange(req) {
  if (isLead()) {
    applyRequestToState(req);
    await writeFile(req.file, state[req.fileKey]);
    toast('Applied directly (lead).');
  } else {
    if (!currentUserToken()) {
      const { openTokenPrompt } = await import('./views/login.js');
      openTokenPrompt();
      throw new Error('Need your GitHub token to submit changes for approval.');
    }
    const entry = {
      id: uid(),
      type: req.type, file: req.file, fileKey: req.fileKey,
      by: state.user.id, byName: state.user.name,
      createdAt: new Date().toISOString(),
      summary: req.summary,
      payload: req.payload,
    };
    state.pending.requests.push(entry);
    try {
      await writeFile('pending_approvals.json', state.pending);
      toast('Submitted for lead approval.');
    } catch (e) {
      state.pending.requests.pop();
      toast(e.message);
      throw e;
    }
  }
  await getGist();
  const { render } = await import('./main.js');
  render();
}

/**
 * Lead approves a pending request — apply the mutation, drop from pending,
 * write both files in one PATCH.
 * @param {string} id
 */
export async function approveChange(id) {
  const r = state.pending.requests.find((x) => x.id === id);
  if (!r) return;
  applyRequestToState(r);
  state.pending.requests = state.pending.requests.filter((x) => x.id !== id);
  await patchGist(currentUserToken(), {
    [r.file]: { content: JSON.stringify(state[r.fileKey], null, 2) },
    'pending_approvals.json': { content: JSON.stringify(state.pending, null, 2) },
  });
  toast('Approved & applied.');
  await getGist();
  const { render } = await import('./main.js');
  render();
}

/**
 * Lead rejects a pending request — remove from list (history not kept).
 * @param {string} id
 * @param {string} [reason]
 */
export async function rejectChange(id, reason) {
  const r = state.pending.requests.find((x) => x.id === id);
  if (!r) return;
  r.status = 'rejected';
  r.rejectReason = reason || '';
  r.resolvedAt = new Date().toISOString();
  state.pending.requests = state.pending.requests.filter((x) => x.id !== id);
  await writeFile('pending_approvals.json', state.pending);
  toast('Rejected.');
  await getGist();
  const { render } = await import('./main.js');
  render();
}

/**
 * Reconstruct the mutation from `r.payload` and apply to in-memory state.
 * Called by both `proposeChange` (lead path) and `approveChange` (lead approves dev's request).
 * @param {ChangeRequest & {payload:any}} r
 */
export function applyRequestToState(r) {
  if (r.type === 'task_status') {
    const t = state.tasks.tasks.find((t) => t.id === r.payload.taskId);
    if (t) t.status = r.payload.status;
  } else if (r.type === 'task_add') {
    state.tasks.tasks.push(r.payload.task);
  } else if (r.type === 'leave_request') {
    state.leaves.leaves.push(r.payload.leave);
  } else if (r.type === 'profile_update') {
    const m = memberById(r.payload.memberId);
    if (m) {
      if (r.payload.responsibilities != null) m.responsibilities = r.payload.responsibilities;
      if (r.payload.workload != null) m.workload = r.payload.workload;
      if (r.payload.status != null) m.status = r.payload.status;
    }
  }
}
