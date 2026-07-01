# Team OS — System Architecture

## 1. Overview
Team OS is a **static single-page app** deployed on **GitHub Pages** that uses a **public GitHub Gist** as its data store. There is no server, no database, and no build step. The entire app is one file: `index.html`.

```
 ┌─────────────────────────────────────────────────────────────┐
 │                       Team OS Clients                         │
 │  Lead (browser)        Developer 1..4 (browsers)             │
 │  token: lead PAT       token: each dev's own PAT (gist)      │
 │  role: lead            role: developer                       │
 └───────────────┬───────────────────────────┬──────────────────┘
                 │ HTTPS (fetch)             │
                 ▼                           ▼
        ┌─────────────────────────────────────────────┐
        │          GitHub REST API (api.github.com)     │
        │   GET  /gists/<id>   → read (public, no auth) │
        │   PATCH /gists/<id>  → write (needs PAT)      │
        └──────────────────┬──────────────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────────────────┐
        │   Public Gist  (id encoded in URL #gist=…)    │
        │   ├─ auth.json            (roles + pwd hashes)│
        │   ├─ team.json            (members, presence) │
        │   ├─ tasks.json           (kanban)            │
        │   ├─ leaves.json          (leave requests)    │
        │   └─ pending_approvals.json (dev → lead queue)│
        └─────────────────────────────────────────────┘
```

## 2. Component map (inside index.html)
| Section | Responsibility |
|---|---|
| `boot()` / `init()` | Reads `#gist=<id>` from URL, loads gist, starts 60s auto-refresh |
| `getGist()` / `patchGist()` | GitHub REST I/O (read = no auth, write = PAT) |
| `loginLead()` / `loginDev()` | Role-based auth; dev password checked via SHA-256 hash in `auth.json` |
| `checkin()` | Geolocation permission + presence write (status, location, lastSeen) |
| `proposeChange()` | Core approval flow: lead applies directly; dev writes to `pending_approvals.json` |
| `approveChange()` / `rejectChange()` | Lead resolves a pending request; applies mutation + clears queue atomically |
| Views: `viewBoard / viewTeam / viewLeaves / viewApprovals / viewManage` | The 5 tabs |

## 3. Data model
- **auth.json** — `lead {username,name,role,passwordHash,rights}` + `developers[] {id,username,name,passwordHash,role,rights}`. Lead has no app password (uses PAT); devs use a password the lead sets.
- **team.json** — `members[] {id,name,role,responsibilities,status,workload,location,lastSeen}`.
- **tasks.json** — `tasks[] {id,title,owner,status,priority,deadline}` + `columns[]` + `priorities[]`.
- **leaves.json** — `leaves[] {id,member,from,to,reason,status}`.
- **pending_approvals.json** — `requests[] {id,type,file,fileKey,by,byName,createdAt,summary,payload}`.

## 4. Auth & access control
- **Reads**: public gist → no token needed → matches "pin on WhatsApp, everyone sees the board".
- **Lead writes**: lead's PAT (gist scope) stored in `localStorage`. Direct writes to any file.
- **Developer writes**: dev's own PAT (gist scope) stored in `localStorage`. The app **only ever writes `pending_approvals.json`** for a developer — never board data. The lead's approval is what mutates `tasks/leaves/team` files.
- **Passwords**: SHA-256 hashed in `auth.json`, set by lead in the Manage tab.

## 5. Approval flow (sequence)
```
Developer action (e.g. move task) ──▶ proposeChange()
        │
        ├─ isLead? ──▶ apply directly + write file  (no approval)
        │
        └─ dev ──▶ build request entry ──▶ PATCH pending_approvals.json
                                          (dev PAT)
                                           │
Lead opens Approvals tab ──▶ sees request ──▶ approveChange(id)
                                           │
                              ┌────────────┴─────────────┐
                              ▼                           ▼
                  apply mutation to real file     remove from pending
                              │                           │
                              └────── single PATCH gist (lead PAT) ──▶
```

## 6. Geolocation
- On login/check-in, `navigator.geolocation.getCurrentPosition` requests permission.
- Coords + timestamp are written to the member's `location`/`lastSeen` in `team.json`.
- **Design decision**: presence/check-in is a *direct write* (not approval-gated), because the "who is around / who is on leave" feature must be real-time. Board/data changes remain approval-gated. See `TROUBLESHOOTING.md` § tradeoffs.

## 7. Security model & tradeoffs
| Concern | Decision |
|---|---|
| Gist visibility | **Public** (so the pinned link works without tokens). No secrets are stored in the gist — only team-internal board data. |
| Token storage | Browser `localStorage` per user. Sent only to `api.github.com` over HTTPS. |
| Developer write scope | Enforced client-side to `pending_approvals.json` only. A malicious dev with a PAT could technically PATCH other files — this is a **trusted small team** design, not a hard sandbox. Documented limitation. |
| Passwords | SHA-256 (not salted). Acceptable for app-level gating on top of the PAT requirement; not for high-security auth. |

## 8. Deployment
- Repo: `nd28/team-os`, branch `main`, served via **GitHub Pages** from root.
- URL: `https://nd28.github.io/team-os/#gist=<gist_id>`
- No CI, no build. Edit `index.html` → push → live.
