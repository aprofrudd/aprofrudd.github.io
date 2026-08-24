// Presentation builder - main controller. Hash-routed single page:
//   #/                dashboard (list / new / open / duplicate)
//   #/edit/<slug>     editor (slide list + live preview + edit panel)
//
// State lives in memory + a localStorage draft per slug. Publishing (publish.js)
// turns the spec into committed files; here we author and preview.

import { el, button, debounce, kebab, dialog, toast } from './ui.js';
import { DEFAULT_THEME, themeCss } from './theme.js';
import { engineStages, buildPresentationFiles } from './generate.js';
import { stagePanel, themePanel, settingsPanel } from './panels.js';
import { publishPresentation, getToken, setToken, clearToken, fetchManifest,
         validateToken, deletePresentation, waitForDeploy, friendlyPublishError } from './publish.js';
import { loadMedia, saveMedia, deleteMedia, mediaBytes, setMediaErrorHandler } from './media-store.js';
import { importDeck, IMPORT_ACCEPT } from './import.js';

const root = document.getElementById('app');
const DRAFT_PREFIX = 'builder_draft_';

let state = null;   // { spec, mediaBlobs, selected, mode, tab, published }

// ---- drafts ----------------------------------------------------------------

let saveFailed = false;
function saveDraft() {
  if (!state || !state.spec.slug) return;
  try {
    // Spec only. Media lives in IndexedDB (media-store.js) because an imported
    // deck is tens of megabytes of data URLs and would blow localStorage.
    localStorage.setItem(DRAFT_PREFIX + state.spec.slug,
      JSON.stringify({ spec: state.spec, published: state.published,
                       publishedHash: state.publishedHash }));
    if (saveFailed) { saveFailed = false; syncSaveWarn(); }
  } catch (e) {
    // Losing work silently is the one unforgivable failure - say so in the UI.
    console.warn('draft save failed (quota?)', e);
    if (!saveFailed) { saveFailed = true; syncSaveWarn(); }
  }
  if (state.mediaDirty) {
    state.mediaDirty = false;
    saveMedia(state.spec.slug, Object.assign({}, state.mediaBlobs));
  }
}
function syncSaveWarn() {
  const w = document.getElementById('b-save-warn');
  if (w) w.hidden = !saveFailed;
}
setMediaErrorHandler((op) => {
  toast(op === 'save'
    ? "Images couldn't be saved in this browser (storage full?) - publish soon so they aren't lost."
    : "Some stored images couldn't be loaded - re-add any that show broken.");
});

// Cheap stable hash of the spec, kept from the last publish so the dashboard
// can say whether a draft has unpublished changes.
function specHash(spec) {
  const str = JSON.stringify(spec);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h);
}

function escapeHtml(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- undo ------------------------------------------------------------------
// Snapshots taken before destructive edits (slide/option deletion, imports).
// Cmd/Ctrl+Z outside a text field, or the Undo button on the toast.
let undoStack = [];
function snapshotUndo(label) {
  if (!state) return;
  undoStack.push({ label, slug: state.spec.slug,
                   spec: JSON.parse(JSON.stringify(state.spec)),
                   selected: state.selected });
  if (undoStack.length > 30) undoStack.shift();
}
function undoLast() {
  const snap = undoStack.pop();
  if (!snap || !state) return;
  if (snap.slug !== state.spec.slug) { undoStack.push(snap); return; }
  state.spec = snap.spec;
  state.selected = Math.min(snap.selected, snap.spec.stages.length - 1);
  saveDraftDebounced();
  renderEditor();
  refreshPreview();
  toast('Undone: ' + snap.label);
}
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key !== 'z' || e.shiftKey) return;
  const t = e.target.tagName;
  if (t === 'INPUT' || t === 'TEXTAREA') return;   // native undo in fields
  if (!state) return;
  e.preventDefault();
  undoLast();
});
// Media changed (import, image pick) - mark it for the next draft save.
function touchMedia() { if (state) state.mediaDirty = true; }
const saveDraftDebounced = debounce(saveDraft, 400);

function loadDraft(slug) {
  try { return JSON.parse(localStorage.getItem(DRAFT_PREFIX + slug) || 'null'); }
  catch (e) { return null; }
}
// Draft + its media. Older drafts kept mediaBlobs inline in localStorage; if we
// find one, move it into IndexedDB and rewrite the draft without it.
async function loadDraftFull(slug) {
  const d = loadDraft(slug);
  if (!d) return null;
  if (d.mediaBlobs && Object.keys(d.mediaBlobs).length) {
    await saveMedia(slug, d.mediaBlobs);
    const media = d.mediaBlobs;
    delete d.mediaBlobs;
    try { localStorage.setItem(DRAFT_PREFIX + slug, JSON.stringify(d)); } catch (e) {}
    return { spec: d.spec, published: d.published, mediaBlobs: media };
  }
  return { spec: d.spec, published: d.published, mediaBlobs: await loadMedia(slug) };
}
function listDrafts() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(DRAFT_PREFIX)) {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        out.push({ slug: k.slice(DRAFT_PREFIX.length), spec: d.spec,
                   published: d.published, publishedHash: d.publishedHash });
      } catch (e) {}
    }
  }
  return out;
}

// mediaBlobs is written to by several places (import, the image picker, the
// theme background). Rather than remembering to flag each one, proxy the map so
// any write marks the media dirty and the next save persists it.
const watchedMedia = new WeakSet();
function watchMedia(obj) {
  if (!obj || watchedMedia.has(obj)) return obj;   // don't re-wrap on every open
  const proxy = new Proxy(obj, {
    set(t, k, v) { t[k] = v; if (state) state.mediaDirty = true; return true; },
    deleteProperty(t, k) { delete t[k]; if (state) state.mediaDirty = true; return true; }
  });
  watchedMedia.add(proxy);
  return proxy;
}

function newSpec(name) {
  const slug = kebab(name);
  return {
    slug, lessonId: slug, title: name,
    kicker: '', heading: name, projectorHeading: name,
    lessonUrl: 'alanruddock.com/' + slug,
    theme: JSON.parse(JSON.stringify(DEFAULT_THEME)),
    stages: []
  };
}

// ---- media substitution for preview ----------------------------------------

function substMedia(path) {
  if (!path) return path;
  if (state.mediaBlobs && state.mediaBlobs[path]) return state.mediaBlobs[path];
  // Reopening a published presentation on a machine with no local media: the
  // images already live in the published folder, so point there instead of
  // rendering every thumbnail broken.
  if (state.published && /^media\//.test(path)) return '../' + state.spec.slug + '/' + path;
  return path;
}
const MEDIA_KEYS = ['figure', 'sideFigure', 'poster', 'video', 'image', 'slideImage'];

function previewStages() {
  // Inlining every stage's data URL would overflow sessionStorage on an
  // imported deck (tens of MB), so only the stage actually on screen gets its
  // media substituted - the rest keep their media/ paths and are never drawn.
  const sel = Math.max(0, state.selected);
  return engineStages(state.spec.stages).map((s, i) => {
    const c = Object.assign({}, s);
    if (i === sel) MEDIA_KEYS.forEach(k => { if (c[k]) c[k] = substMedia(c[k]); });
    return c;
  });
}
function previewThemeCss() {
  const t = state.spec.theme || {};
  if (t.background && t.background.type === 'image' && t.background.src) {
    return themeCss(Object.assign({}, t, { background: Object.assign({}, t.background, { src: substMedia(t.background.src) }) }));
  }
  return themeCss(t);
}

// ---- routing ---------------------------------------------------------------

function route() {
  // Leaving the editor must not drop the last ~400ms of edits sitting in the
  // save debounce - flush first.
  if (state) saveDraft();
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/edit\/(.+)$/);
  if (m) openEditor(decodeURIComponent(m[1]));
  else renderDashboard();
}
window.addEventListener('pagehide', () => { if (state) saveDraft(); });
window.addEventListener('beforeunload', () => { if (state) saveDraft(); });

// ---- dashboard -------------------------------------------------------------

let lastManifest = [];
async function ensureManifest() {
  try { lastManifest = await fetchManifest(); } catch (e) {}
  return lastManifest;
}
// Where is this name already in use? Returns a human phrase, or null if free.
function slugTaken(slug) {
  if (loadDraft(slug)) return 'a draft in this browser';
  if (lastManifest.some(p => p.slug === slug)) return 'published on the site';
  return null;
}

async function renderDashboard() {
  state = null;
  root.innerHTML = '';
  const page = el('div', 'b-dash');

  const head = el('header', 'b-dash-head');
  head.appendChild(el('h1', null, { text: 'Presentation builder' }));
  head.appendChild(tokenChip());
  page.appendChild(head);

  const actions = el('div', 'b-dash-actions');
  actions.appendChild(button('+ New presentation', createNew, 'b-btn--primary'));
  actions.appendChild(button('\u2191 Import a deck', importNew, 'b-btn--ghost'));
  actions.appendChild(el('span', 'b-dash-hint', { text: 'PowerPoint (.pptx) or a PDF export of your slides' }));
  page.appendChild(actions);

  const grid = el('div', 'b-card-grid');
  page.appendChild(grid);
  root.appendChild(page);

  // Local drafts first.
  const drafts = listDrafts();
  const draftSlugs = new Set(drafts.map(d => d.slug));
  drafts.forEach(d => {
    const changed = !!(d.published && d.publishedHash && specHash(d.spec) !== d.publishedHash);
    grid.appendChild(presentationCard(d.spec.title || d.slug, d.slug, d.published, true, changed));
  });

  // Published (manifest), skipping any already shown as a draft.
  await ensureManifest();
  lastManifest.forEach(p => { if (!draftSlugs.has(p.slug)) grid.appendChild(presentationCard(p.title || p.slug, p.slug, true, false, false)); });

  if (!grid.children.length) {
    // First run: say what this IS before showing an empty grid.
    grid.appendChild(el('div', 'b-onboard', { html: `
      <h2>Run live polls in your lectures</h2>
      <p>Build a presentation here - or import your PowerPoint - then publish it to alanruddock.com. Students scan a QR code, vote on their phones, and the results appear live on the projector.</p>
      <ol>
        <li><strong>Create or import</strong> with the buttons above.</li>
        <li><strong>Add polls</strong> - any slide can become a question with tappable options.</li>
        <li><strong>Publish</strong> - you get a projector link and students join by QR.</li>
      </ol>` }));
  } else {
    page.appendChild(el('p', 'b-dash-note', {
      text: 'Drafts are stored in this browser only - publish to make a presentation permanent, and use the same browser to keep editing a draft.' }));
  }
}

function presentationCard(title, slug, published, isDraft, hasChanges) {
  const card = el('div', 'b-card');
  card.appendChild(el('div', 'b-card-title', { text: title }));
  const status = el('div', 'b-card-status');
  status.appendChild(el('span', 'b-card-slug', { text: '/' + slug + '/' }));
  if (published) status.appendChild(el('span', 'b-chip b-chip--live', { text: 'Published' }));
  if (isDraft && !published) status.appendChild(el('span', 'b-chip', { text: 'Draft - this browser' }));
  if (hasChanges) status.appendChild(el('span', 'b-chip b-chip--warn', { text: 'Unpublished changes' }));
  card.appendChild(status);
  const row = el('div', 'b-card-actions');
  row.appendChild(button('Edit', () => { location.hash = '#/edit/' + slug; }, 'b-btn--ghost'));
  row.appendChild(button('Duplicate', () => duplicate(slug), 'b-btn--link'));
  if (published) row.appendChild(el('a', 'b-btn b-btn--link', { href: '../' + slug + '/results.html', target: '_blank', text: 'Open live ↗' }));
  row.appendChild(button('Delete', () => deletePresFlow(slug, published, isDraft), 'b-btn--link b-btn--danger-link'));
  card.appendChild(row);
  return card;
}

// There was no way to delete ANYTHING - drafts piled up forever. Draft
// deletion clears this browser; published deletion also commits the removal
// of the site folder.
async function deletePresFlow(slug, published, isDraft) {
  const bits = [];
  if (isDraft) bits.push('the draft in this browser');
  if (published) bits.push('the published page at alanruddock.com/' + slug + '/');
  const res = await dialog({
    title: 'Delete "' + slug + '"?',
    body: '<p>This removes ' + bits.join(' <strong>and</strong> ') + ". It can't be undone." +
          (published ? '</p><p class="b-note">Votes already recorded stay in the database.</p>' : '</p>'),
    buttons: [{ label: 'Delete', value: 'del', danger: true }]
  });
  if (!res) return;
  if (published) {
    if (!getToken()) { const ok = await tokenDialog(); if (!ok) return; }
    try { await deletePresentation(slug); }
    catch (e) {
      console.error(e);
      await dialog({ title: "Couldn't remove the published page",
        body: '<p>' + escapeHtml(friendlyPublishError(e)) + '</p>',
        buttons: [{ label: 'OK', value: 'ok', primary: true }] });
      return;
    }
  }
  localStorage.removeItem(DRAFT_PREFIX + slug);
  await deleteMedia(slug);
  toast('Deleted "' + slug + '"');
  renderDashboard();
}

function tokenChip() {
  const chip = el('div', 'b-token');
  const has = !!getToken();
  chip.appendChild(el('span', 'b-token-dot' + (has ? ' on' : ''), {}));
  chip.appendChild(el('span', null, { text: has ? 'Publishing enabled' : 'Publishing not set up' }));
  chip.appendChild(button(has ? 'Update' : 'Set up', () => tokenDialog(), 'b-btn--link'));
  if (has) chip.appendChild(button('Forget', () => { clearToken(); route(); }, 'b-btn--link'));
  return chip;
}

// The GitHub token gate, humanised: what it is, exactly how to make one, and
// the pasted value is checked against the repository BEFORE it's stored.
async function tokenDialog() {
  while (true) {
    const res = await dialog({
      title: 'Set up publishing',
      body: `
        <p>Publishing saves your presentation to the website. It needs a GitHub access token - created once, in about a minute:</p>
        <ol>
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com &rarr; New fine-grained token ↗</a></li>
          <li>Repository access: <strong>Only select repositories &rarr; aprofrudd.github.io</strong></li>
          <li>Permissions &rarr; Repository permissions &rarr; <strong>Contents: Read and write</strong></li>
          <li>Generate the token, copy it, and paste it below.</li>
        </ol>
        <p class="b-note">The token is stored in this browser only and never leaves it except to talk to GitHub.</p>`,
      fields: [{ key: 'token', label: 'Token', type: 'password', placeholder: 'github_pat_…' }],
      buttons: [{ label: 'Check & save', value: 'save', primary: true }]
    });
    if (!res || !res.values.token) return !!getToken();
    const v = await validateToken(res.values.token);
    if (v.ok) {
      setToken(res.values.token);
      toast('Publishing is set up ✓');
      if (!state) route();   // refresh the dashboard chip
      return true;
    }
    await dialog({ title: "That token didn't work",
      body: '<p>' + escapeHtml(v.error) + '</p>',
      buttons: [{ label: 'Try again', value: 'again', primary: true }] });
  }
}

// Ask for a name with a live preview of the join address, and refuse names
// that would silently overwrite an existing draft or published presentation.
async function askName(title, initial) {
  await ensureManifest();
  while (true) {
    const res = await dialog({
      title,
      body: '<p class="b-note">Students will join at <strong>alanruddock.com/<span id="b-url-prev">' +
            escapeHtml(kebab(initial || '') || '…') + '</span>/</strong> - short names make easier joins.</p>',
      fields: [{ key: 'name', label: 'Name', value: initial || '', placeholder: 'Heat & Hydration',
        onInput: (v) => {
          const prev = document.getElementById('b-url-prev');
          if (prev) prev.textContent = kebab(v) || '…';
        } }],
      buttons: [{ label: 'Create', value: 'create', primary: true }]
    });
    if (!res || !res.values.name) return null;
    const name = res.values.name;
    const clash = slugTaken(kebab(name));
    if (!clash) return name;
    await dialog({ title: 'That name is taken',
      body: '<p>"' + escapeHtml(kebab(name)) + '" is already ' + clash +
            ' - pick a different name so nothing gets overwritten.</p>',
      buttons: [{ label: 'Choose another', value: 'ok', primary: true }] });
    initial = name;
  }
}

async function createNew() {
  const name = await askName('New presentation');
  if (!name) return;
  const spec = newSpec(name);
  state = { spec, mediaBlobs: {}, mediaDirty: true, selected: -1, mode: 'projector', tab: 'slide', published: false };
  saveDraft();
  location.hash = '#/edit/' + spec.slug;
}
async function duplicate(slug) {
  let src = await loadDraftFull(slug);
  if (!src) {
    // Published but never edited here: duplicate straight from the site.
    try {
      const res = await fetch('../' + slug + '/presentation.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) src = { spec: await res.json(), mediaBlobs: {} };
    } catch (e) {}
  }
  if (!src) {
    await dialog({ title: "Couldn't load it", body: "<p>That presentation couldn't be fetched to copy - check your connection and try again.</p>",
      buttons: [{ label: 'OK', value: 'ok', primary: true }] });
    return;
  }
  const name = await askName('Name for the copy', (src.spec.title || slug) + ' copy');
  if (!name) return;
  const spec = JSON.parse(JSON.stringify(src.spec));
  delete spec.publishedAt;
  spec.slug = kebab(name); spec.lessonId = spec.slug; spec.title = name;
  spec.lessonUrl = 'alanruddock.com/' + spec.slug;
  state = { spec, mediaBlobs: Object.assign({}, src.mediaBlobs), mediaDirty: true,
            selected: -1, mode: 'projector', tab: 'slide', published: false };
  saveDraft();
  location.hash = '#/edit/' + spec.slug;
}

// Renaming the address migrates the draft and its images to the new slug -
// the old behaviour forked a ghost draft per keystroke pause and stranded
// the media under the old key.
async function onSlugChange(next) {
  const old = state.spec.slug;
  await ensureManifest();
  const clash = slugTaken(next);
  if (clash) {
    await dialog({ title: 'That address is taken',
      body: '<p>"' + escapeHtml(next) + '" is already ' + clash + '.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }] });
    renderEditor();
    return;
  }
  if (state.spec.lessonId === old) state.spec.lessonId = next;
  if (state.spec.lessonUrl === 'alanruddock.com/' + old) state.spec.lessonUrl = 'alanruddock.com/' + next;
  state.spec.slug = next;
  localStorage.removeItem(DRAFT_PREFIX + old);
  await saveMedia(next, Object.assign({}, state.mediaBlobs));
  await deleteMedia(old);
  state.mediaDirty = false;
  saveDraft();
  toast('Address changed to /' + next + '/');
  location.hash = '#/edit/' + next;
}

// ---- deck import -----------------------------------------------------------

// The two things worth knowing BEFORE importing (PDF vs .pptx, and the
// [[poll]] marker) used to be explained only AFTER the import finished.
async function importGuidance() {
  const res = await dialog({
    title: 'Import a deck',
    body: `
      <p><strong>Best quality - PDF:</strong> in PowerPoint use File &rarr; Export &rarr; PDF and import that. Every slide arrives pixel-perfect, exactly as you designed it.</p>
      <p><strong>Editable text - .pptx:</strong> import the PowerPoint file itself. Text, notes and images come in as editable slides, but the original layout and fonts are not reproduced.</p>
      <p><strong>Live polls:</strong> write <code>[[poll]]</code> in a slide's <em>speaker notes</em>, with the answer options underneath it - that slide imports as a live poll. You can also turn any slide into a poll afterwards with one click.</p>
      <p class="b-note">Exporting a PDF? Keep the marker out of the slide itself - anything printed on the slide stays visible in the picture.</p>`,
    buttons: [{ label: 'Choose a file…', value: 'pick', primary: true }]
  });
  return !!(res && res.button === 'pick');
}

// Ask for a file, then hand it to importDeck(). Shared by the dashboard (create
// a whole presentation from a deck) and the editor (append a deck's slides).
function pickDeckFile() {
  return new Promise(resolve => {
    const input = el('input', null, { type: 'file', accept: IMPORT_ACCEPT, hidden: true });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.remove();
      resolve(f || null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

function importOverlay() {
  const wrap = el('div', 'b-overlay');
  const box = el('div', 'b-overlay-box');
  const msg = el('div', 'b-overlay-msg', { text: 'Reading deck\u2026' });
  const barWrap = el('div', 'b-overlay-bar');
  const fill = el('div', 'b-overlay-fill');
  barWrap.appendChild(fill);
  box.appendChild(el('h3', null, { text: 'Importing your slides' }));
  box.appendChild(msg);
  box.appendChild(barWrap);
  wrap.appendChild(box);
  document.body.appendChild(wrap);
  return {
    progress(n, total, text) {
      msg.textContent = text || '';
      fill.style.width = total ? Math.round((n / total) * 100) + '%' : '0%';
    },
    done() { wrap.remove(); }
  };
}

function importFailedDialog(e) {
  console.error(e);
  const msg = /central directory/i.test(String(e && e.message))
    ? "That file doesn't look like a valid .pptx - re-save it from PowerPoint, or export a PDF instead."
    : String((e && e.message) || e);
  return dialog({ title: "Import didn't work", body: '<p>' + escapeHtml(msg) + '</p>',
    buttons: [{ label: 'OK', value: 'ok', primary: true }] });
}

// Import into the presentation currently open in the editor.
async function importIntoCurrent() {
  if (!(await importGuidance())) return;
  const file = await pickDeckFile();
  if (!file) return;
  const ui = importOverlay();
  try {
    const res = await importDeck(file, ui.progress);
    snapshotUndo('imported ' + res.stages.length + ' slide' + (res.stages.length === 1 ? '' : 's'));
    Object.assign(state.mediaBlobs, res.media);
    state.spec.stages = state.spec.stages.concat(res.stages);
    touchMedia();
    state.selected = state.spec.stages.length - res.stages.length;
    ui.done();
    saveDraft();
    renderEditor();
    refreshPreview();
    reportImport(res, state.mediaBlobs);
  } catch (e) {
    ui.done();
    importFailedDialog(e);
  }
}

// Import as a brand-new presentation from the dashboard.
async function importNew() {
  if (!(await importGuidance())) return;
  const file = await pickDeckFile();
  if (!file) return;
  const suggested = (file.name || 'Imported deck').replace(/\.(pdf|pptx)$/i, '').replace(/[_-]+/g, ' ').trim();
  const name = await askName('Name this presentation', suggested || 'Imported deck');
  if (!name) return;
  const spec = newSpec(name);
  const ui = importOverlay();
  try {
    const res = await importDeck(file, ui.progress);
    spec.stages = res.stages;
    state = { spec, mediaBlobs: res.media, mediaDirty: true, selected: 0,
              mode: 'projector', tab: 'slide', published: false };
    ui.done();
    saveDraft();
    location.hash = '#/edit/' + spec.slug;
    reportImport(res, res.media);
  } catch (e) {
    ui.done();
    importFailedDialog(e);
  }
}

function reportImport(res, media) {
  const n = res.stages.length;
  const polls = res.stages.filter(s => s.type === 'mcq').length;
  const pollLine = polls === 0
    ? 'No [[poll]] markers found - select any slide and press "Turn into a poll" to add voting.'
    : polls === 1 ? '1 slide became a live poll.' : polls + ' slides became live polls.';
  let body = '<p>' + pollLine + '</p>';
  // ~60KB per slide for a typical text deck, but photo-heavy slides run 5x that,
  // so this is reachable on a long image-rich deck - and a commit that size is
  // slow to push and permanent in the repo's history.
  const mb = mediaBytes(media) / (1024 * 1024);
  if (mb > 15) {
    body += '<p><strong>Heads up:</strong> the images total ' + mb.toFixed(0) +
            'MB. Publishing will be slow - consider splitting the deck.</p>';
  }
  const warns = (res.warnings || []).map(w => '<li>' + escapeHtml(w) + '</li>').join('');
  if (warns) body += '<ul class="b-warnlist">' + warns + '</ul>';
  dialog({ title: 'Imported ' + n + ' slide' + (n === 1 ? '' : 's'), body,
    buttons: [{ label: 'OK', value: 'ok', primary: true }] });
}

// ---- editor ----------------------------------------------------------------

async function openEditor(slug) {
  if (!state || state.spec.slug !== slug) {
    let d = await loadDraftFull(slug);
    if (!d) {
      // Try to open a published presentation by fetching its presentation.json.
      // Its media already lives in the repo, so the blob map starts empty and
      // the preview loads the published files by path.
      try {
        const res = await fetch('../' + slug + '/presentation.json', { cache: 'no-store' });
        if (res.ok) d = { spec: await res.json(), mediaBlobs: await loadMedia(slug), published: true };
      } catch (e) {}
    }
    if (!d) { toast("Couldn't find that presentation."); location.hash = '#/'; return; }
    state = { spec: d.spec, mediaBlobs: d.mediaBlobs || {}, mediaDirty: false,
              selected: d.spec.stages.length ? 0 : -1,
              mode: 'projector', tab: 'slide', published: !!d.published };
  }
  state.mediaBlobs = watchMedia(state.mediaBlobs);
  renderEditor();
  refreshPreview();
}

function renderEditor() {
  // A rebuild used to throw away keyboard focus and the slide list's scroll
  // position on every structural edit; capture both and put them back.
  const prevActive = document.activeElement;
  const fkey = prevActive && prevActive.dataset ? prevActive.dataset.fkey : null;
  const selStart = (prevActive && 'selectionStart' in prevActive) ? prevActive.selectionStart : null;
  const listEl = root.querySelector('.b-slide-list');
  const listScroll = listEl ? listEl.scrollTop : 0;

  root.innerHTML = '';
  const page = el('div', 'b-edit');

  // top bar
  const bar = el('header', 'b-edit-bar');
  bar.appendChild(button('← Presentations', () => { location.hash = '#/'; }, 'b-btn--link'));
  bar.appendChild(el('div', 'b-edit-title', { text: state.spec.title || state.spec.slug }));
  const warn = el('span', 'b-save-warn', { id: 'b-save-warn',
    text: "⚠ Draft isn't saving - storage may be full. Publish soon so nothing is lost." });
  warn.hidden = !saveFailed;
  bar.appendChild(warn);
  const pubBtn = button('Publish ▲', doPublish, 'b-btn--primary');
  pubBtn.id = 'b-publish-btn';
  bar.appendChild(el('span', 'b-pub-status', { id: 'b-pub-status' }));
  bar.appendChild(pubBtn);
  page.appendChild(bar);

  const cols = el('div', 'b-cols');
  cols.appendChild(slideListCol());
  cols.appendChild(previewCol());
  cols.appendChild(panelCol());
  page.appendChild(cols);
  root.appendChild(page);

  const newList = root.querySelector('.b-slide-list');
  if (newList) newList.scrollTop = listScroll;
  if (fkey) {
    const match = root.querySelector('[data-fkey="' + CSS.escape(fkey) + '"]');
    if (match) {
      match.focus();
      if (selStart != null && match.setSelectionRange) {
        try { match.setSelectionRange(selStart, selStart); } catch (e) {}
      }
    }
  }
}

const STAGE_TYPES = [
  { type: 'content', label: 'Info / figure' },
  { type: 'mcq', label: 'Poll (multiple choice)' },
  { type: 'slide', label: 'Slide image' },
  { type: 'map', label: 'Tap-the-map' },
  { type: 'media', label: 'Video' }
];

function newStage(type) {
  const base = { id: uniqueStageId(type), type, title: defaultTitle(type) };
  if (type === 'mcq') base.options = [{ id: 'option-1', label: 'Option 1' }, { id: 'option-2', label: 'Option 2' }];
  if (type === 'content') base.quote = '';
  if (type === 'media') base.video = '';
  return base;
}
function defaultTitle(type) {
  return { content: 'New info slide', mcq: 'New question', map: 'Where is it?',
           media: 'Watch this', slide: 'New slide image' }[type] || 'New slide';
}
function uniqueStageId(type) {
  let base = type === 'slide' ? 'slide' : type + '-slide', id = base, n = 2;
  const ids = new Set((state.spec.stages || []).map(s => s.id));
  while (ids.has(id)) id = base + '-' + (n++);
  return id;
}

function slideListCol() {
  const col = el('aside', 'b-slides');
  const addRow = el('div', 'b-add');
  addRow.appendChild(button('\u2191 Import deck', importIntoCurrent, 'b-btn--ghost b-btn--add b-btn--import'));
  STAGE_TYPES.forEach(t => addRow.appendChild(button('+ ' + t.label, () => {
    state.spec.stages.push(newStage(t.type));
    state.selected = state.spec.stages.length - 1;
    onStructure();
  }, 'b-btn--ghost b-btn--add')));
  col.appendChild(addRow);

  const list = el('div', 'b-slide-list');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Slides');
  (state.spec.stages || []).forEach((s, i) => {
    const item = el('div', 'b-slide-item' + (i === state.selected ? ' sel' : ''));
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-selected', String(i === state.selected));
    item.setAttribute('aria-label', 'Slide ' + (i + 1) + ': ' + (s.title || 'untitled') + ' (' + s.type + ')');
    item.draggable = true;
    item.dataset.index = i;
    item.appendChild(el('span', 'b-slide-num', { text: (i + 1) }));
    const meta = el('div', 'b-slide-meta');
    meta.appendChild(el('div', 'b-slide-title', { text: s.title || '(untitled)' }));
    meta.appendChild(el('div', 'b-slide-type', { text: s.type }));
    item.appendChild(meta);
    const selectThis = () => { state.selected = i; state.tab = 'slide'; renderEditor(); refreshPreview(); };
    item.addEventListener('click', selectThis);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThis(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeStage(i); }
    });
    // Drag to reorder (the ↑/↓ buttons stay for keyboard + precision).
    item.addEventListener('dragstart', (e) => {
      dragSrcIndex = i;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) {}
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.drop-above, .drop-below').forEach(n => n.classList.remove('drop-above', 'drop-below'));
    });
    item.addEventListener('dragover', (e) => {
      if (dragSrcIndex == null || dragSrcIndex === i) return;
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      item.classList.toggle('drop-above', before);
      item.classList.toggle('drop-below', !before);
    });
    item.addEventListener('dragleave', () => item.classList.remove('drop-above', 'drop-below'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIndex == null || dragSrcIndex === i) return;
      const rect = item.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      let target = before ? i : i + 1;
      if (dragSrcIndex < target) target--;
      moveTo(dragSrcIndex, target);
      dragSrcIndex = null;
    });
    const ctrls = el('div', 'b-slide-ctrls');
    const up = button('↑', () => { move(i, -1); }, 'b-btn--icon');
    up.setAttribute('aria-label', 'Move slide ' + (i + 1) + ' up');
    const down = button('↓', () => { move(i, 1); }, 'b-btn--icon');
    down.setAttribute('aria-label', 'Move slide ' + (i + 1) + ' down');
    const del = button('✕', () => { removeStage(i); }, 'b-btn--icon');
    del.setAttribute('aria-label', 'Delete slide ' + (i + 1) + ': ' + (s.title || 'untitled'));
    ctrls.appendChild(up); ctrls.appendChild(down); ctrls.appendChild(del);
    item.appendChild(ctrls);
    list.appendChild(item);
  });
  if (!state.spec.stages.length) {
    list.appendChild(el('div', 'b-empty b-empty--slides', { html:
      '<p><strong>Add your first slide.</strong></p>' +
      '<p>An <em>Info</em> slide shows content; a <em>Poll</em> collects live votes on phones. Or import your PowerPoint above.</p>' }));
  }
  col.appendChild(list);
  return col;
}
let dragSrcIndex = null;
function moveTo(from, to) {
  const a = state.spec.stages;
  if (from === to || from < 0 || from >= a.length) return;
  to = Math.max(0, Math.min(a.length - 1, to));
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  // Keep the same SLIDE selected, wherever it moved to.
  if (state.selected === from) state.selected = to;
  else if (from < state.selected && to >= state.selected) state.selected--;
  else if (from > state.selected && to <= state.selected) state.selected++;
  onStructure();
}
function move(i, d) {
  const j = i + d;
  if (j < 0 || j >= state.spec.stages.length) return;
  const a = state.spec.stages;
  [a[i], a[j]] = [a[j], a[i]];
  if (state.selected === i) state.selected = j; else if (state.selected === j) state.selected = i;
  onStructure();
}
function removeStage(i) {
  const stg = state.spec.stages[i];
  if (!stg) return;
  // No blocking confirm: delete immediately, offer Undo. (A confirm dialog
  // protected against misclicks but punished every intentional delete; the
  // undo stack protects against both.)
  snapshotUndo('deleted "' + (stg.title || 'slide') + '"');
  state.spec.stages.splice(i, 1);
  // Deleting a slide ABOVE the selected one used to silently switch the edit
  // panel to a different slide - keep the same slide selected.
  if (i < state.selected) state.selected--;
  if (state.selected >= state.spec.stages.length) state.selected = state.spec.stages.length - 1;
  onStructure();
  toast('Slide deleted', { action: { label: 'Undo', onClick: undoLast } });
}

function previewCol() {
  const col = el('section', 'b-preview');
  const bar = el('div', 'b-preview-bar');
  ['projector', 'phone'].forEach(m => {
    bar.appendChild(button(m === 'projector' ? 'Projector' : 'Phone',
      () => { state.mode = m; renderEditor(); refreshPreview(); },
      'b-btn--toggle' + (state.mode === m ? ' on' : '')));
  });
  col.appendChild(bar);
  const frameWrap = el('div', 'b-frame-wrap' + (state.mode === 'phone' ? ' phone' : ''));
  const iframe = el('iframe', 'b-frame', { id: 'b-frame', title: 'preview' });
  frameWrap.appendChild(iframe);
  col.appendChild(frameWrap);
  return col;
}

function panelCol() {
  const col = el('aside', 'b-panelcol');
  const tabs = el('div', 'b-tabs');
  [['slide', 'Slide'], ['theme', 'Theme'], ['settings', 'Settings']].forEach(([k, label]) => {
    tabs.appendChild(button(label, () => { state.tab = k; renderEditor(); }, 'b-tab' + (state.tab === k ? ' on' : '')));
  });
  col.appendChild(tabs);

  const body = el('div', 'b-panelbody');
  const ctx = {
    mediaBlobs: state.mediaBlobs,
    resolvePreview: p => substMedia(p) !== p ? substMedia(p) : null,
    onChange: onContentChange,
    onStructure: onStructure,
    onRename: onRename,
    onRebuild: () => { renderEditor(); refreshPreview(); },
    onSlugChange,
    snapshot: snapshotUndo,
    toast: (msg, withUndo) => withUndo
      ? toast(msg, { action: { label: 'Undo', onClick: undoLast } })
      : toast(msg),
    published: state.published
  };
  if (state.tab === 'theme') body.appendChild(themePanel(state.spec, ctx));
  else if (state.tab === 'settings') body.appendChild(settingsPanel(state.spec, ctx));
  else {
    const s = state.spec.stages[state.selected];
    if (s) body.appendChild(stagePanel(s, ctx));
    else body.appendChild(el('p', 'b-empty', { text: 'Select or add a slide.' }));
  }
  col.appendChild(body);
  return col;
}

// ---- change hooks ----------------------------------------------------------

function onContentChange() { saveDraftDebounced(); refreshPreviewContentDebounced(); }
function onStructure() { saveDraftDebounced(); renderEditor(); refreshPreview(); }
// Title edits: update labels in place (no panel rebuild, so the field keeps focus).
function onRename() {
  const sel = document.querySelector('.b-slide-item.sel .b-slide-title');
  if (sel && state.spec.stages[state.selected]) sel.textContent = state.spec.stages[state.selected].title || '(untitled)';
  const bar = document.querySelector('.b-edit-title');
  if (bar) bar.textContent = state.spec.title || state.spec.slug;
  saveDraftDebounced(); refreshPreviewContentDebounced();
}

function previewData() {
  return {
    mode: state.mode,
    lessonId: state.spec.lessonId || state.spec.slug,
    title: state.spec.title, kicker: state.spec.kicker,
    heading: state.spec.heading, projectorHeading: state.spec.projectorHeading,
    lessonUrl: state.spec.lessonUrl, logo: substMedia(state.spec.logo),
    cities: state.spec.cities, mapBounds: state.spec.mapBounds,
    themeCss: previewThemeCss(),
    stages: previewStages(),
    // Show the slide currently selected/edited, so edits appear immediately
    // instead of only when you navigate the preview.
    startStage: Math.max(0, state.selected)
  };
}

// Structural refresh: full iframe reload (mode switch, slide change, add /
// remove). Content edits instead post into the RUNNING page - reloading on
// every keystroke flashed a half-booted frame ("Sign in to control", empty
// options) for a second per edit, and re-fetched the whole engine each time.
function refreshPreview() {
  const data = previewData();
  try { sessionStorage.setItem('builder_preview', JSON.stringify(data)); } catch (e) {}
  const frame = document.getElementById('b-frame');
  // Cache-buster must be in the QUERY (before the #), or a fragment-only change
  // wouldn't reload the iframe - which is why edits previously needed a click away.
  if (frame) frame.src = 'preview.html?t=' + Date.now() + '#' + state.mode;
}
function refreshPreviewContent() {
  const data = previewData();
  try { sessionStorage.setItem('builder_preview', JSON.stringify(data)); } catch (e) {}
  const frame = document.getElementById('b-frame');
  const win = frame && frame.contentWindow;
  if (win && win.__previewApply) {
    win.__previewApply(data);
  } else {
    refreshPreviewDebounced();   // frame still booting - fall back to a reload
  }
}
const refreshPreviewDebounced = debounce(refreshPreview, 250);
const refreshPreviewContentDebounced = debounce(refreshPreviewContent, 120);

// ---- publish ---------------------------------------------------------------

let publishing = false;
async function doPublish() {
  if (publishing) return;   // no overlapping publishes from double-clicks
  const status = document.getElementById('b-pub-status');
  const btn = document.getElementById('b-publish-btn');
  if (!getToken()) { const ok = await tokenDialog(); if (!ok) return; }
  const problems = validate(state.spec);
  if (problems.length) {
    dialog({ title: 'Almost ready to publish',
      body: '<ul class="b-warnlist">' + problems.map(x => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }] });
    return;
  }
  publishing = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
  try {
    const { url, publishedAt } = await publishPresentation(state.spec, state.mediaBlobs,
      (done, total) => { if (status) status.textContent = 'Uploading ' + done + '/' + total + '…'; });
    state.published = true;
    state.publishedHash = specHash(state.spec);
    saveDraft();
    // "Published" used to mean "the commit landed" - but the page 404s until
    // the Pages build finishes and can serve the OLD deck for a few minutes.
    // Poll until this publish is actually what the site returns.
    if (status) status.textContent = 'Deploying to the site…';
    const live = await waitForDeploy(state.spec.slug, publishedAt,
      (n) => { if (status) status.textContent = 'Deploying to the site… ' + (n * 5) + 's'; });
    if (status) status.textContent = live ? 'Live ✓' : 'Published ✓';
    const fresh = '?fresh=' + Date.now();   // fresh CDN cache key for the shells
    const projector = url + fresh;
    const student = '../' + state.spec.slug + '/' + fresh;
    dialog({
      title: live ? 'Your presentation is live' : 'Published - still deploying',
      body: (live
        ? '<p>Everything is up and current.</p>'
        : '<p>The upload succeeded, but the site is taking longer than usual to update - the links below will be current within a few minutes.</p>')
        + '<p><a href="' + projector + '" target="_blank" rel="noopener">Open the projector view ↗</a></p>'
        + '<p><a href="' + student + '" target="_blank" rel="noopener">Open the student view ↗</a></p>'
        + '<p class="b-note">Students join at <strong>' + escapeHtml(state.spec.lessonUrl || ('alanruddock.com/' + state.spec.slug)) + '</strong> - the projector shows a QR code they can scan.</p>',
      buttons: [{ label: 'Done', value: 'ok', primary: true }]
    });
  } catch (e) {
    console.error(e);
    if (status) status.textContent = 'Publish failed';
    dialog({ title: "Publishing didn't work",
      body: '<p>' + escapeHtml(friendlyPublishError(e)) + '</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }] });
  } finally {
    publishing = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Publish ▲'; }
  }
}
function validate(spec) {
  const p = [];
  if (!spec.slug) p.push('Add a URL slug (Settings).');
  if (!spec.stages || !spec.stages.length) p.push('Add at least one slide.');
  (spec.stages || []).forEach((s, i) => {
    if (!s.title) p.push('Slide ' + (i + 1) + ' needs a title.');
    if (s.type === 'mcq' && (!s.options || s.options.length < 2)) p.push('Slide ' + (i + 1) + ' (poll) needs at least 2 options.');
    if (s.type === 'mcq' && (s.options || []).some(o => !String(o.label || '').trim())) p.push('Slide ' + (i + 1) + ' (poll) has an option with no text.');
    if (s.type === 'content' && !s.figure && !s.quote && !s.table) p.push('Slide ' + (i + 1) + ' (info) needs a figure, table or quote.');
    if (s.type === 'media' && !s.video) p.push('Slide ' + (i + 1) + ' (video) needs a video URL.');
    if (s.type === 'slide' && !s.image) p.push('Slide ' + (i + 1) + ' (slide image) needs an image.');
    if (s.type === 'poster') p.push('Slide ' + (i + 1) + ': poster slides are not supported in the builder yet.');
  });
  return p;
}

// ---- boot ------------------------------------------------------------------

window.addEventListener('hashchange', route);
route();
