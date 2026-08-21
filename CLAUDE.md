# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

`aprofrudd.github.io` is served by GitHub Pages at **alanruddock.com** (see `CNAME`). It holds two unrelated things:

1. **A personal academic site** — `index.html`, `styles.css`, `resume.json`, `llms.txt`, `sitemap.xml`.
2. **A classroom polling platform** — `engine/`, `builder/`, and one folder per published presentation. A self-hosted Mentimeter alternative: students vote on their phones, live results appear on the projector, the teacher paces the stages.

There is **no build step, no package manager, no test framework, and no CI**. Every file is served exactly as committed. Everything is vanilla ES modules and classic scripts.

## Commands

```bash
# Preview locally — the ONLY correct way to open the builder or a presentation.
# ES modules and fetch() of presentation.json both fail under file://
python3 -m http.server 8765
# then http://localhost:8765/builder/  or  http://localhost:8765/<slug>/results.html

# Syntax-check changed JS (there is no linter). ES modules need the .mjs extension:
node --check engine/results.js                     # classic scripts
cp builder/lib/app.js /tmp/app.mjs && node --check /tmp/app.mjs   # ES modules
```

**Verifying a change.** There are no automated tests, so nothing can be "run" to prove a change works. The real loop is: start the server, open the builder, use the Projector/Phone preview toggle, and check the browser console. For engine changes, drive an actual presentation at `/<slug>/results.html` (projector) with `/<slug>/` (phone) open in a second window — in local dev `store.js` falls back to `localStorage` and the two windows sync via the `storage` event, so one machine is enough to test voting.

Commit messages are short sentence-case descriptions of the change ("Nav scroll spy, QAA homepage link, Boxing Science date"). No prefix convention.

## Presentation platform architecture

Three layers, and knowing which one you are editing matters:

```
engine/          shared runtime, loaded by every published presentation via ../engine/
builder/         authoring app — spec editor + preview + one-click publish
<slug>/          a published presentation: GENERATED files + media, links to ../engine/
presentations.json   manifest of published presentations (the builder dashboard reads it)
```

### The spec is the source of truth

A presentation is one JSON object (`slug`, `title`, `theme`, `stages[]`). `builder/lib/generate.js` turns it into the seven files a presentation folder needs; `presentation.json` is committed alongside them so the builder can re-open and round-trip a published presentation.

**Never hand-edit `<slug>/stages.js`, `index.html`, `results.html`, `theme.css`, `lesson.config.js` or `firebase-config.js`.** They are generated and the next publish overwrites them. Edit in the builder, or edit `presentation.json` and re-publish.

### Publishing

`builder/lib/publish.js` writes directly to GitHub via the Git Data API: blobs → tree (on top of `base_tree`) → commit → patch ref. One atomic commit per publish, so `/engine/` and other presentations are carried forward untouched and the site is never half-updated. It needs a fine-grained GitHub token that the user pastes into the builder (kept in `localStorage`, never committed). `OWNER`/`REPO` are hardcoded to this repo — the builder cannot publish anywhere else.

### Runtime model

- `engine/store.js` is the storage abstraction. Same API either way: **Firebase Firestore** when `window.IS_LIVE`, **localStorage** otherwise. Everything is namespaced by `window.LESSON_ID` (set in `lesson.config.js`), so one Firebase project serves every presentation — a new presentation needs no Firebase setup, just a unique lesson id.
- **The Firebase keys in `generate.js` are public by design.** Security lives entirely in the Firestore rules, which use wildcard matches (`.+_votes`, `.+_posters`).
- **Teacher gate:** in live mode the Next/Back/Reset controls are locked until a Google sign-in. The rules only accept stage writes from the teacher's email, so a student who opens the projector URL can watch but not drive.
- **Epoch:** `clearVotes()` bumps an epoch counter on the state doc. Phones compare it against their stored epoch and wipe their local `_voted_` flags, which is what unlocks a phone after a teacher reset.
- Phones that sleep or drop WiFi suspend their Firestore listener. `refreshStage()` / `refreshVotes()` exist so `vote.js` and `results.js` can resync on wake — do not remove those call sites.

### Adding or changing a stage type

A stage type is not defined in one place. Touch all of these or it half-works:

| File | Role |
|---|---|
| `engine/results.js` | projector rendering (`renderStagePane`) **and** the results column (`renderResultsPane` — non-voting types must return early) |
| `engine/vote.js` | phone rendering (the `switch` in `render()`); non-voting types call `renderWait()` |
| `builder/lib/app.js` | `STAGE_TYPES`, `newStage()`, `defaultTitle()`, `validate()`, and `MEDIA_KEYS` if it references an image |
| `builder/lib/panels.js` | the edit panel and `TYPE_LABEL` |
| `engine/styles.css` | any new classes |

Current types: `content`, `mcq`, `slide`, `map`, `media`, `poster`. `poster` is not supported by the builder (`validate()` rejects it) — it only exists in the legacy wcweather lesson.

### Deck import

`builder/lib/import.js` turns an existing PowerPoint deck into stages. **PDF** (pdf.js) rasterises each page into a pixel-accurate `slide` stage; **.pptx** (JSZip) parses the OOXML for text, speaker notes and images into editable `content` stages. `[[poll]]` on a slide or in its notes makes it an `mcq`.

Two non-obvious constraints, both load-bearing:

- PDF pages are rendered with **`intent: 'print'`**. The default `display` intent steps through the operator list on `requestAnimationFrame`, which browsers stop firing in a backgrounded tab — an import would hang forever with no error.
- An imported poll stores its image as **`slideImage`, not `figure`**. `slideImage` means "this image *is* the whole slide", so the projector suppresses its own heading and option list rather than printing the question three times. `figure` means "a picture on the slide" and renders above a normally-drawn question.

### Draft storage in the builder

Specs go in `localStorage` (`builder_draft_<slug>`); **media goes in IndexedDB** via `builder/lib/media-store.js`. This split is not stylistic — an imported deck is tens of megabytes of data URLs and blows the ~5MB localStorage quota. `state.mediaBlobs` is a Proxy so any write flags the draft dirty; pass a plain object to `saveMedia()` (structured clone). For the same reason `previewStages()` inlines data URLs only for the **selected** stage — inlining all of them overflows sessionStorage.

## Gotchas

- **`wcweather/` is a frozen, fully self-contained copy of an older engine** — its own `store.js`, `results.js`, `styles.css`, everything. It does *not* load `../engine/`. Changes to `engine/` have no effect on it, and it is not in `presentations.json`. Treat it as an archived lesson, not as code to keep in sync.
- **Engine edits do not immediately reach already-published presentations.** Each presentation links `../engine/*.js?v=<token>` where the token is frozen at *its* publish time, so browsers keep serving the cached engine until that presentation is re-published. A shared-engine bugfix means re-publishing the presentations that need it.
- `builder/preview.html` passes the editor's cache-buster down to the engine files. Without it the preview silently runs a stale engine, which is indistinguishable from your change being broken.
- Third-party code is **vendored**, not CDN-loaded: `builder/vendor/` (pdf.js, JSZip), `engine/vendor/` (html2canvas). The only runtime externals are the Firebase SDK from `gstatic.com` and the `qrcode` lib from jsDelivr on the projector page.
- `robots.txt` disallows `/builder/`, and generated presentation pages carry `noindex`.
- `.gitignore` excludes `*.pdf` and `*.docx`, so test decks dropped in the repo will not be committed — but delete them anyway rather than relying on it.

## Personal site

`index.html` is a single hand-written 2,000-line page with inline JSON-LD blocks and runtime `fetch()` calls to the OpenAlex API for live publication metrics. Three files describe the same person for different audiences and **drift apart unless updated together**: `index.html` (humans + JSON-LD), `resume.json` (JSON Resume schema, linked via `<link rel="alternate">` and not read by the page), and `llms.txt` (AI crawlers). A change to roles, metrics or projects belongs in all three.

The comment block at the top of `index.html` is a manual off-site checklist (LinkedIn, ORCID, Scholar). It is a to-do list for the user, not instructions for you.
