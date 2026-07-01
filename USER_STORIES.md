# Team OS — User Stories

## 1. Roles & Access Control
- **US-1.1 — As the Team Lead**, I want to log in with my GitHub PAT (gist scope) so that I can read and write the team board directly.
- **US-1.2 — As the Team Lead**, I want to manage 4 developers' app credentials (username + password) so that only known team members can propose changes.
- **US-1.3 — As a Developer**, I want to log in with my username, password (set by lead), and my own GitHub token (gist scope) so that I can view the board and submit changes for approval.
- **US-1.4 — As the Team Lead**, I want my role to have rights `[read, write, approve, manage]` and developers to have `[read, propose]`, so that access control is explicit and centralized with me.

## 2. Onboarding / Sharing
- **US-2.1 — As the Team Lead**, I want a single link (`https://nd28.github.io/team-os/#gist=<gist_id>`) with the gist id encoded in the URL hash, so that I can pin it on the WhatsApp group and anyone can open the board with zero setup.
- **US-2.2 — As a Developer**, I want to open the pinned link and instantly see the team board (no token needed to read), so that onboarding is frictionless.

## 3. Kanban / Workload
- **US-3.1 — As any team member**, I want to see a Kanban board (backlog → in-progress → review → done) with every task's owner, priority and deadline, so that I understand who is doing what.
- **US-3.2 — As any team member**, I want to see each person's open-task count and a workload meter, so that imbalance is visible and we can help each other.
- **US-3.3 — As a Developer**, I want to move my task to a new status and have it sent to the lead for approval, so that the board reflects reality but the lead stays in control.
- **US-3.4 — As the Team Lead**, I want to add, edit and delete tasks directly, so that I can structure the team's work.
- **US-3.5 — As any team member**, I want tasks near or past their deadline highlighted, so that I can offer help to the owner.

## 4. Team Presence, Leaves & Work-Life Balance
- **US-4.1 — As any team member**, I want to see each member's status (active / remote / away / on-leave) and last-seen time, so that I know who is around and who is off.
- **US-4.2 — As any team member**, I want my geolocation captured on check-in (with my permission) and shown as a map link, so that the team has presence awareness.
- **US-4.3 — As a Developer**, I want to request leave (from / to / reason) which goes to the lead for approval, so that leaves are transparent and planned.
- **US-4.4 — As the Team Lead**, I want to approve or reject leave requests, so that I can balance coverage.
- **US-4.5 — As any team member**, I want to see all upcoming deadlines in one list, so that the team can rally around approaching work.

## 5. Approval Flow (Core unification mechanism)
- **US-5.1 — As a Developer**, I want every data change I make (task status, leave request, profile update) to be submitted as a pending approval, never written directly to board data, so that the lead knows everything and can guide the team.
- **US-5.2 — As the Team Lead**, I want a single Approvals tab showing all pending requests (who, what, when) with Approve / Reject actions, so that I can keep the team aligned.
- **US-5.3 — As the Team Lead**, when I approve a request I want the change applied to the real data file and removed from pending, in one atomic gist update, so that the board stays consistent.

## 6. Non-Functional
- **US-6.1 — As any team member**, I want the app to be mobile-friendly (bottom-nav-style tabs, responsive kanban) and desktop-friendly, so that I can use it from my phone on WhatsApp or my laptop.
- **US-6.2 — As any team member**, I want the board to auto-refresh every 60 seconds, so that I see the latest team state without manual reload.
- **US-6.3 — As the Team Lead**, I want all secrets (tokens) to stay in each user's browser localStorage and never be sent anywhere except GitHub's API, so that credentials are safe.
- **US-6.4 — As the Team Lead**, I want minimal code (a single self-contained `index.html`) and zero build step, so that maintenance is trivial and deployment is just a git push.
