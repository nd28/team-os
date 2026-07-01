# Team OS

A zero-backend team management board for a small dev team, deployed on GitHub Pages with a GitHub Gist as the data store.

- **Board**: Kanban with ownership, priority, deadlines.
- **Team**: Workload meters, presence/last-seen, responsibilities, geolocation check-ins.
- **Leaves**: Request → lead approval, visible to all (work-life balance transparency).
- **Approvals**: Every developer change goes to the lead for approval (unification mechanism).
- **Access control**: Lead (PAT) manages 4 developers' credentials & rights.

## Links
- App: `https://nd28.github.io/team-os/#gist=<GIST_ID>`
- Gist (data): see your gist URL. Gist id is encoded in the app URL hash.

## Run / deploy
No build step. Push `index.html` to `main` — GitHub Pages serves it.

## Docs
- [USER_STORIES.md](USER_STORIES.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
