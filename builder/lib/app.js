// Presentation builder - main controller. Hash-routed single page:
//   #/                dashboard (list / new / open / duplicate)
//   #/edit/<slug>     editor (slide list + live preview + edit panel)
//
// State lives in memory + a localStorage draft per slug. Publishing (publish.js)
// turns the spec into committed files; here we author and preview.

import { el, button, debounce, kebab } from './ui.js';
import { DEFAULT_THEME, themeCss } from './theme.js';
import { engineStages, buildPresentationFiles } from './generate.js';
import { stagePanel, themePanel, settingsPanel } from './panels.js';
import { publishPresentation, getToken, setToken, clearToken, fetchManifest } from './publish.js';
import { loadMedia, saveMedia, mediaBytes } from './media-store.js';
import { importDeck, IMPORT_ACCEPT } from './import.js';

const root = document.getElementById('app');
const DRAFT_PREFIX = 'builder_draft_';

let state = null;   // { spec, mediaBlobs, selected, mode, tab, published }

// ---- drafts ----------------------------------------------------------------

function saveDraft() {
  if (!state || !state.spec.slug) return;
  try {
    // Spec only. Media lives in IndexedDB (media-store.js) because an imported
    // deck is tens of megabytes of data URLs and would blow localStorage.
    localStorage.setItem(DRAFT_PREFIX + state.spec.slug,
      JSON.stringify({ spec: state.spec, published: state.published }));
  } catch (e) { console.warn('draft save failed (quota?)', e); }
  if (state.mediaDirty) {
    state.mediaDirty = false;
    saveMedia(state.spec.slug, Object.assign({}, state.mediaBlobs));
  }
}
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
      try { const d = JSON.parse(localStorage.getItem(k)); out.push({ slug: k.slice(DRAFT_PREFIX.length), spec: d.spec, published: d.published }); }
      catch (e) {}
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
  return (state.mediaBlobs && state.mediaBlobs[path]) ? state.mediaBlobs[path] : path;
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
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/edit\/(.+)$/);
  if (m) openEditor(decodeURIComponent(m[1]));
  else renderDashboard();
}

// ---- dashboard -------------------------------------------------------------

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
  drafts.forEach(d => grid.appendChild(presentationCard(d.spec.title || d.slug, d.slug, d.published, true)));

  // Published (manifest), skipping any already shown as a draft.
  let manifest = [];
  try { manifest = await fetchManifest(); } catch (e) {}
  manifest.forEach(p => { if (!draftSlugs.has(p.slug)) grid.appendChild(presentationCard(p.title || p.slug, p.slug, true, false)); });

  if (!grid.children.length) grid.appendChild(el('p', 'b-empty', { text: 'No presentations yet. Create your first one.' }));
}

function presentationCard(title, slug, published, isDraft) {
  const card = el('div', 'b-card');
  card.appendChild(el('div', 'b-card-title', { text: title }));
  card.appendChild(el('div', 'b-card-slug', { text: '/' + slug + '/' + (isDraft ? '  · draft' : '') + (published ? '  · published' : '') }));
  const row = el('div', 'b-card-actions');
  row.appendChild(button('Edit', () => { location.hash = '#/edit/' + slug; }, 'b-btn--ghost'));
  row.appendChild(button('Duplicate', () => duplicate(slug), 'b-btn--link'));
  if (published) row.appendChild(el('a', 'b-btn b-btn--link', { href: '../' + slug + '/results.html', target: '_blank', text: 'Open live ↗' }));
  card.appendChild(row);
  return card;
}

function tokenChip() {
  const chip = el('div', 'b-token');
  const has = !!getToken();
  chip.appendChild(el('span', 'b-token-dot' + (has ? ' on' : ''), {}));
  chip.appendChild(el('span', null, { text: has ? 'GitHub token set' : 'No token' }));
  chip.appendChild(button(has ? 'Change' : 'Set token', promptToken, 'b-btn--link'));
  if (has) chip.appendChild(button('Forget', () => { clearToken(); route(); }, 'b-btn--link'));
  return chip;
}
function promptToken() {
  const t = prompt('Paste your GitHub fine-grained token (scoped to aprofrudd.github.io, Contents: read & write). Stored only in this browser.');
  if (t != null) { setToken(t.trim()); route(); }
}

function createNew() {
  const name = prompt('Name your presentation:');
  if (!name || !name.trim()) return;
  const spec = newSpec(name.trim());
  if (loadDraft(spec.slug)) { alert('A presentation with that slug already exists. Pick another name.'); return; }
  state = { spec, mediaBlobs: {}, mediaDirty: true, selected: -1, mode: 'projector', tab: 'slide', published: false };
  saveDraft();
  location.hash = '#/edit/' + spec.slug;
}
async function duplicate(slug) {
  const src = await loadDraftFull(slug);
  if (!src) { alert('Open and edit the published version first to duplicate it.'); return; }
  const name = prompt('Name for the copy:', (src.spec.title || slug) + ' copy');
  if (!name) return;
  const spec = JSON.parse(JSON.stringify(src.spec));
  spec.slug = kebab(name); spec.lessonId = spec.slug; spec.title = name;
  spec.lessonUrl = 'alanruddock.com/' + spec.slug;
  state = { spec, mediaBlobs: Object.assign({}, src.mediaBlobs), mediaDirty: true,
            selected: -1, mode: 'projector', tab: 'slide', published: false };
  saveDraft();
  location.hash = '#/edit/' + spec.slug;
}

// ---- deck import -----------------------------------------------------------

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

// Import into the presentation currently open in the editor.
async function importIntoCurrent() {
  const file = await pickDeckFile();
  if (!file) return;
  const ui = importOverlay();
  try {
    const res = await importDeck(file, ui.progress);
    Object.assign(state.mediaBlobs, res.media);
    state.spec.stages = state.spec.stages.concat(res.stages);
    touchMedia();
    state.selected = state.spec.stages.length - res.stages.length;
    ui.done();
    saveDraft();
    reportImport(res, state.mediaBlobs);
    renderEditor();
    refreshPreview();
  } catch (e) {
    ui.done();
    console.error(e);
    alert('Import failed: ' + e.message);
  }
}

// Import as a brand-new presentation from the dashboard.
async function importNew() {
  const file = await pickDeckFile();
  if (!file) return;
  const suggested = (file.name || 'Imported deck').replace(/\.(pdf|pptx)$/i, '').replace(/[_-]+/g, ' ').trim();
  const name = prompt('Name this presentation:', suggested || 'Imported deck');
  if (!name || !name.trim()) return;
  const spec = newSpec(name.trim());
  if (loadDraft(spec.slug)) { alert('A presentation with that slug already exists. Pick another name.'); return; }
  const ui = importOverlay();
  try {
    const res = await importDeck(file, ui.progress);
    spec.stages = res.stages;
    state = { spec, mediaBlobs: res.media, mediaDirty: true, selected: 0,
              mode: 'projector', tab: 'slide', published: false };
    ui.done();
    saveDraft();
    reportImport(res, res.media);
    location.hash = '#/edit/' + spec.slug;
  } catch (e) {
    ui.done();
    console.error(e);
    alert('Import failed: ' + e.message);
  }
}

function reportImport(res, media) {
  const polls = res.stages.filter(s => s.type === 'mcq').length;
  const lines = [`Imported ${res.stages.length} slide(s).`];
  lines.push(polls
    ? `${polls} became live polls (from the [[poll]] marker).`
    : 'No [[poll]] markers found - pick any slide and press "Turn into a poll" to add voting.');
  // ~60KB per slide for a typical text deck, but photo-heavy slides run 5x that,
  // so this is reachable on a long image-rich deck - and a commit that size is
  // slow to push and permanent in the repo's history.
  const mb = mediaBytes(media) / (1024 * 1024);
  if (mb > 15) {
    lines.push(`\nHeads up: the images total ${mb.toFixed(0)}MB. Publishing that many will be slow and bloats the repo - consider splitting the deck.`);
  }
  (res.warnings || []).forEach(w => lines.push('\n' + w));
  alert(lines.join('\n'));
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
    if (!d) { alert('Could not find that presentation.'); location.hash = '#/'; return; }
    state = { spec: d.spec, mediaBlobs: d.mediaBlobs || {}, mediaDirty: false,
              selected: d.spec.stages.length ? 0 : -1,
              mode: 'projector', tab: 'slide', published: !!d.published };
  }
  state.mediaBlobs = watchMedia(state.mediaBlobs);
  renderEditor();
  refreshPreview();
}

function renderEditor() {
  root.innerHTML = '';
  const page = el('div', 'b-edit');

  // top bar
  const bar = el('header', 'b-edit-bar');
  bar.appendChild(button('← Presentations', () => { location.hash = '#/'; }, 'b-btn--link'));
  bar.appendChild(el('div', 'b-edit-title', { text: state.spec.title || state.spec.slug }));
  const pubBtn = button('Publish ▲', doPublish, 'b-btn--primary');
  bar.appendChild(el('span', 'b-pub-status', { id: 'b-pub-status' }));
  bar.appendChild(pubBtn);
  page.appendChild(bar);

  const cols = el('div', 'b-cols');
  cols.appendChild(slideListCol());
  cols.appendChild(previewCol());
  cols.appendChild(panelCol());
  page.appendChild(cols);
  root.appendChild(page);
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
  (state.spec.stages || []).forEach((s, i) => {
    const item = el('div', 'b-slide-item' + (i === state.selected ? ' sel' : ''));
    item.appendChild(el('span', 'b-slide-num', { text: (i + 1) }));
    const meta = el('div', 'b-slide-meta');
    meta.appendChild(el('div', 'b-slide-title', { text: s.title || '(untitled)' }));
    meta.appendChild(el('div', 'b-slide-type', { text: s.type }));
    item.appendChild(meta);
    item.addEventListener('click', () => { state.selected = i; state.tab = 'slide'; renderEditor(); refreshPreview(); });
    const ctrls = el('div', 'b-slide-ctrls');
    ctrls.appendChild(button('↑', e => { move(i, -1); }, 'b-btn--icon'));
    ctrls.appendChild(button('↓', e => { move(i, 1); }, 'b-btn--icon'));
    ctrls.appendChild(button('✕', e => { removeStage(i); }, 'b-btn--icon'));
    item.appendChild(ctrls);
    list.appendChild(item);
  });
  if (!state.spec.stages.length) list.appendChild(el('p', 'b-empty', { text: 'Add your first slide above.' }));
  col.appendChild(list);
  return col;
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
  if (!confirm('Delete this slide?')) return;
  state.spec.stages.splice(i, 1);
  if (state.selected >= state.spec.stages.length) state.selected = state.spec.stages.length - 1;
  onStructure();
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

function onContentChange() { saveDraftDebounced(); refreshPreviewDebounced(); }
function onStructure() { saveDraftDebounced(); renderEditor(); refreshPreview(); }
// Title edits: update labels in place (no panel rebuild, so the field keeps focus).
function onRename() {
  const sel = document.querySelector('.b-slide-item.sel .b-slide-title');
  if (sel && state.spec.stages[state.selected]) sel.textContent = state.spec.stages[state.selected].title || '(untitled)';
  const bar = document.querySelector('.b-edit-title');
  if (bar) bar.textContent = state.spec.title || state.spec.slug;
  saveDraftDebounced(); refreshPreviewDebounced();
}

function refreshPreview() {
  const data = {
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
  try { sessionStorage.setItem('builder_preview', JSON.stringify(data)); } catch (e) {}
  const frame = document.getElementById('b-frame');
  // Cache-buster must be in the QUERY (before the #), or a fragment-only change
  // wouldn't reload the iframe - which is why edits previously needed a click away.
  if (frame) frame.src = 'preview.html?t=' + Date.now() + '#' + state.mode;
}
const refreshPreviewDebounced = debounce(refreshPreview, 250);

// ---- publish ---------------------------------------------------------------

async function doPublish() {
  const status = document.getElementById('b-pub-status');
  if (!getToken()) { promptToken(); if (!getToken()) return; }
  const problems = validate(state.spec);
  if (problems.length) { alert('Fix before publishing:\n- ' + problems.join('\n- ')); return; }
  status.textContent = 'Publishing…';
  try {
    const url = await publishPresentation(state.spec, state.mediaBlobs);
    state.published = true; saveDraft();
    status.textContent = 'Published ✓';
    if (confirm('Published! Open the projector view?\n' + url)) window.open(url, '_blank');
  } catch (e) {
    console.error(e);
    status.textContent = 'Publish failed';
    alert('Publish failed: ' + e.message);
  }
}
function validate(spec) {
  const p = [];
  if (!spec.slug) p.push('Add a URL slug (Settings).');
  if (!spec.stages || !spec.stages.length) p.push('Add at least one slide.');
  (spec.stages || []).forEach((s, i) => {
    if (!s.title) p.push('Slide ' + (i + 1) + ' needs a title.');
    if (s.type === 'mcq' && (!s.options || s.options.length < 2)) p.push('Slide ' + (i + 1) + ' (poll) needs 2+ options.');
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
