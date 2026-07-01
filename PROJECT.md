# Project Tracker — Team OS

Single source of truth for what we shipped, when, and why.
Format: `## [YYYY-MM-DD] — short title` then `What | Why | Files | Tests`.

---

## 2026-07-01 — Segmented status + priority controls
**What:** Replaced the two generic `<select>` elements in the task modal with segmented controls. Status shows column name + live task count per column. Priority is 3 colored pills (high=red, medium=amber, low=green).
**Why:** Native `<select>` felt generic and hid context. For 3-4 options, segmented is 1 click vs 2 (open + click), shows the full option set at once, and lets priority carry its own color.
**Files:** `src/views/board.js`, `src/styles.css`, `tests/segments.test.js`
**Tests:** 14/14 — counts, click-to-update, hidden input sync, color shift on priority, save uses new values.

## 2026-07-01 — Custom owner picker (rich team-member select)
**What:** Replaced the Owner `<select>` with a custom dropdown showing each member's status dot, name, open-task count, and workload bar. Hidden `<input id="to">` keeps the save handler unchanged.
**Why:** Choosing a teammate needs more than a name — workload, availability. A `<select>` can't show that without external preview UI.
**Files:** `src/views/board.js`, `src/styles.css`
**Tests:** Covered by `tests/add-task.test.js` (save still works) + visual via `tests/snap-modal.js → owner-picker.png`.
**Note:** Use `AbortController` to clean up the outside-click + Escape listeners on close — no listener leak across modal opens.

## 2026-07-01 — Refactor: tighten code (cut ~150 lines)
**What:** Removed verbose JSDoc, condensed similar CSS rules, killed unused imports, fixed a latent bug in `views/manage.js` (was reading `state.auth._token` — always undefined).
**Why:** User feedback: be mindful of token usage; every line earns its place.
**Files:** `src/styles.css` 208→161, `src/state.js` 85→42, `src/auth.js` 66→45, `views/board.js` 164→133, `views/team.js` 66→54, `views/leaves.js` 72→55, `views/manage.js` 49→43. Total: 710→533 lines (-25%).
**Tests:** All 80+ existing tests pass.

## 2026-07-01 — Stacked rate-limit badge (3-tier visual hierarchy)
**What:** Horizontal `● 4999/5000 · 42:15` → stacked 2-line `● 4999/5000` + `42:15`. Typographic tiers: remaining (bold 700, 12px, 100% op), total (500, 10.5px, 65% op), timer (400, 10px, 50% op), separator (10px, 30% op). Low state (<=5): red border + bg + pulse.
**Why:** Was 101px wide — eating header space. Stacked = 66-90px. Weight + opacity hierarchy = info-importance mapping is visible at a glance.
**Files:** `src/gist.js`, `src/styles.css`, `tests/rl-badge.test.js`
**Tests:** 36 assertions × 3 cases (healthy/mid/low) — DOM, weight, opacity, width, low-class, red color.

## 2026-07-01 — Hide brand + "not logged in" when signed in
**What:** When `state.user` is set, `header.top.compact` class is added → brand + "not logged in" text hidden. Header padding tightens 10→8px.
**Why:** Brand is identity for the login screen, redundant when logged in (avatar shows your name, browser tab already says "Team OS", URL is `/team-os/`). "Not logged in" is redundant with the "Sign in to Team OS" card below.
**Files:** `src/views/header.js`, `src/styles.css`
**Tests:** Existing 21 header tests + 3 visual snapshots (logged-out, logged-in, mobile).

## 2026-07-01 — Refactor: remove presence strip from Board
**What:** Removed the "● Nilesh · 1 open" row above the kanban. Moved the status dot into the task owner badge itself, inline.
**Why:** Audited each piece — 2/3 redundant. Status is the only unique info; it now travels with the work.
**Files:** `src/views/board.js`, `src/styles.css`
**Tests:** All 80 tests pass; visual snapshot `vite-board.png` shows status dots next to each owner.

## 2026-07-01 — Title input as the hero in task modal
**What:** Title input: 22px bold, borderless, focus glow. New `.modal-divider` separates hero from details. Autofocus on open; select-all on edit. Modal h3 demoted to a 12px uppercase section label.
**Why:** User: "form hone hi turant mujhe save toh dabana he nahi toh woh important nahi he. title capture hona chaiye." Title is the action; everything else is metadata.
**Files:** `src/views/board.js`, `src/styles.css`, `tests/modal-title.test.js`
**Tests:** 9/9 — focus on #tt, first keystroke lands in title, size 22px > 14px, weight 600 > 400, divider present.

## 2026-07-01 — Refined modal: compact inputs + violet brand + transitions
**What:** Compact 38px inputs, 14px text, 8px radius, smooth focus glow (violet ring 3px). Custom select chevron (color shifts to brand on hover). Primary buttons: violet gradient (#7c6cf7 → #6e5ce7). Tabs: animated gradient underline. Modal: entrance animation. Toast: slide-up animation. prefers-reduced-motion respected.
**Why:** "Each pixel should serve a purpose." Blue was harsh. Forms had no rhythm. Motion was jarring.
**Files:** `src/styles.css` (full rewrite, 109→161 lines but each line is purposeful)
**Tests:** All 60+ tests pass.

## 2026-07-01 — Fix: prevent double-save duplicate
**What:** Added a `saving` flag in the save handler. First click disables the button, changes label to "Saving…", re-enables only on error.
**Why:** User: "Save pe click kiya do baar and do same task ban gaye." Async handler had no guard.
**Files:** `src/views/board.js`, `tests/double-save.test.js`
**Tests:** 6/6 — clicks Save 5x rapidly with 400ms PATCH delay, asserts only 1 PATCH and 1 task.

## 2026-07-01 — Fix: add-task TypeError in prod (modal is not a function)
**What:** Added missing imports in `views/board.js`: `val, toast, uid, modal, closeModal` from util; `proposeChange` from propose; `writeFile, getGist` from gist.
**Why:** Vite dev's HMR tolerated missing globals; Rollup's prod minify didn't → `TypeError: modal is not a function` on +add click.
**Files:** `src/views/board.js`, `tests/add-task.test.js`
**Tests:** 10/10 — modal opens, save → PATCH with correct payload, toast appears, no errors.

## 2026-07-01 — Port to Vite + pnpm + GitHub Actions
**What:** 827-line single file → 19 module files. HMR, source maps, ESM. Deployment: GitHub Actions builds `dist/` on push to main, deploys to Pages.
**Why:** User: "isko agar vite me port karde toh development fast hoga na." Cache-bust workarounds were the biggest pain.
**Files:** All of `src/`, `vite.config.js`, `package.json`, `.github/workflows/deploy.yml`, `pnpm-lock.yaml`
**Tests:** Migrated to new URL (Vite serves on :5173/team-os/, prod on :5173/team-os/ via `pnpm preview`). Test infra reads `TEAM_OS_URL` env var.

## 2026-07-01 — Fix: proposeChange lead path (the original bug)
**What:** `proposeChange()` lead path was calling `req.apply(state)` — no caller ever passed an `apply` function. Switched to `applyRequestToState()` which already knew all four request types.
**Why:** Every lead-initiated change silently threw `TypeError: req.apply is not a function`. Lead couldn't add task, move task, edit member, or request leave.
**Files:** `src/propose.js`
**Tests:** All existing tests pass (which they should have, but didn't because the test data shape was wrong — fixed in the same port).
