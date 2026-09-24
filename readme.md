# misa.lol — Profile Editor

A small full-stack editor for one fictional profile. Built for the misa.lol
full-stack developer trial.

## Stack

- **Backend:** Node.js + Express 4 (in-memory storage, no DB)
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Runtime:** Node.js **18 or newer** (uses `URL`, optional chaining, etc.)

I chose vanilla JS + Express to keep the surface area small and make the
walkthrough easy to follow. There's no bundler — `npm install && npm start`
and go.

## Install & run

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

(The port can be overridden with `PORT=4000 npm start`.)

## What works

- Loads the starting profile from `GET /api/profile` on page load.
- Four labeled fields (display name, bio, link label, link URL) with a live
  preview beside them. Preview updates as you type.
- Entered text is treated as **plain text** in the preview (`textContent`,
  never `innerHTML`).
- The preview link only becomes clickable when the URL is a valid absolute
  `https://` URL with a hostname. Otherwise it renders as non-clickable text.
- **Save** sends `PUT /api/profile`. The button is disabled while the request
  is in flight, and a "Saving…" status is shown.
- On success, the server's echoed profile is written back into the form and
  a brief "Saved." status appears.
- On failure, the form entries are **preserved** and an error banner explains
  what happened.
- Server-side validation enforces all four rules. Malformed JSON returns
  `400` with a JSON error body instead of crashing.
- Layout is responsive (single column under 720px) and keyboard-accessible
  (native form controls, visible focus outlines, `aria-invalid` /
  `aria-describedby` for errors, `role="alert"` and `aria-live` for banners).

## Validation rules (enforced on the server)

After trimming:

| Field        | Rule                                                      |
|--------------|-----------------------------------------------------------|
| displayName  | string, 1–40 characters                                   |
| bio          | string, 0–160 characters (empty allowed)                  |
| link.label   | string, 1–30 characters                                   |
| link.url     | absolute `https://` URL with a hostname                   |

Non-string types, missing fields, and malformed JSON all produce `400`.
String length uses JavaScript's normal convention (UTF-16 code units).

### Error response shape

```json
{
  "error": "Validation failed",
  "details": {
    "displayName": "Display name must be 1–40 characters after trimming.",
    "link.url": "Link URL must be an absolute https:// URL with a hostname."
  }
}
```

Malformed JSON:

```json
{
  "error": "Malformed JSON",
  "details": { "_": "Request body could not be parsed as JSON." }
}
```

## Time spent

Approximately **70 minutes**:

- ~10 min: planning, stack choice, project layout.
- ~40 min: implementation (server validation + routes, then frontend form,
  preview, save flow).
- ~15 min: manual verification (below) and handoff notes.
- ~5 min: README.

## Verification

### 1. Successful save followed by a browser refresh

1. `npm install && npm start`, open <http://localhost:3000>.
2. Edit the fields, e.g.:
   - Display name: `Nova (edited)`
   - Bio: `Testing the save flow.`
   - Link label: `My site`
   - Link URL: `https://example.org/hello`
3. Click **Save**. Status shows "Saving…" then "Saved." The Save button is
   disabled while the request is in flight.
4. Refresh the browser. The form reloads with the edited values, and the
   preview shows them. Confirms persistence in server memory.

### 2. Invalid request sent directly to the API

With the server running, in a second terminal:

```bash
curl -i -X PUT http://localhost:3000/api/profile \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"","bio":"x","link":{"label":"","url":"javascript:alert(1)"}}'
```

Expected: `HTTP/1.1 400 Bad Request` with a JSON body listing the failing
fields (`displayName`, `link.label`, `link.url`).

Then confirm the stored profile is **unchanged**:

```bash
curl -s http://localhost:3000/api/profile
```

You should still see the profile you saved in step 1 — the rejected request
did not modify server state.

Malformed JSON check:

```bash
curl -i -X PUT http://localhost:3000/api/profile \
  -H 'Content-Type: application/json' \
  -d '{not json'
```

Expected: `400` with `{"error":"Malformed JSON", ...}`. The server keeps
running.

### 3. Other cases worth trying

- `http://example.com` → rejected (wrong scheme).
- `data:text/html,...` → rejected.
- `https://` (no host) → rejected.
- Whitespace-only display name → rejected after trim.
- Bio left blank → accepted (0 chars is allowed).

## Tradeoffs and production improvements

**Tradeoff:** I mirror the server's validation rules in the browser for
instant feedback, and re-run the same logic on the server as the source of
truth. That duplicates the URL check in two places (JS on both sides here,
but conceptually two places). The alternative — only server-side validation —
gives a slower feedback loop and worse UX for obvious mistakes like an empty
name. I chose the small duplication for a much better editing experience,
and kept both copies short and obviously parallel so they're easy to keep in
sync. (In a real app I'd share the validator as a module used by both sides.)

**First production improvement:** replace the in-memory store with a real
database (e.g., Postgres) and wrap the PUT in a transaction, so concurrent
updates don't race and data survives restarts. Close behind: authentication
and a per-user profile, since the real product has multiple users.

## Starter code, libraries, AI tools

- **Starter code:** none — built from scratch, using the standard Express
  static-file + JSON middleware pattern documented in the Express README.
- **Libraries:** `express` only. No frontend libraries or build tools.
- **AI tools:** I used an AI assistant to sanity-check the URL validation
  approach (specifically the `new URL()` + protocol/hostname checks) and to
  review the error-handling middleware order in Express. I verified the
  suggestions by running the manual checks above, including sending
  malformed JSON and `javascript:` URLs with `curl`.

## Known limitations / unfinished

- No automated tests (the exercise says a clear manual check is sufficient).
- No CSRF protection (out of scope; would matter in production).
- No request logging (also out of scope).
- Client and server validate separately; a shared validator module would be
  the first refactor.