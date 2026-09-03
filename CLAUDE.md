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

- `engine/store.js` is the storage abstraction. Same API either way: **Firebase Firestore** when `window.IS_LIVE`, **localStorage** otherwise. Everything is namespaced by `window.LESSON_ID` (set in `lesson.config.js`), so one Firebase project serves every presentation — a new presentation needs no Firebase setup, just a unique lesson id. In live mode a failed Firebase init resolves `{failed: true}` and both pages render a reconnect screen — **never** re-add a silent localStorage fallback there; it made phones collect votes that never reached the projector.
- **Voting is ack-gated.** `vote.js` marks a stage voted and shows "your vote is in" only after Firestore confirms the write; a >4s wait shows an honest "still sending" state (`pending` flag in the voted record — the SDK keeps the write queued); a rejection reopens the question with a retry message. Never mark voted before the ack.
- **The Firebase keys in `generate.js` are public by design.** Security lives entirely in the Firestore rules, which use wildcard matches (`.+_votes`, `.+_posters`).
- **Teacher gate:** being signed in is not enough — after auth, `results.js` calls `store.probeControl()` (a harmless merge write to the state doc, which the rules only accept from the teacher's account) and only unlocks the controls if it succeeds. A wrong Google account is told so in plain English.
- **Epoch and stageReset:** `clearVotes()` bumps an epoch counter on the state doc — phones see it and wipe all their `_voted_` flags. `clearVotesForStage(id)` instead stamps `stageReset: {stage, nonce}` — phones clear just that one stage's flag, which is what the projector's "Re-run question" button uses. The field holds ONE stamp: a phone offline across re-runs of two *different* questions only unlocks the later one (known, accepted; a full Reset covers it). Phones baseline the nonce on their first snapshot and act only on changes seen while connected.
- Phones that sleep or drop WiFi suspend their Firestore listener. `refreshStage()` / `refreshVotes()` exist so `vote.js` and `results.js` can resync on wake — do not remove those call sites.
- Both engines expose `window.__previewRefresh(stages)` so the builder preview can update content without reloading the iframe. Harmless in production; don't remove it.

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

### Builder conventions

- **No native dialogs.** `prompt()`/`alert()`/`confirm()` are banned; use `dialog()` and `toast()` from `ui.js`. Toast supports an action button (used for Undo).
- **Destructive edits snapshot first.** Call `snapshotUndo(label)` (app.js) — or `ctx.snapshot(label)` from a panel — before deleting anything; Cmd/Ctrl+Z and the toast's Undo restore it.
- **Names collide loudly.** `askName()` checks drafts and the published manifest before accepting a slug; `onSlugChange` *migrates* the draft + IndexedDB media to the new key (the old behaviour forked a ghost draft per keystroke).
- **Publish is a three-beat flow** (`doPublish`): upload with progress → `waitForDeploy` polls the served `presentation.json?probe=<ts>` for the `publishedAt` stamp (fresh query = fresh CDN cache key) → success dialog with cache-busted links. `publishPresentation` returns `{url, publishedAt}`; `publishedAt` lives only in the committed presentation.json, not the editable spec (`duplicate()` strips it).
- The preview has two refresh paths: `refreshPreviewContent()` posts into the running iframe via `__previewApply` (content edits — never reloads); `refreshPreview()` reloads the frame (mode/slide/structure changes).
- `deletePresentation(slug)` removes a published folder with one commit of `sha: null` tree entries plus a manifest update.

### Draft storage in the builder

Specs go in `localStorage` (`builder_draft_<slug>`); **media goes in IndexedDB** via `builder/lib/media-store.js`. This split is not stylistic — an imported deck is tens of megabytes of data URLs and blows the ~5MB localStorage quota. `state.mediaBlobs` is a Proxy so any write flags the draft dirty; pass a plain object to `saveMedia()` (structured clone). For the same reason `previewStages()` inlines data URLs only for the **selected** stage — inlining all of them overflows sessionStorage.

## Learning modules (`/vo2max/`)

Hand-written, **not** builder-generated, and unrelated to the presentation platform. `/vo2max/` is a hub page listing modules; each module lives in its own folder (`01-why-vo2max-matters/`). Vanilla ES modules, no build step, loaded with `<script type="module">`.

```
vo2max/
  index.html          hub
  module.css          all module styling; loaded AFTER /styles.css, adds no new site tokens
  lib/                svg.js (scales/axes/paths), figure.js (accessible <figure> + controls),
                      reveal.js (progress bar, scroll reveal, nav, focus mode), quiz.js
  tools/              fetch-pubmed.sh, convert-trends.py — regenerate the data files
  01-.../
    index.html        prose and mount points only
    data.js           EVERY number, each with a source comment
    pubmed-data.js    GENERATED by tools/fetch-pubmed.sh
    trends-data.js    GENERATED by tools/convert-trends.py from a manual CSV export
    module-01.js      wires interactives to mount points; lists what is parked
    interactives/     one file per chart, including parked ones
```

- **`data.js` is the single source of truth.** No chart hardcodes a value. Numbers read off a published figure rather than a printed table are flagged `approx: true` and labelled as approximate in the UI. Do not add a number without a source comment.
- **Charts are hand-built inline SVG.** No chart library, matching the site's no-dependency rule. They follow the same accessible-figure pattern as the homepage collaboration map: `role="img"` + `aria-label`, `aria-hidden` SVG, `<figcaption>`, and a `<details>` data table.
- **A real photo or screenshot is a plain `<img>` in a `<figure>`, not SVG.** The rule above is for charts built from data — an actual exhibit (e.g. `01-why-vo2max-matters/garmin-vo2max-gauge.png`, a cropped screenshot of a Garmin VO2max screen) just needs `alt` text and a `<figcaption>`; it does not need the `role="img"`/data-table treatment, since a real `alt` attribute already is the text alternative.
- **Chart colours reuse existing tokens**: `--primary-color` for protective/fitter, `--collab-applied` (#c2410c, already declared for the collaboration figure) for risk, `--text-light` for reference. No new palette.
- **Charts render lazily** on first scroll into view, via `onFirstView()`. `revealOnScroll()` also sweeps for anything already on screen at load — without that sweep a deep link or focus mode leaves the chart blank forever.
- **`.v-chart` scrolls horizontally** and its SVG has `min-width: 560px`. Chart text is sized in viewBox units, so a 760-wide chart on a 340px phone would render 12px labels at ~5px. Scrolling keeps them legible; do not remove the min-width without solving that.
- **SVG font sizes must be set via `style`, not the `font-size` attribute** — `module.css` sets `.v-chart text { font-size: 12px }` and a CSS rule beats a presentation attribute.
- **Animated bars need `transform-box: fill-box`.** SVG transform-origin resolves against the viewBox otherwise, so `scaleY(0)` launches a bar from the bottom of the whole chart.
- **`?focus=<section-id>`** dims everything but one section for screen recording. It force-renders every chart first, disables `history.scrollRestoration`, and overrides `scroll-behavior: smooth` for one instant jump — all three are required or it lands in the wrong place with a blank chart.
- Every interactive is wrapped in try/catch in `module-01.js`, so one failure cannot blank the others.
- Figures are **rebuilt from the published numbers**; none of the journal's artwork is copied.

### Parked interactives

Module 1 was cut back from eleven sections to eight. The removed interactives are **still in `interactives/` and still parse** — they are simply not wired up. `module-01.js` opens with a list of what is parked and the one line that restores each. Do not delete them, and keep them syntax-checking when touching shared helpers in `lib/`. The full version is in the commit *"VO2max learning module: full build before strip-back"*.

### The two generated data files

- **`pubmed-data.js`** — `tools/fetch-pubmed.sh` counts PubMed records per year via NCBI E-utilities (free, no key under 3 req/sec). Takes about two minutes. Two traps it documents and guards: the current year is always partially indexed, so the series must end at a completed year; and PubMed only began storing abstracts consistently in **1975** (under 6% of earlier records have one, against over 40% after), so a Title/Abstract search finds almost nothing before then. The chart plots from 1975 for that reason and keeps the earlier years in the data table, flagged.
- **`trends-data.js`** — Google publishes no Trends API, so the data is a manual CSV export converted by `tools/convert-trends.py`. Until someone does that, the file is a stub with `ready: false` and the chart renders instructions instead of a broken figure. Trends values are a 0–100 index of *relative* interest, not counts, and cannot be compared across separate exports.

Both generated files carry their queries and fetch date in the header, so any number on the page can be traced back.

## Gotchas

- **`wcweather/` is a frozen, fully self-contained copy of an older engine** — its own `store.js`, `results.js`, `styles.css`, everything. It does *not* load `../engine/`. Changes to `engine/` have no effect on it, and it is not in `presentations.json`. Treat it as an archived lesson, not as code to keep in sync.
- **An edit to `engine/` changes every published presentation, including ones published long ago.** They all link `../engine/*.js`, and GitHub Pages serves everything with `Cache-Control: max-age=600`, so a push reaches all of them within ~10 minutes. There is no per-presentation pinning — the `?v=<token>` in a presentation's markup only guarantees that *it* picks up the current engine the moment it is published. Treat any engine change as site-wide and test it before pushing.
- **After deploying a change, hard-reload before concluding it failed.** Same 10-minute cache: the builder's own modules carry no cache-buster, so `builder/index.html` will keep running the previous `lib/app.js` for up to 10 minutes. A new feature genuinely appears only after Cmd/Ctrl+Shift+R.
- `builder/preview.html` passes the editor's cache-buster down to the engine files. Without it the preview silently runs a stale engine, which is indistinguishable from your change being broken.
- Third-party code is **vendored**, not CDN-loaded: `builder/vendor/` (pdf.js, JSZip), `engine/vendor/` (html2canvas). The only runtime externals are the Firebase SDK from `gstatic.com` and the `qrcode` lib from jsDelivr on the projector page.
- `robots.txt` disallows `/builder/`, and generated presentation pages carry `noindex`.
- `.gitignore` excludes `*.pdf` and `*.docx`, so test decks dropped in the repo will not be committed — but delete them anyway rather than relying on it.

## Personal site

`index.html` is a single hand-written 2,000-line page with inline JSON-LD blocks and runtime `fetch()` calls to the OpenAlex API for live publication metrics. Three files describe the same person for different audiences and **drift apart unless updated together**: `index.html` (humans + JSON-LD), `resume.json` (JSON Resume schema, linked via `<link rel="alternate">` and not read by the page), and `llms.txt` (AI crawlers). A change to roles, metrics or projects belongs in all three.

The comment block at the top of `index.html` is a manual off-site checklist (LinkedIn, ORCID, Scholar). It is a to-do list for the user, not instructions for you.
