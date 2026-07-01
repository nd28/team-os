# Team OS — Troubleshooting & Known Issues

## Setup (first time)
1. **Lead**: create a GitHub PAT at github.com/settings/tokens with scope **`gist`** only. Sign in → "Team Lead" → enter `nd28` + token.
2. **Lead → Manage tab**: set a password for each developer. Tell them their username (`dev1`…`dev4`) and password (e.g. via a private channel, not the WhatsApp group).
3. **Developer**: create their own GitHub PAT (scope `gist`). Sign in → "Developer" → username + password + their token.
4. **Pin on WhatsApp**: `https://nd28.github.io/team-os/#gist=<GIST_ID>` (the Manage tab shows this exact link).

## Common issues

### "Gist read failed: 404"
- The gist id in the URL is wrong or the gist was deleted. Re-paste the link. Current gist id is in the Manage tab.
- You are offline / GitHub API rate-limited (unauthenticated reads: 60 req/hr per IP). Wait a minute or sign in (authed reads: 5000/hr).

### "Gist write failed: 401 / 403"
- Token missing or expired. Re-enter it. Token must have **`gist`** scope.
- Developer tried to edit a task field that only the lead can edit → only status changes go to approval.

### Developer can't log in: "Lead has not set your password yet"
- Lead must open the **Manage** tab and set the developer's password first.

### Location not captured
- Browser denied geolocation. Click the location icon in the address bar → Allow. Or click **Check-in** again.
- iOS Safari requires HTTPS — GitHub Pages is HTTPS, so this works. If testing locally over `file://`, geolocation is blocked; use a local server.

### Approval didn't apply / board didn't update
- Approvals require the **lead's** token to be present. If the lead's token was cleared, re-enter it.
- The board auto-refreshes every 60s; you can also reload the page.

### Two people edit at once → one overwrite
- GitHub Gist PATCH replaces whole files. If a developer submits an approval while the lead is editing, the last write wins. Mitigation: the 60s refresh + the fact that most writes go through the single `pending_approvals.json` queue (serialized by the lead approving). For heavy concurrent editing, take turns.

## Known limitations / tradeoffs (by design)
1. **Public gist, not private.** A private gist cannot be read without a token, which breaks the "pin link, everyone sees board" WhatsApp UX. The gist contains no secrets. If you must hide the board from the public, switch the gist to private AND have every member enter a token before the first read (requires code change in `getGist()`).
2. **Client-side access control.** Developer write-scope is enforced by the app, not by GitHub. A developer who knows the API could PATCH board files directly with their PAT. This is a trusted-team tool. For hard enforcement, move to a server/proxy.
3. **Unsalted SHA-256 passwords.** Fine as a second gate on top of the mandatory PAT; not for real auth.
4. **Presence is a direct write (not approval-gated).** Otherwise the "who's around / who's on leave" feature couldn't be real-time. Only board/data changes are approval-gated.
5. **No offline mode.** Requires internet to read/write the gist.
6. **Gist file size.** Gist files are fine up to ~1MB each. For a 5-person team this is never a concern.

## How to reset everything
- Wipe browser data for the site (clears tokens/passwords locally).
- To reset data: ask the lead to edit the gist on github.com directly, or delete files and recreate via the app's first-run seed.

## Updating the app
- Just edit `index.html` and push to `main`. GitHub Pages serves it within ~30s. No build, no dependencies.
