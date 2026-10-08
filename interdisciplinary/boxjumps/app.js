import { PAGES, DISC, BOXES, WHEN, PHASES, TEAMWORK, EMAIL, SLOT_MIN, VARS, METHODS, EFFECT, ROLES, LIM, SPECTRUM_OPTS, estimateBox, stationFor, pageHasContent } from './content.js';
import { FRAMEWORKS, FW_EDGES, FW_POS, SPECTRUM, SPECTRUM_EXAMPLES, SPECTRUM_SOURCE, fw } from './frameworks.js';
import * as store from './store.js';
import { esc, LS, localDate, uid, parse, chartSVG, fmtCm, mmss } from './util.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');

// ------------------------------------------------------------------ state
let team = null;                 // { id, name, class_code }
const A = new Map();             // field -> value (answers)
const T = new Map();             // attempt id -> row
let pendingA = {};               // field -> { value, updated_at } not yet confirmed by the server
let pendingT = {};               // attempt id -> row not yet confirmed
const sentAt = {};               // field -> ms of our latest write, to ignore stale echoes
let rotation = null;             // { start: ms | null }
let rotKey = '';
// Each phone/laptop gets its own id so per-person votes can be counted.
const DEVICE = LS.get('ia:device') || (() => { const d = uid(); LS.set('ia:device', d); return d; })();

// ------------------------------------------------------------------ boot
async function boot() {
  const saved = LS.get('ia:team');
  const cls = params.get('class');
  const tid = params.get('team');
  if (tid && cls) {
    try {
      const t = (await store.listTeams(cls)).find((x) => x.id === tid);
      if (t) return enterTeam(t);
    } catch { /* fall through to join screen */ }
  }
  if (saved && (!cls || cls === saved.class_code)) enterTeam(saved);
  else renderJoin(cls || LS.get('ia:class') || localDate());
}

// ------------------------------------------------------------------ join screen
async function renderJoin(classCode) {
  app.innerHTML = `
    <div class="join">
      <p class="eyebrow">Interdisciplinary Approaches to Sport &amp; Exercise Science</p>
      <h1>Optimising jump performance</h1>
      <p class="lead">Join your team’s shared workspace. Everyone in the team joins the same one, on their own phone or laptop.</p>
      <div class="card">
        <label class="fieldset"><span class="label">Class code</span>
          <small>Leave this as it is unless your tutor gives you a different one.</small>
          <input id="cls" value="${esc(classCode)}" autocomplete="off"></label>
        <h2 class="h3">Join an existing team</h2>
        <div id="teams" class="team-grid"><p class="muted">Loading teams…</p></div>
        <h2 class="h3">Or start a new team</h2>
        <form id="newteam" class="add">
          <input id="tname" placeholder="Team name, e.g. Team Hops" maxlength="40" autocomplete="off" required>
          <button class="btn primary">Create team</button>
        </form>
        <p class="muted small">Use first names or initials only. Nothing here needs personal details.</p>
        <p id="joinerr" class="error" hidden></p>
      </div>
    </div>`;
  const clsEl = document.getElementById('cls');
  const load = async () => {
    const c = clsEl.value.trim();
    const box = document.getElementById('teams');
    if (!box) return;
    try {
      const teams = (await store.listTeams(c)).filter((t) => t.name !== store.CONTROL);
      box.innerHTML = teams.length
        ? teams.map((t) => `<button class="team-btn" data-tid="${t.id}">${esc(t.name)}</button>`).join('')
        : '<p class="muted">No teams yet. Start one below.</p>';
      box.querySelectorAll('[data-tid]').forEach((b) => b.onclick = () => enterTeam(teams.find((t) => t.id === b.dataset.tid)));
    } catch (e) {
      box.innerHTML = '<p class="error">Can’t reach the server. Check your Wi-Fi and refresh.</p>';
    }
  };
  clsEl.onchange = load;
  document.getElementById('newteam').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('tname').value.trim();
    if (!name || name === store.CONTROL) return;
    try { enterTeam(await store.getOrCreateTeam(clsEl.value.trim(), name)); }
    catch (err) { const el = document.getElementById('joinerr'); el.hidden = false; el.textContent = 'Couldn’t create the team. Check your connection and try again.'; }
  };
  await load();
  const stop = store.subscribe(null, { onTeam: (t) => { if (t.class_code === clsEl.value.trim()) load(); } });
  window.addEventListener('hashchange', stop, { once: true });
}

// ------------------------------------------------------------------ enter a team
async function enterTeam(t) {
  team = { id: t.id, name: t.name, class_code: t.class_code };
  LS.set('ia:team', team);
  LS.set('ia:class', team.class_code);
  pendingA = LS.get(`ia:pendA:${team.id}`) || {};
  pendingT = LS.get(`ia:pendT:${team.id}`) || {};

  // Show cached data immediately (survives a refresh with flaky Wi-Fi), then load fresh.
  const cache = LS.get(`ia:cache:${team.id}`);
  if (cache) { cache.a.forEach(([k, v]) => A.set(k, v)); cache.t.forEach((r) => T.set(r.id, r)); }
  applyPending();
  renderShell();

  try {
    const [ans, att] = await Promise.all([store.loadAnswers([team.id]), store.loadAttempts([team.id])]);
    A.clear(); T.clear();
    ans.forEach((r) => A.set(r.field, r.value));
    att.forEach((r) => T.set(r.id, r));
    applyPending();
    writeCache();
    renderPage();
  } catch (e) {
    setSave('offline');
  }

  store.subscribe(team.id, { onAnswer: remoteAnswer, onAttempt: remoteAttempt });
  pollRotation();
  store.onRotationChange(pollRotation);
  setInterval(pollRotation, 30000);
  setInterval(tick, 1000);
  window.addEventListener('online', () => flush());
  if (Object.keys(pendingA).length || Object.keys(pendingT).length) flush();
}

function applyPending() {
  for (const [f, p] of Object.entries(pendingA)) A.set(f, p.value);
  for (const [id, r] of Object.entries(pendingT)) T.set(id, r);
}

function remoteAnswer(row) {
  if (!row?.field) return;
  if (pendingA[row.field]) return; // our newer local edit wins until it's saved
  if (sentAt[row.field] && Date.parse(row.updated_at) < sentAt[row.field] - 1) return; // stale echo
  if (A.get(row.field) === row.value) return;
  A.set(row.field, row.value);
  writeCacheSoon();
  updateField(row.field);
  refreshDynamic();
}

function remoteAttempt(row) {
  if (!row?.id || pendingT[row.id]) return;
  T.set(row.id, row);
  writeCacheSoon();
  refreshDynamic();
}

// ------------------------------------------------------------------ saving
let flushTimer, retryTimer, flushing = false;

function setAnswer(field, value) {
  A.set(field, value);
  const now = Date.now();
  sentAt[field] = now;
  pendingA[field] = { value, updated_at: new Date(now).toISOString() };
  persistPending();
  scheduleFlush();
}

function setAttempt(row) {
  T.set(row.id, row);
  pendingT[row.id] = row;
  persistPending();
  scheduleFlush(50);
}

function persistPending() {
  LS.set(`ia:pendA:${team.id}`, pendingA);
  LS.set(`ia:pendT:${team.id}`, pendingT);
  writeCacheSoon();
}

function scheduleFlush(ms = 600) {
  setSave('saving');
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

async function flush() {
  if (flushing) { scheduleFlush(300); return; }
  flushing = true;
  clearTimeout(retryTimer);
  const batchA = { ...pendingA };
  const batchT = { ...pendingT };
  try {
    await store.saveAnswers(team.id, Object.entries(batchA).map(([field, p]) => ({ field, value: p.value, updated_at: p.updated_at })));
    for (const [f, p] of Object.entries(batchA)) if (pendingA[f] === p) delete pendingA[f];
    for (const [id, row] of Object.entries(batchT)) {
      await store.saveAttempt(row);
      if (pendingT[id] === row) delete pendingT[id];
    }
    persistPending();
    if (Object.keys(pendingA).length || Object.keys(pendingT).length) scheduleFlush(200);
    else setSave('saved');
  } catch (e) {
    console.warn('Save failed, will retry', e);
    setSave('offline');
    retryTimer = setTimeout(flush, 5000);
  } finally {
    flushing = false;
  }
}

function setSave(state) {
  const el = document.getElementById('save');
  if (!el) return;
  el.dataset.state = state;
  el.textContent = { saving: 'Saving…', saved: '✓ Saved', offline: 'Offline · kept on this device, will sync' }[state] || '';
}

let cacheTimer;
function writeCacheSoon() { clearTimeout(cacheTimer); cacheTimer = setTimeout(writeCache, 1500); }
function writeCache() { if (team) LS.set(`ia:cache:${team.id}`, { a: [...A], t: [...T.values()] }); }

// ------------------------------------------------------------------ rotation clock
async function pollRotation() {
  try { rotation = await store.getRotation(team.class_code); } catch { /* keep last known */ }
  tick();
}

function rotationInfo() {
  if (!rotation?.start) return { state: 'waiting' };
  const elapsed = Date.now() - rotation.start;
  const slot = Math.floor(elapsed / (SLOT_MIN * 60000));
  if (slot >= 6) return { state: 'part2' };
  if (slot < 0) return { state: 'waiting' };
  return { state: 'running', slot, left: SLOT_MIN * 60000 * (slot + 1) - elapsed };
}

function tick() {
  const r = rotationInfo();
  const key = `${r.state}-${r.slot}-${A.get('group')}`;
  if (key !== rotKey) { rotKey = key; refreshDynamic(); }
  document.querySelectorAll('[data-rot-left]').forEach((el) => { el.textContent = r.left != null ? mmss(r.left) : ''; });
}

// ------------------------------------------------------------------ shell + routing
function currentPage() {
  const id = location.hash.replace(/^#\/?/, '') || 'home';
  return PAGES.find((p) => p.id === id) || PAGES[0];
}

function renderShell() {
  app.innerHTML = `
    <header class="top">
      <button class="icon-btn menu-btn" id="menu" aria-label="Menu" aria-expanded="false">☰</button>
      <a class="brand" href="#/home"><strong>Interdisciplinary Approaches</strong><span>Optimising jump performance</span></a>
      <span class="save" id="save" aria-live="polite"></span>
      <div class="team-wrap">
        <button class="team-chip" id="teamchip" aria-expanded="false" aria-controls="teammenu">${esc(team.name)} <span aria-hidden="true">\u25be</span></button>
        <div class="team-menu" id="teammenu" hidden>
          <p class="small muted">You\u2019re in <strong>${esc(team.name)}</strong><br>Class ${esc(team.class_code)}</p>
          <button type="button" class="btn primary" id="menucopy">\u{1F517} Copy team link</button>
          <button type="button" class="btn" id="menuswitch">Switch team / start page</button>
        </div>
      </div>
    </header>
    <div class="layout">
      <nav id="nav" class="nav" aria-label="Sections"></nav>
      <main id="main" tabindex="-1"></main>
    </div>`;
  document.getElementById('menu').onclick = () => toggleNav();
  const chip = document.getElementById('teamchip'), menu = document.getElementById('teammenu');
  const closeMenu = () => { menu.hidden = true; chip.setAttribute('aria-expanded', 'false'); };
  chip.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; chip.setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  document.getElementById('menucopy').onclick = (e) => copyTeamLink(e.currentTarget);
  document.getElementById('menuswitch').onclick = switchTeam;
  bindMain(document.getElementById('main'));
  window.addEventListener('hashchange', () => { renderPage(); toggleNav(false); });
  renderPage();
  setSave(Object.keys(pendingA).length ? 'saving' : 'saved');
}

function toggleNav(open) {
  const nav = document.getElementById('nav');
  const on = open ?? !nav.classList.contains('open');
  nav.classList.toggle('open', on);
  document.getElementById('menu').setAttribute('aria-expanded', on);
}

function renderNav(page) {
  const groups = [];
  for (const p of PAGES) {
    let g = groups.find((x) => x.name === p.group);
    if (!g) groups.push(g = { name: p.group, pages: [] });
    g.pages.push(p);
  }
  const r = rotationInfo();
  const g = Number(A.get('group'));
  const here = r.state === 'running' && g ? stationFor(g, r.slot) : null;
  document.getElementById('nav').innerHTML = groups.map((grp) => `
    <div class="nav-group"><p class="nav-head">${esc(grp.name)}</p>
      ${grp.pages.map((p) => `<a href="#/${p.id}" class="${p.id === page.id ? 'on' : ''} ${p.tag ? 'tag-' + p.tag : ''}" ${p.id === page.id ? 'aria-current="page"' : ''}>
        <span>${esc(p.short)}</span>${p.station && p.station === here ? '<em class="now">now</em>' : ''}${pageDone(p) ? '<i class="tick" aria-label="has content">✓</i>' : ''}</a>`).join('')}
    </div>`).join('') + `<div class="nav-group"><p class="nav-head">${esc(team.name)}</p><button type="button" class="nav-link-btn" id="navcopy">\u{1F517} Copy team link</button></div>`;
  document.getElementById('navcopy').onclick = (e) => copyTeamLink(e.currentTarget);
}

const pageDone = (p) => pageHasContent(p, A);

// ------------------------------------------------------------------ page rendering
let regions = [];   // dynamic region renderers for the current page

function renderPage() {
  const page = currentPage();
  regions = [];
  const blocks = page.id === 'summary' ? summaryBlocks() : page.blocks;
  const idx = PAGES.indexOf(page);
  const prev = PAGES[idx - 1], next = PAGES[idx + 1];
  const showBanner = page.station;
  const main = document.getElementById('main');
  main.innerHTML = `
    <article class="page page-${page.id} ${page.tag ? 'tag-' + page.tag : ''}">
      <p class="eyebrow">${esc(page.group)}${page.mins ? ` · <span class="mins">${page.mins} min</span>` : ''}</p>
      <h1>${esc(page.title)}</h1>
      ${page.phases.length ? `<div class="phases" aria-label="Support model phases">${PHASES.map((p) => `<span class="phase ${page.phases.includes(p.id) ? 'on' : ''}">${p.label}</span>`).join('')}</div>` : ''}
      ${showBanner ? region(() => bannerHTML()) : ''}
      ${blocks.map(blockHTML).join('')}
      <div class="pager">
        ${prev ? `<a class="btn" href="#/${prev.id}">← ${esc(prev.short)}</a>` : '<span></span>'}
        ${next ? `<a class="btn primary" href="#/${next.id}">${esc(next.short)} →</a>` : ''}
      </div>
    </article>`;
  renderNav(page);
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// A dynamic region re-renders when data changes, unless someone is typing inside it.
function region(fn, cls = '') {
  const i = regions.push(fn) - 1;
  return `<div class="dyn ${cls}" data-dyn="${i}">${fn()}</div>`;
}

function refreshDynamic(force) {
  if (!team || !document.getElementById('main')) return;
  document.querySelectorAll('[data-dyn]').forEach((el) => {
    if (el !== force && el.contains(document.activeElement) && document.activeElement !== document.body) {
      el.dataset.dirty = '1';
      return;
    }
    rerender(el);
  });
  renderNav(currentPage());
}

function rerender(el) {
  const fn = regions[Number(el.dataset.dyn)];
  if (!fn) return;
  el.innerHTML = fn();
  delete el.dataset.dirty;
}

function updateField(field) {
  document.querySelectorAll(`[data-field="${CSS.escape(field)}"]`).forEach((el) => {
    if (el !== document.activeElement) el.value = A.get(field) || '';
  });
  document.querySelectorAll(`[data-rate="${CSS.escape(field)}"]`).forEach((el) => {
    el.classList.toggle('on', el.dataset.v === A.get(field));
  });
}

function blockHTML(b) {
  switch (b.type) {
    case 'note': return `<section class="block note">${b.html}</section>`;
    case 'columns': return `<div class="columns cols-${b.blocks.length}">${b.blocks.map(blockHTML).join('')}</div>`;
    case 'field': return fieldHTML(b);
    case 'short': return `<label class="block fieldset"><span class="label">${esc(b.label)}</span>
      <input data-field="${esc(b.id)}" value="${esc(A.get(b.id))}" placeholder="${esc(b.placeholder || '')}" autocomplete="off"></label>`;
    case 'rating': return `<div class="block fieldset"><span class="label">${esc(b.label)}</span>${region(() => ratingHTML(b))}</div>`;
    case 'list': return `<section class="block list-block ${b.disc && b.disc !== 'choose' ? 'tag-' + b.disc : ''}">
      <h3 class="label">${b.disc && b.disc !== 'choose' ? `<span class="dot d-${b.disc}"></span>` : ''}${esc(b.label)}</h3>
      ${b.hint ? `<p class="hint">${b.hint}</p>` : ''}
      ${region(() => listHTML(b))}
      <div class="add"><input data-add="${b.id}" placeholder="${esc(b.placeholder || 'Add')}" autocomplete="off" enterkeyhint="done"><button class="btn" data-addbtn="${b.id}">Add</button></div>
    </section>`;
    case 'starred': return `<section class="block panel"><h3 class="label">★ ${esc(b.label)}</h3>${region(() => starredHTML(b))}</section>`;
    case 'athleteView': return `<section class="block"><h3 class="label">Does your athlete agree with your priorities?</h3>${region(() => athleteViewHTML(b))}</section>`;
    case 'timeline': return `<section class="block"><h3 class="label">Timeline</h3>${region(() => timelineHTML(b))}</section>`;
    case 'pull': return `<section class="block panel"><h3 class="label">${esc(b.label)}</h3>${region(() => pullHTML(b.list))}</section>`;
    case 'questions': return b.items.map((q) => `<label class="block fieldset question"><span class="qtag">${esc(q.tag)}</span><span class="label">${esc(q.q)}</span>
      <textarea data-field="${q.id}" rows="3">${esc(A.get(q.id))}</textarea></label>`).join('');
    case 'calc': return calcHTML();
    case 'attempts': return attemptsHTML(b.phase);
    case 'rotation': return region(() => rotationHTML(), 'rotation');
    case 'summary': return region(() => summaryHTML());
    case 'teamlink': return teamLinkHTML();
    case 'teamcard': return region(() => teamCardHTML());
    case 'feedback': return region(() => feedbackHTML());
    case 'lens': return lensHTML(b);
    case 'frameworkMap': return frameworkMapHTML();
    case 'spectrum': return `<section class="block card spectrum">${region(() => spectrumHTML())}</section>`;
    case 'vote': return voteBlock(b);
    case 'choice': return `<div class="block fieldset"><span class="label">${esc(b.label)}</span>${region(() => choiceHTML(b))}</div>`;
    case 'chips': return `<div class="block fieldset ${b.tone ? 'tone tone-' + b.tone : ''}"><span class="label">${esc(b.label)}</span>${b.hint ? `<small class="hint">${esc(b.hint)}</small>` : ''}${region(() => chipsHTML(b))}</div>`;
    case 'matrix': return `<section class="block card">${region(() => matrixHTML(b))}</section>`;
    case 'sorter': return `<section class="block card"><h3 class="label">${esc(b.label)}</h3>${region(() => sorterHTML(b))}</section>`;
    case 'web': return webBlock(b);
    case 'itemChoice': return `<section class="block card"><h3 class="label">${esc(b.label)}</h3>${b.hint ? `<p class="hint">${esc(b.hint)}</p>` : ''}${region(() => itemChoiceHTML(b))}</section>`;
    case 'predictCompare': return `<section class="block card"><h3 class="label">Predicted vs actual</h3>${region(() => predictCompareHTML())}</section>`;
    case 'claim': return claimHTML(b);
    case 'rule': return ruleHTML(b);
    case 'varMethods': return `<div class="block fieldset tone tone-phase"><span class="label">2 \u00b7 Analyse: how will you get each one?</span>${region(() => varMethodsHTML())}</div>`;
    case 'roles': return `<section class="block card"><h3 class="label">Agree roles</h3><p class="hint">Every interdisciplinary team needs someone checking the disciplines actually connect.</p>${region(() => rolesHTML())}</section>`;
    case 'athletePick': return `<section class="block card"><h3 class="label">Athlete: tap the limiters <em>you</em> think matter most</h3><p class="hint">Hand the phone to your athlete. \u2605 marks your team\u2019s priorities.</p>${region(() => athletePickHTML(b))}</section>`;
    case 'prepost': return prepostBlock(b);
    case 'compare': return compareBlock();
    case 'spectrumShift': return region(() => spectrumShiftHTML());
    default: return '';
  }
}

function fieldHTML(b) {
  return `<label class="block fieldset ${b.tone ? 'tone tone-' + b.tone : ''}"><span class="label">${esc(b.label)}</span>
    ${b.hint ? `<small class="hint">${b.hint}</small>` : ''}
    <textarea data-field="${esc(b.id)}" rows="${b.rows || 3}">${esc(A.get(b.id))}</textarea></label>`;
}

function ratingHTML(b) {
  const v = A.get(b.id) || '';
  let h = '<div class="rating" role="group">';
  for (let i = 1; i <= (b.max || 10); i++) h += `<button type="button" data-rate="${b.id}" data-v="${i}" class="${String(i) === v ? 'on' : ''}" aria-pressed="${String(i) === v}">${i}</button>`;
  return h + '</div>';
}

// ------------------------------------------------------------------ lists
function items(listId) {
  const pre = `list:${listId}:`;
  const out = [];
  for (const [k, v] of A) {
    if (!k.startsWith(pre)) continue;
    const it = parse(v);
    if (it && !it.del && it.text != null) out.push({ ...it, key: k });
  }
  return out.sort((a, b) => (a.t || 0) - (b.t || 0));
}

function discSelect(key, d) {
  return `<select class="disc-select d-${d || 'none'}" data-idisc="${key}" aria-label="Discipline">
    <option value="">Discipline…</option>
    ${Object.entries(DISC).map(([id, x]) => `<option value="${id}" ${id === d ? 'selected' : ''}>${x.label}</option>`).join('')}</select>`;
}

function listHTML(b) {
  const its = items(b.id);
  if (!its.length) return `<p class="empty">Nothing yet.</p>`;
  return `<ul class="items">${its.map((it) => `
    <li class="item ${b.when || b.also ? 'rich' : ''}">
      <div class="item-row">
        ${b.disc === 'choose' ? discSelect(it.key, it.d) : ''}
        <input class="item-text" data-item="${esc(it.key)}" value="${esc(it.text)}" aria-label="Edit item">
        ${b.star ? `<button type="button" class="star ${it.star ? 'on' : ''}" data-star="${esc(it.key)}" aria-pressed="${!!it.star}" aria-label="Priority">★</button>` : ''}
        <button type="button" class="del" data-del="${esc(it.key)}" aria-label="Remove">×</button>
      </div>
      ${b.when || b.also ? `<div class="item-row sub">
        ${b.when ? `<select data-iwhen="${esc(it.key)}" aria-label="When"><option value="">When?</option>${WHEN.map((w) => `<option value="${w.id}" ${w.id === it.when ? 'selected' : ''}>${w.label}</option>`).join('')}</select>` : ''}
        ${b.also ? `<span class="also-label">Also affects</span>${['phys', 'bio', 'psy'].filter((d) => d !== it.d).map((d) => `<button type="button" class="chip d-${d} ${(it.also || []).includes(d) ? 'on' : ''}" data-ialso="${esc(it.key)}" data-d="${d}" aria-pressed="${(it.also || []).includes(d)}">${DISC[d].short}</button>`).join('')}` : ''}
      </div>` : ''}
    </li>`).join('')}</ul>`;
}

function setItem(key, patch) {
  const cur = parse(A.get(key)) || {};
  setAnswer(key, JSON.stringify({ ...cur, ...patch }));
}

function chipHTML(it, withAlso = true) {
  const also = withAlso && it.also?.length ? `<span class="also">${it.also.map((d) => `<span class="mini d-${d}">${DISC[d].short}</span>`).join('')}</span>` : '';
  return `<span class="pill d-${it.d || 'none'}"><span class="dot d-${it.d || 'none'}"></span>${esc(it.text)}${also}</span>`;
}

function starredItems(lists) {
  return lists.flatMap((l) => items(l).filter(isPriority));
}

function starredHTML(b) {
  const its = starredItems(b.lists);
  if (!its.length) return `<p class="empty">Star ★ limiters in Task 3 and they’ll appear here.</p>`;
  return `<div class="pills">${its.map((i) => chipHTML(i)).join('')}</div>`;
}

function athleteViewHTML(b) {
  const its = starredItems(b.lists);
  if (!its.length) return `<p class="empty">Star ★ your priorities in <a href="#/s1-3">Task 3</a> first.</p>`;
  const opts = [['agree', 'Agrees'], ['unsure', 'Unsure'], ['disagree', 'Doesn’t see it']];
  return `<ul class="av">${its.map((i) => {
    const f = `av:${i.key}`, n = `avn:${i.key}`, v = A.get(f) || '';
    return `<li>${chipHTML(i, false)}
      <div class="seg" role="group">${opts.map(([id, l]) => `<button type="button" data-rate="${esc(f)}" data-v="${id}" class="${v === id ? 'on' : ''} v-${id}">${l}</button>`).join('')}</div>
      <input data-field="${esc(n)}" value="${esc(A.get(n))}" placeholder="What did they say?" autocomplete="off"></li>`;
  }).join('')}</ul>`;
}

function timelineHTML(b) {
  const its = items(b.list);
  if (!its.length) return `<p class="empty">Add strategies above and say when each happens.</p>`;
  const cols = [...WHEN, { id: '', label: 'Not timed yet' }]
    .map((w) => ({ ...w, its: its.filter((i) => (i.when || '') === w.id) }))
    .filter((w) => w.its.length || w.id);
  return `<ol class="timeline">${cols.map((w) => `<li class="${w.its.length ? '' : 'empty-step'}"><span class="when">${esc(w.label)}</span>
    ${w.its.map((i) => chipHTML(i)).join('') || '<span class="muted small">—</span>'}</li>`).join('')}</ol>`;
}

function pullHTML(listId) {
  const its = items(listId);
  if (!its.length) return `<p class="empty">Nothing here yet.</p>`;
  return `<ul class="pull">${its.map((i) => `<li>${chipHTML(i)}${i.when ? `<span class="muted small"> · ${esc(WHEN.find((w) => w.id === i.when)?.label || '')}</span>` : ''}</li>`).join('')}</ul>`;
}

// ------------------------------------------------------------------ athletes
function athletes() {
  const a = [{ id: '1', name: A.get('athlete1')?.trim() || 'Athlete 1' }];
  if (A.get('athlete2')?.trim()) a.push({ id: '2', name: A.get('athlete2').trim() });
  return a;
}
const athleteName = (id) => (id === '2' ? A.get('athlete2')?.trim() || 'Athlete 2' : A.get('athlete1')?.trim() || 'Athlete 1');

// ------------------------------------------------------------------ calculator (Optojump station)
function calcHTML() {
  return `<section class="block card calc">
    <h3 class="label">Plyobox height estimator</h3>
    <div class="calc-grid">
      <label class="fieldset"><span class="label">Athlete</span><select id="c-ath">${['1', '2'].map((id) => `<option value="${id}">${esc(athleteName(id))}</option>`).join('')}</select></label>
      <label class="fieldset"><span class="label">CMJ height (cm)</span><input id="c-cmj" type="number" inputmode="decimal" min="0" max="120" step="0.1" placeholder="e.g. 40"></label>
      <label class="fieldset"><span class="label">Stature (cm)</span><input id="c-stat" type="number" inputmode="decimal" min="100" max="230" step="0.1" placeholder="e.g. 183"><small class="hint">Used for the sum only. Not saved.</small></label>
      <fieldset class="fieldset"><legend class="label">Hip-height estimate</legend>
        <label class="radio"><input type="radio" name="c-sex" value="m" checked> 52% of stature (men’s equation)</label>
        <label class="radio"><input type="radio" name="c-sex" value="f"> 49% of stature (women’s equation)</label></fieldset>
    </div>
    <div id="c-out" class="calc-out" aria-live="polite"><p class="muted">Enter CMJ height and stature.</p></div>
    <p class="muted small">Max box = hip height + CMJ height − landing position (33% of stature).</p>
    ${region(() => estimatesHTML())}
  </section>`;
}

function calcCompute() {
  const cmj = parseFloat(document.getElementById('c-cmj')?.value);
  const stat = parseFloat(document.getElementById('c-stat')?.value);
  const sex = document.querySelector('input[name="c-sex"]:checked')?.value || 'm';
  const out = document.getElementById('c-out');
  if (!out) return null;
  if (!(cmj > 0 && stat > 0)) { out.innerHTML = '<p class="muted">Enter CMJ height and stature.</p>'; return null; }
  const est = estimateBox(cmj, stat, sex);
  out.innerHTML = `
    <p class="big">${fmtCm(est)} cm <span>estimated maximum box</span></p>
    <p class="muted small">Hip height ${fmtCm(stat * (sex === 'm' ? 0.52 : 0.49))} cm + CMJ ${fmtCm(cmj)} cm − landing position ${fmtCm(stat * 0.33)} cm</p>
    ${boxBars(est)}
    <button type="button" class="btn primary" id="c-save">Save estimate for ${esc(athleteName(document.getElementById('c-ath').value))}</button>`;
  return { cmj, est };
}

function boxBars(est) {
  return `<div class="boxes">${BOXES.map((b) => {
    const ok = est >= b.cm, close = !ok && est >= b.cm - 5;
    return `<div class="box ${ok ? 'ok' : close ? 'close' : 'no'}"><span class="box-h" style="--h:${b.cm}"></span><strong>${b.label}</strong><span>${ok ? 'Within estimate' : close ? 'Just beyond' : 'Beyond estimate'}</span></div>`;
  }).join('')}</div>`;
}

function estimatesHTML() {
  const rows = ['1', '2'].map((id) => ({ id, e: parse(A.get(`est:${id}`)) })).filter((r) => r.e);
  if (!rows.length) return '';
  return `<h4 class="label">Saved estimates</h4><ul class="pull">${rows.map((r) => `<li><strong>${esc(athleteName(r.id))}</strong>: CMJ ${fmtCm(r.e.cmj)} cm → <strong>${fmtCm(r.e.est)} cm</strong> estimated max box</li>`).join('')}</ul>`;
}

// ------------------------------------------------------------------ attempts log
function strategyOptions() {
  const all = [...items('final_plan'), ...items('strategies')];
  const seen = new Set();
  const uniq = all.filter((i) => { const k = i.text.trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  return `<option value="">None / baseline</option>${uniq.map((i) => `<option value="${esc(i.key)}">${esc(i.text)}${i.d ? ` (${DISC[i.d].short})` : ''}</option>`).join('')}<option value="__other">Something else (describe in notes)</option>`;
}

function attemptsHTML(phase) {
  const box = phase === 'box';
  return `<section class="block card attempts" data-phase="${phase}">
    <h3 class="label">${box ? 'Box attempts' : 'Optojump attempts'}</h3>
    <form class="attempt-form" data-attempt-form="${phase}">
      <label class="fieldset"><span class="label">Athlete</span><select name="athlete" data-athletes>${athletes().map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
      ${box
        ? `<label class="fieldset"><span class="label">Box</span><select name="box">${BOXES.map((b) => `<option value="${b.cm}">${b.label}</option>`).join('')}</select></label>
           <label class="fieldset"><span class="label">Outcome</span><select name="success"><option value="1">Made it</option><option value="0">Didn’t make it</option></select></label>`
        : `<label class="fieldset"><span class="label">Jump height (cm)</span><input name="height" type="number" inputmode="decimal" step="0.1" min="0" max="120" required></label>`}
      <label class="fieldset wide"><span class="label">Strategy used for this attempt</span><select name="strategy" data-strats>${strategyOptions()}</select></label>
      <label class="fieldset"><span class="label">Athlete confidence (1–10)</span><select name="confidence"><option value="">–</option>${Array.from({ length: 10 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
      <label class="fieldset wide"><span class="label">Notes</span><input name="notes" placeholder="Technique, how it felt, what you’ll change next" autocomplete="off"></label>
      <button class="btn primary wide">Log attempt</button>
    </form>
    ${region(() => attemptLogHTML(phase))}
  </section>`;
}

function phaseAttempts(phase) {
  return [...T.values()].filter((r) => r.phase === phase).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

function attemptLogHTML(phase) {
  const rows = phaseAttempts(phase);
  if (!rows.length) return `<p class="empty">No attempts logged yet.</p>`;
  const box = phase === 'box';
  const ids = [...new Set(rows.map((r) => r.athlete))];
  const summary = ids.map((id) => {
    const mine = rows.filter((r) => r.athlete === id);
    const best = box ? Math.max(0, ...mine.filter((r) => r.success).map((r) => Number(r.box_cm))) : Math.max(...mine.map((r) => Number(r.height_cm)));
    const first = box ? null : Number(mine[0].height_cm);
    return `<div class="stat"><span class="stat-k">${esc(athleteName(id))}</span><strong>${best ? fmtCm(best) + ' cm' : '—'}</strong><span class="muted small">${box ? 'highest box cleared' : `best jump${mine.length > 1 ? ` (${best - first >= 0 ? '+' : ''}${fmtCm(best - first)} cm vs first)` : ''}`} · ${mine.length} attempt${mine.length > 1 ? 's' : ''}</span></div>`;
  }).join('');
  return `<div class="stats">${summary}</div>
    ${chartSVG(rows, phase, athleteName)}
    <ol class="log">${rows.map((r) => `<li>
      <span class="log-a">${esc(athleteName(r.athlete))}</span>
      <span class="log-v ${box ? (r.success ? 'ok' : 'no') : ''}">${box ? `${fmtCm(r.box_cm)} cm ${r.success ? '✓' : '✗'}` : `${fmtCm(r.height_cm)} cm`}</span>
      <span class="log-s">${r.strategy ? `<span class="dot d-${r.discipline || 'none'}"></span>${esc(r.strategy)}` : '<span class="muted">Baseline</span>'}${r.confidence ? ` · confidence ${r.confidence}/10` : ''}</span>
      ${r.notes ? `<span class="log-n">${esc(r.notes)}</span>` : ''}
      <button type="button" class="del" data-void="${r.id}" aria-label="Remove attempt">×</button></li>`).join('')}</ol>`;
}

// ------------------------------------------------------------------ rotation
function bannerHTML() {
  const r = rotationInfo(), g = Number(A.get('group'));
  if (!g) return `<p class="banner">Set your group number on the <a href="#/stations">rotation page</a> to see where you should be.</p>`;
  if (r.state === 'waiting') return `<p class="banner">Group ${g}: start at <a href="#/st-${stationFor(g, 0)}">Station ${stationFor(g, 0)}</a> when your tutor starts the clock.</p>`;
  if (r.state === 'part2') return `<p class="banner">Stations finished. On to the <a href="#/challenge">box challenge</a>.</p>`;
  const s = stationFor(g, r.slot);
  const page = PAGES.find((p) => p.station === s);
  return `<p class="banner live">Group ${g} · now at <a href="#/st-${s}">${esc(page.title)}</a> · <span data-rot-left>${mmss(r.left)}</span> left</p>`;
}

function rotationHTML() {
  const g = Number(A.get('group'));
  const r = rotationInfo();
  const picker = `<div class="fieldset"><span class="label">Your group number</span><small class="hint">Your tutor will give you this on the day.</small>
    <div class="rating">${Array.from({ length: 8 }, (_, i) => `<button type="button" data-rate="group" data-v="${i + 1}" class="${g === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div></div>`;
  if (!g) return picker;
  let status;
  if (r.state === 'waiting') status = `<p class="now-big">Start at <a href="#/st-${stationFor(g, 0)}">Station ${stationFor(g, 0)}</a></p><p class="muted">Waiting for your tutor to start the clock.</p>`;
  else if (r.state === 'part2') status = `<p class="now-big">Stations done</p><p><a class="btn primary" href="#/challenge">Go to the box challenge →</a></p>`;
  else {
    const s = stationFor(g, r.slot), n = stationFor(g, r.slot + 1);
    status = `<p class="now-big">Now: <a href="#/st-${s}">${esc(PAGES.find((p) => p.station === s).title)}</a></p>
      <p><strong data-rot-left>${mmss(r.left)}</strong> left${r.slot < 5 ? ` · next: Station ${n}` : ' · then the box challenge'}</p>`;
  }
  const route = Array.from({ length: 6 }, (_, slot) => {
    const s = stationFor(g, slot);
    const p = PAGES.find((x) => x.station === s);
    return `<li class="${r.state === 'running' && r.slot === slot ? 'on' : ''} tag-${p.tag}"><span class="muted small">${slot * SLOT_MIN}–${(slot + 1) * SLOT_MIN} min</span><a href="#/st-${s}">${esc(p.short)}</a></li>`;
  }).join('');
  return `${picker}<div class="card rot-status">${status}</div><h3 class="label">Your route</h3><ol class="route">${route}<li class="tag-oth"><span class="muted small">90+ min</span><a href="#/challenge">Box challenge</a></li></ol>`;
}

// ------------------------------------------------------------------ team link
// Back to the join screen. The team's work stays saved; it can be rejoined from the list.
function switchTeam() {
  LS.del('ia:team');
  location.href = `${location.pathname}?class=${encodeURIComponent(team.class_code)}`;
}

function feedbackHTML() {
  const fb = A.get('tutor_feedback')?.trim();
  if (!fb) return '';
  return `<section class="block tutor-fb"><p class="eyebrow">Feedback from your tutor</p><p>${esc(fb).replace(/\n/g, '<br>')}</p></section>`;
}

function teamCardHTML() {
  return `<section class="block card teamcard">
    <p class="eyebrow">Your team</p>
    <p class="teamcard-name">${esc(team.name)}</p>
    <p class="small muted">Class ${esc(team.class_code)} \u00b7 everything your team adds saves here automatically.</p>
    ${A.get('tutor_feedback')?.trim() ? `<p class="fb-note"><a href="#/summary">\u{1F4DD} You have feedback from your tutor \u2192</a></p>` : ''}
    <div class="teamcard-actions">
      <button type="button" class="btn primary" data-copylink>\u{1F517} Copy team link</button>
      <button type="button" class="btn" data-switchteam>Switch team / start page</button>
    </div>
  </section>`;
}

function teamLink() {
  const u = new URL(location.href);
  u.search = `?class=${encodeURIComponent(team.class_code)}&team=${team.id}`;
  u.hash = '#/home';
  return u.toString();
}

function teamLinkHTML() {
  return `<section class="block card teamlink">
    <h3 class="label">Your team link</h3>
    <p class="hint">Opens straight into <strong>${esc(team.name)}</strong>. Share it in your team chat, and use it to come back later for the screencast.</p>
    <div class="add"><input readonly value="${esc(teamLink())}" aria-label="Team link" onfocus="this.select()"><button type="button" class="btn primary" data-copylink>Copy link</button></div>
  </section>`;
}

async function copyTeamLink(btn) {
  const link = teamLink();
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: team.name, url: link });
    else { await navigator.clipboard.writeText(link); if (btn) btn.textContent = '\u2713 Copied'; }
  } catch {
    prompt('Copy your team link:', link);
  }
}

// ------------------------------------------------------------------ item attributes
// Extra per-item data (matrix position, sort category, predicted effect...) lives in its own answer row,
// so two people working on the same item never overwrite each other.
const attrKey = (key, name) => `attr:${key}:${name}`;
const getAttr = (key, name) => A.get(attrKey(key, name)) || '';
const itemsOf = (lists) => lists.flatMap((l) => items(l));
const isPriority = (i) => (getAttr(i.key, 'q') ? getAttr(i.key, 'q') === 'hh' : !!i.star);
const itemText = (key) => parse(A.get(key))?.text || '';
let sel = null; // { blk, key }: item picked in a matrix or sorter, waiting for a target

function uniqueByText(its) {
  const seen = new Set();
  return its.filter((i) => { const k = i.text.trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

function pickChip(i, blk) {
  const on = sel?.key === i.key && sel.blk === blk;
  return `<button type="button" class="pick pill d-${i.d || 'none'} ${on ? 'picked' : ''}" data-pick="${esc(i.key)}" data-blk="${blk}" aria-pressed="${on}"><span class="dot d-${i.d || 'none'}"></span>${esc(i.text)}</button>`;
}

function pickHelp(blk, idle) {
  return `<p class="pick-help ${sel?.blk === blk ? 'active' : ''}">${sel?.blk === blk ? `Now tap where <strong>${esc(itemText(sel.key))}</strong> belongs.` : idle}</p>`;
}

// ------------------------------------------------------------------ frameworks
function fwDetailHTML(id) {
  const f = fw(id);
  const out = FW_EDGES.filter((e) => e.from === id).map((e) => `${esc(e.label)} <button type="button" class="linkish" data-fw="${e.to}">${esc(fw(e.to).name)}</button>`);
  const inn = FW_EDGES.filter((e) => e.to === id).map((e) => `<button type="button" class="linkish" data-fw="${e.from}">${esc(fw(e.from).name)}</button> ${esc(e.label)} this`);
  return `<h3>${esc(f.name)} <span class="muted fw-person">${esc(f.person)}</span></h3>
    <p class="small muted">${esc(f.source)}</p>
    <p><strong>Core idea.</strong> ${f.idea}</p>
    <p><strong>In the box jump.</strong> ${f.jump}</p>
    ${f.sport ? `<p class="small"><strong>In sport:</strong> ${f.sport}</p>` : ''}
    <p class="lens-q">${esc(f.ask)}</p>
    <p class="small muted fw-links">${[...out, ...inn].join(' · ')}</p>`;
}

function frameworkMapHTML() {
  const W = 236, H = 62;
  const pt = (id) => ({ x: FW_POS[id][0], y: FW_POS[id][1] });
  const clip = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const s = Math.min(dx ? (W / 2 + 4) / Math.abs(dx) : Infinity, dy ? (H / 2 + 4) / Math.abs(dy) : Infinity);
    return { x: a.x + dx * s, y: a.y + dy * s };
  };
  const edges = FW_EDGES.map((e) => {
    const a = pt(e.from), b = pt(e.to);
    let path, lx, ly, rot = '';
    if (e.from === 'dynamical' && e.to === 'systems') {
      path = `M${a.x + W / 2},${a.y} C 880,${a.y} 880,${b.y} ${b.x + W / 2 + 6},${b.y}`;
      lx = 868; ly = (a.y + b.y) / 2; rot = ` transform="rotate(90 ${lx} ${ly})"`;
    } else {
      const p = clip(a, b), q = clip(b, a);
      path = `M${p.x},${p.y} L${q.x},${q.y}`;
      lx = (p.x + q.x) / 2; ly = (p.y + q.y) / 2 + 4;
    }
    return `<path class="fw-edge ${e.dashed ? 'dashed' : ''}" d="${path}" marker-end="url(#fw-arrow)"/>
      <text class="fw-elabel" x="${lx}" y="${ly}" text-anchor="middle"${rot}>${esc(e.label)}</text>`;
  }).join('');
  const nodes = FRAMEWORKS.map((f) => {
    const { x, y } = pt(f.id);
    return `<g class="fw-node tier-${f.tier}" data-fw="${f.id}" tabindex="0" role="button" aria-label="${esc(f.name)}">
      <rect x="${x - W / 2}" y="${y - H / 2}" width="${W}" height="${H}" rx="10"/>
      <text x="${x}" y="${y - 4}" text-anchor="middle" class="fw-name">${esc(f.name)}</text>
      <text x="${x}" y="${y + 16}" text-anchor="middle" class="fw-who">${esc(f.person)}</text></g>`;
  }).join('');
  return `<section class="block card fw-map">
    <svg viewBox="0 0 900 760" class="fw-svg" role="group" aria-label="Map of interdisciplinary frameworks">
      <defs><marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fw-arrowhead"/></marker></defs>
      ${edges}${nodes}
    </svg>
    <div class="fw-list">${FRAMEWORKS.map((f) => `<button type="button" class="fw-list-item tier-${f.tier}" data-fw="${f.id}"><strong>${esc(f.name)}</strong><span>${esc(f.person)}</span></button>`).join('')}</div>
    <p class="fw-legend small"><span class="key-found"></span> Foundational <span class="key-applied"></span> Applied <span class="muted">· dashed = feedback</span></p>
    <div class="fw-panel" id="fw-panel" aria-live="polite"><p class="muted">Tap a framework to explore it.</p></div>
  </section>`;
}

function showFramework(id) {
  const panel = document.getElementById('fw-panel');
  if (!panel) return;
  panel.innerHTML = fwDetailHTML(id);
  document.querySelectorAll('.fw-node, .fw-list-item').forEach((n) => n.classList.toggle('on', n.dataset.fw === id));
  panel.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function lensHTML(b) {
  return `<aside class="block lens">
    <p class="lens-head"><span class="lens-tag">Framework lens</span>${b.fw.map((id) => `<button type="button" class="fw-chip tier-${fw(id).tier}" data-fwinfo="${id}" aria-expanded="false">${esc(fw(id).name)} <span aria-hidden="true">ⓘ</span></button>`).join('')}</p>
    <div class="fw-detail" hidden></div>
    <p>${b.text}</p>
    <p class="lens-q">${esc(b.q)}</p>
  </aside>`;
}

// ------------------------------------------------------------------ spectrum (mono / multi / inter / trans)
function spectrumHTML() {
  const label = (id) => SPECTRUM.find((s) => s.id === id).label;
  let answered = 0, agreed = 0;
  const rows = SPECTRUM_EXAMPLES.map((ex, n) => {
    const f = `spec:${ex.id}`, v = A.get(f) || '';
    if (v) { answered++; if (v === ex.answer) agreed++; }
    return `<li class="spec-ex"><p><span class="spec-n">${n + 1}</span>${esc(ex.text)}</p>
      <div class="seg spec-opts">${SPECTRUM.map((s) => `<button type="button" data-rate="${f}" data-v="${s.id}" class="${v === s.id ? 'on' : ''}">${s.label}</button>`).join('')}</div>
      ${v ? `<p class="spec-fb ${v === ex.answer ? 'agree' : 'differ'}">${v === ex.answer ? '✓ Most would agree.' : `Many would call this <strong>${label(ex.answer)}</strong>.`} ${esc(ex.why)}</p>` : ''}</li>`;
  }).join('');
  return `<dl class="spec-defs">${SPECTRUM.map((s, i) => `<div class="spec-def s${i}"><dt>${s.label}disciplinary</dt><dd>${s.def}</dd></div>`).join('')}</dl>
    <p class="small muted">${SPECTRUM_SOURCE} The boundaries are contested, which is worth critiquing in Assessment 1.</p>
    <ol class="spec-list">${rows}</ol>
    ${answered ? `<p class="small"><strong>${agreed} of ${answered}</strong> match the suggested answer. Where you differ, is your reasoning defensible?</p>` : ''}`;
}

// ------------------------------------------------------------------ per-person votes
function voteHTML(b) {
  const field = `vote:${b.id}:${DEVICE}`, mine = A.get(field) || '';
  const all = [...A].filter(([k, v]) => k.startsWith(`vote:${b.id}:`) && v).map(([, v]) => v);
  const counts = b.options.map((o) => all.filter((v) => v === o.id).length);
  let spread = '';
  if (all.length >= 2) {
    if (b.scale) {
      const idx = all.map((v) => b.options.findIndex((o) => o.id === v));
      if (Math.max(...idx) - Math.min(...idx) >= 2) spread = 'Your team is split. Talk about why you see it differently.';
    } else if (new Set(all).size > 1) spread = 'Not everyone agrees. Talk about why.';
  }
  return `<div class="vote ${b.scale ? 'scale' : ''}" role="group">${b.options.map((o, i) => `<button type="button" class="vote-opt ${mine === o.id ? 'on' : ''}" data-rate="${field}" data-v="${o.id}" aria-pressed="${mine === o.id}">
      <span>${esc(o.label)}</span><span class="dots" aria-label="${counts[i]} votes">${'<i></i>'.repeat(counts[i])}</span></button>`).join('')}</div>
    <p class="small muted">${all.length} vote${all.length === 1 ? '' : 's'} from your team${mine ? '' : ' · tap to add yours'}</p>
    ${spread ? `<p class="spread">${spread}</p>` : ''}`;
}

function voteBlock(b) {
  return `<section class="block card vote-block"><h3 class="label">${esc(b.label)}</h3>${b.hint ? `<p class="hint">${esc(b.hint)}</p>` : ''}${region(() => voteHTML(b))}</section>`;
}

// ------------------------------------------------------------------ team-level choices and chips
function choiceHTML(b) {
  const v = A.get(b.id) || '';
  return `<div class="seg wrap">${b.options.map((o) => `<button type="button" data-rate="${b.id}" data-v="${o.id}" class="${v === o.id ? 'on' : ''}" aria-pressed="${v === o.id}">${esc(o.label)}</button>`).join('')}</div>`;
}

function chipsHTML(b) {
  return `<div class="chips">${b.options.map((o) => {
    const f = `${b.id}:${o.id}`, on = A.get(f) === '1';
    return `<button type="button" class="tchip ${on ? 'on' : ''} ${o.d ? 'd-' + o.d : ''}" data-toggle="${f}" aria-pressed="${on}">${o.d ? `<span class="dot d-${o.d}"></span>` : ''}${esc(o.label)}</button>`;
  }).join('')}</div>`;
}

// ------------------------------------------------------------------ priority matrix
function matrixHTML(b) {
  const its = itemsOf(b.lists);
  if (!its.length) return `<p class="empty">Add limiters above first.</p>`;
  const place = (i) => getAttr(i.key, b.id);
  const tray = its.filter((i) => !place(i));
  const cell = (id, title, cls = '') => `<div class="mx-cell ${cls}" data-drop="${id}" data-blk="${b.id}" data-attr="${b.id}" role="button" tabindex="0" aria-label="${esc(title)}">
    <span class="mx-title">${title}</span>${its.filter((i) => place(i) === id).map((i) => pickChip(i, b.id)).join('')}</div>`;
  return `${pickHelp(b.id, 'Tap a limiter, then tap the box it belongs in. Tap a placed one to move it.')}
    <div class="tray" data-drop="" data-blk="${b.id}" data-attr="${b.id}">${tray.length ? tray.map((i) => pickChip(i, b.id)).join('') : '<span class="muted small">All placed ✓</span>'}</div>
    <div class="matrix">
      <div class="mx-y" aria-hidden="true"><span>Higher impact</span><span>Lower impact</span></div>
      <div class="mx-grid">
        ${cell('hl', 'High impact · can’t change today')}
        ${cell('hh', '★ Priorities: high impact · can change today', 'prio')}
        ${cell('ll', 'Lower impact · can’t change today')}
        ${cell('lh', 'Lower impact · can change today')}
      </div>
      <div class="mx-x" aria-hidden="true"><span>Can’t change today</span><span>Can change today</span></div>
    </div>`;
}

// ------------------------------------------------------------------ sorter (constraints, Bronfenbrenner rings)
function sorterHTML(b) {
  const its = uniqueByText(itemsOf(b.lists));
  if (!its.length) return `<p class="empty">Add some items first.</p>`;
  const place = (i) => getAttr(i.key, b.id);
  const tray = its.filter((i) => !b.cats.some((c) => c.id === place(i)));
  const inCat = (c) => its.filter((i) => place(i) === c.id).map((i) => pickChip(i, b.id)).join('');
  const zone = (c, inner = '') => `<div class="zone zone-${c.id}" data-drop="${c.id}" data-blk="${b.id}" data-attr="${b.id}" role="button" tabindex="0" aria-label="${esc(c.label)}">
    <p class="zone-head"><strong>${esc(c.label)}</strong> <span class="small muted">${esc(c.hint)}</span></p><div class="zone-items">${inCat(c)}</div>${inner}</div>`;
  let body;
  if (b.rings) {
    // cats are listed innermost first, so each one wraps everything before it and the last is outermost
    body = `<div class="rings">${b.cats.reduce((inner, c) => zone(c, inner), '')}</div>`;
  } else {
    body = `<div class="zones cols-${b.cats.length}">${b.cats.map((c) => zone(c)).join('')}</div>`;
  }
  return `${pickHelp(b.id, 'Tap an item, then tap where it belongs.')}
    <div class="tray" data-drop="" data-blk="${b.id}" data-attr="${b.id}">${tray.length ? tray.map((i) => pickChip(i, b.id)).join('') : '<span class="muted small">All sorted ✓</span>'}</div>
    ${body}`;
}

// ------------------------------------------------------------------ interaction web
const VERBS = ['increases', 'reduces', 'depends on', 'masks', 'triggers'];
const POSITIVE = ['increases', 'enhances', 'triggers'];
const NEGATIVE = ['reduces', 'interferes with', 'masks'];

function webOptions(lists) {
  return `<option value="">Choose…</option>${lists.map((l) => {
    const its = items(l);
    if (!its.length) return '';
    return `<optgroup label="${esc(listLabel(l))}">${its.map((i) => `<option value="${esc(i.key)}">${esc(i.text)}</option>`).join('')}</optgroup>`;
  }).join('')}`;
}

function listLabel(l) {
  const b = findBlock(l);
  return b?.label || l;
}

function webBlock(b) {
  const verbs = b.verbs || VERBS;
  return `<section class="block card web" data-webform="${b.id}">
    <h3 class="label">${esc(b.label)}</h3>
    ${b.example ? `<p class="hint">${esc(b.example)}</p>` : ''}
    <div class="web-form">
      <select name="a" data-webopts="${b.lists.join(',')}" aria-label="First item">${webOptions(b.lists)}</select>
      <select name="rel" aria-label="Relationship">${verbs.map((v) => `<option>${v}</option>`).join('')}</select>
      <select name="b" data-webopts="${b.lists.join(',')}" aria-label="Second item">${webOptions(b.lists)}</select>
      <button type="button" class="btn primary" data-weblink="${b.id}">Link</button>
    </div>
    ${region(() => webHTML(b))}
  </section>`;
}

function webLinks(id) {
  return items(id).filter((l) => l.a && l.b && A.get(l.a) && A.get(l.b) && !parse(A.get(l.a))?.del && !parse(A.get(l.b))?.del);
}

function webHTML(b) {
  const links = webLinks(b.id);
  if (!links.length) return `<p class="empty">No links yet. Pick two items and how one affects the other.</p>`;
  const nodes = new Map();
  for (const l of links) for (const k of [l.a, l.b]) if (!nodes.has(k)) { const it = parse(A.get(k)); nodes.set(k, { key: k, text: it.text, d: it.d || 'none' }); }
  const order = ['phys', 'bio', 'psy', 'oth', 'none'];
  const cols = order.filter((d) => [...nodes.values()].some((n) => n.d === d));
  const W = 680, colW = W / cols.length, rowH = 46, nw = Math.min(colW - 28, 190), nh = 32;
  const pos = new Map();
  cols.forEach((d, ci) => [...nodes.values()].filter((n) => n.d === d).forEach((n, ri) => pos.set(n.key, { x: colW * ci + colW / 2, y: 34 + ri * rowH, n })));
  const H = Math.max(...[...pos.values()].map((p) => p.y)) + 34;
  const max = Math.floor(nw / 7.2);
  const cut = (t) => (t.length > max ? t.slice(0, max - 1) + '…' : t);
  const cross = links.filter((l) => nodes.get(l.a).d !== nodes.get(l.b).d).length;
  const edgeCls = (rel) => (POSITIVE.includes(rel) ? 'pos' : NEGATIVE.includes(rel) ? 'neg' : 'neu');
  const edges = links.map((l) => {
    const a = pos.get(l.a), z = pos.get(l.b);
    let d;
    if (a.x === z.x) {
      const x = a.x + nw / 2;
      d = `M${x},${a.y} C${x + 46},${a.y} ${x + 46},${z.y} ${x + 6},${z.y}`;
    } else {
      const dir = z.x > a.x ? 1 : -1;
      const x1 = a.x + (dir * nw) / 2, x2 = z.x - (dir * (nw / 2 + 6));
      const mx = (x1 + x2) / 2;
      d = `M${x1},${a.y} C${mx},${a.y} ${mx},${z.y} ${x2},${z.y}`;
    }
    return `<path class="web-edge ${edgeCls(l.rel)}" d="${d}" marker-end="url(#web-arrow-${edgeCls(l.rel)})"><title>${esc(l.text)}</title></path>`;
  }).join('');
  const nodeSvg = [...pos.values()].map(({ x, y, n }) => `<g class="web-node d-${n.d}"><rect x="${x - nw / 2}" y="${y - nh / 2}" width="${nw}" height="${nh}" rx="8"/><text x="${x}" y="${y + 4}" text-anchor="middle">${esc(cut(n.text))}<title>${esc(n.text)}</title></text></g>`).join('');
  const heads = cols.map((d, ci) => `<text class="web-col" x="${colW * ci + colW / 2}" y="12" text-anchor="middle">${d === 'none' ? 'Unassigned' : DISC[d].label}</text>`).join('');
  const marker = (c) => `<marker id="web-arrow-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="web-head ${c}"/></marker>`;
  return `<p class="web-stat"><strong>${links.length}</strong> link${links.length === 1 ? '' : 's'} · <strong>${cross}</strong> across disciplines${cross === 0 && links.length ? ' · <span class="warn">try linking across disciplines</span>' : ''}</p>
    <figure class="web-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Interaction web">
      <defs>${marker('pos')}${marker('neg')}${marker('neu')}</defs>${heads}${edges}${nodeSvg}</svg></figure>
    <ul class="web-list">${links.map((l) => `<li><span class="dot d-${nodes.get(l.a).d}"></span>${esc(nodes.get(l.a).text)} <em class="rel ${edgeCls(l.rel)}">${esc(l.rel)}</em> <span class="dot d-${nodes.get(l.b).d}"></span>${esc(nodes.get(l.b).text)}
      <button type="button" class="del" data-del="${esc(l.key)}" aria-label="Remove link">×</button></li>`).join('')}</ul>`;
}

function addLink(id) {
  const form = document.querySelector(`[data-webform="${id}"]`);
  const a = form.querySelector('[name=a]').value, b = form.querySelector('[name=b]').value, rel = form.querySelector('[name=rel]').value;
  if (!a || !b || a === b) { form.querySelector(a ? '[name=b]' : '[name=a]').focus(); return; }
  setAnswer(`list:${id}:${uid()}`, JSON.stringify({ a, b, rel, text: `${itemText(a)} ${rel} ${itemText(b)}`, t: Date.now() }));
  form.querySelector('[name=a]').value = ''; form.querySelector('[name=b]').value = '';
  refreshDynamic(form.querySelector('[data-dyn]'));
}

// ------------------------------------------------------------------ per-item choices (predict, keep/change/drop, actual effect)
function itemChoiceHTML(b) {
  let its = itemsOf(b.lists);
  if (b.dedupe) its = uniqueByText(its);
  if (!its.length) return `<p class="empty">Add strategies first.</p>`;
  return `<ul class="ic">${its.map((i) => {
    const f = attrKey(i.key, b.attr), v = A.get(f) || '';
    return `<li>${chipHTML(i, false)}<div class="seg wrap">${b.options.map((o) => `<button type="button" data-rate="${esc(f)}" data-v="${o.id}" class="${v === o.id ? 'on' : ''} eff eff-${o.id.replace('-', 'm')}" aria-pressed="${v === o.id}">${esc(o.label)}</button>`).join('')}</div></li>`;
  }).join('')}</ul>`;
}

function strategyTexts() {
  return uniqueByText([...items('final_plan'), ...items('strategies')]);
}

function attrByText(text, attr, lists = ['final_plan', 'strategies']) {
  const k = text.trim().toLowerCase();
  for (const l of lists) for (const i of items(l)) if (i.text.trim().toLowerCase() === k && getAttr(i.key, attr)) return getAttr(i.key, attr);
  return '';
}

function predictCompareHTML() {
  const its = strategyTexts();
  const rows = its.map((i) => ({ i, pred: attrByText(i.text, 'pred'), act: attrByText(i.text, 'act'), att: [...T.values()].filter((r) => !r.phase.endsWith(':removed') && r.strategy === i.text) }))
    .filter((r) => r.pred || r.act);
  if (!rows.length) return `<p class="empty">Predict effects in Task 5 or Station 5, then rate what actually happened above.</p>`;
  const lab = (v) => EFFECT.find((e) => e.id === v)?.label || '—';
  let mism = 0;
  const body = rows.map(({ i, pred, act, att }) => {
    let verdict = '<span class="muted">Not rated yet</span>';
    if (pred && act) {
      const d = Number(act) - Number(pred);
      if (d === 0) verdict = '<span class="ok">As predicted</span>';
      else { mism++; verdict = d > 0 ? '<span class="ok">Better than predicted</span>' : '<span class="no">Worse than predicted</span>'; }
    }
    const box = att.filter((r) => r.phase === 'box');
    return `<tr><td>${chipHTML(i, false)}</td><td>${lab(pred)}</td><td>${lab(act)}</td><td>${box.length ? `${box.filter((r) => r.success).length}/${box.length} made` : '—'}</td><td>${verdict}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="pc"><thead><tr><th>Strategy</th><th>Predicted</th><th>Actual</th><th>Box attempts</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
    ${mism ? `<p class="callout small"><strong>${mism}</strong> strateg${mism === 1 ? 'y' : 'ies'} didn’t do what you predicted. Through a complexity lens, ask why: interactions with other strategies, dose or timing, or the athlete’s belief?</p>` : ''}`;
}

// ------------------------------------------------------------------ claims and decision rules
function stratSelectOptions(current) {
  const texts = strategyTexts().map((i) => i.text);
  if (current && !texts.includes(current)) texts.push(current);
  return `<option value="">a strategy…</option>${texts.map((t) => `<option ${t === current ? 'selected' : ''}>${esc(t)}</option>`).join('')}`;
}

function claimHTML(b) {
  const f = (s) => `${b.id}.${s}`;
  const inp = (s, ph, wide) => `<input class="inline${wide ? ' wide-inline' : ''}" data-field="${f(s)}" value="${esc(A.get(f(s)))}" placeholder="${ph}" autocomplete="off">`;
  return `<section class="block card claim">${b.label ? `<h3 class="label">${esc(b.label)}</h3>` : ''}
    <p class="claim-s">We think <select class="inline" data-field="${f('s')}" data-stratopts>${stratSelectOptions(A.get(f('s')))}</select>
      will change ${inp('v', 'which variable')}
      because ${inp('m', 'the mechanism', true)}.
      We’ll know it worked if ${inp('e', 'what the data shows', true)}.</p>
  </section>`;
}

function ruleHTML(b) {
  const f = (s) => `${b.id}.${s}`;
  const v = A.get(f('v')) || '', d = A.get(f('d')) || '';
  const dirs = ['goes up', 'goes down', 'doesn’t change', 'differs between athletes'];
  return `<section class="block card claim rule">${b.label ? `<h3 class="label">${esc(b.label)}</h3>` : ''}
    <p class="claim-s">If <select class="inline" data-field="${f('v')}"><option value="">a variable…</option>${VARS.map((x) => `<option ${x.label === v ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
      <select class="inline" data-field="${f('d')}"><option value="">…</option>${dirs.map((x) => `<option ${x === d ? 'selected' : ''}>${x}</option>`).join('')}</select>,
      then we will <input class="inline wide-inline" data-field="${f('a')}" value="${esc(A.get(f('a')))}" placeholder="what you’ll do next" autocomplete="off">.</p>
  </section>`;
}

// ------------------------------------------------------------------ variables -> methods
function chosenVars() { return VARS.filter((v) => A.get(`var:${v.id}`) === '1'); }

function varMethodsHTML() {
  const vs = chosenVars();
  if (!vs.length) return `<p class="empty">Choose variables above first.</p>`;
  const covered = new Set(vs.map((v) => v.d));
  const missing = ['phys', 'bio', 'psy'].filter((d) => !covered.has(d)).map((d) => DISC[d].label.toLowerCase());
  return `${missing.length ? `<p class="spread">No ${missing.join(' or ')} variables yet. Is that a deliberate choice?</p>` : '<p class="small ok">✓ Every core discipline is represented.</p>'}
    <ul class="vm">${vs.map((v) => {
      const f = `varm:${v.id}`, cur = A.get(f) || '';
      return `<li><span class="pill d-${v.d}"><span class="dot d-${v.d}"></span>${esc(v.label)}</span>
        <select data-field="${f}" aria-label="Method for ${esc(v.label)}"><option value="">How will you measure it?</option>${METHODS.map((m) => `<option ${m === cur ? 'selected' : ''}>${m}</option>`).join('')}</select></li>`;
    }).join('')}</ul>`;
}

// ------------------------------------------------------------------ roles
function rolesHTML() {
  const members = items('members');
  if (!members.length) return `<p class="empty">Add your team in <a href="#/s1-1">Task 1</a> first.</p>`;
  return `<ul class="roles">${ROLES.map((r) => {
    const f = `role:${r.id}`, cur = A.get(f) || '';
    return `<li><span>${esc(r.label)}</span><select data-field="${f}"><option value="">Who?</option>${members.map((m) => `<option ${m.text === cur ? 'selected' : ''}>${esc(m.text)}</option>`).join('')}</select></li>`;
  }).join('')}</ul>`;
}

// ------------------------------------------------------------------ athlete's own priorities
function athletePickHTML(b) {
  const its = itemsOf(b.lists);
  if (!its.length) return `<p class="empty">List limiters in <a href="#/s1-3">Task 3</a> first.</p>`;
  const picked = its.filter((i) => getAttr(i.key, 'athpick') === '1');
  const team = its.filter(isPriority);
  const both = picked.filter(isPriority);
  const chips = its.map((i) => {
    const f = attrKey(i.key, 'athpick'), on = getAttr(i.key, 'athpick') === '1';
    return `<button type="button" class="tchip ${on ? 'on' : ''} d-${i.d || 'none'}" data-toggle="${esc(f)}" aria-pressed="${on}"><span class="dot d-${i.d || 'none'}"></span>${esc(i.text)}${isPriority(i) ? ' ★' : ''}</button>`;
  }).join('');
  let verdict = '';
  if (picked.length) {
    verdict = `<p class="${both.length ? 'small' : 'spread'}">Your athlete picked <strong>${picked.length}</strong>; <strong>${both.length}</strong> match${both.length === 1 ? 'es' : ''} your team’s ★ priorities.${picked.length - both.length ? ` They see <strong>${picked.length - both.length}</strong> factor${picked.length - both.length === 1 ? '' : 's'} you didn’t prioritise.` : ''}${team.length - both.length ? ` You prioritised <strong>${team.length - both.length}</strong> they didn’t pick.` : ''}</p>`;
  }
  return `<div class="chips">${chips}</div>${verdict}`;
}

// ------------------------------------------------------------------ CMJ before / after
function prepostBlock(b) {
  const row = (id) => `<div class="pp-row"><span class="pp-name">${esc(athleteName(id))}</span>
    <label>Before <input type="number" inputmode="decimal" step="0.1" data-field="${b.id}_pre:${id}" value="${esc(A.get(`${b.id}_pre:${id}`))}"></label>
    <label>After <input type="number" inputmode="decimal" step="0.1" data-field="${b.id}_post:${id}" value="${esc(A.get(`${b.id}_post:${id}`))}"></label></div>`;
  return `<section class="block card prepost"><h3 class="label">${esc(b.label)}</h3>${row('1')}${A.get('athlete2') ? row('2') : ''}${region(() => prepostResult(b))}</section>`;
}

function prepostResult(b) {
  const out = ['1', '2'].map((id) => {
    const pre = parseFloat(A.get(`${b.id}_pre:${id}`)), post = parseFloat(A.get(`${b.id}_post:${id}`));
    if (!(pre > 0 && post > 0)) return '';
    const d = post - pre;
    return `<p class="pp-out"><strong>${esc(athleteName(id))}:</strong> <span class="${d > 0 ? 'ok' : d < 0 ? 'no' : ''}">${d >= 0 ? '+' : ''}${fmtCm(d)} cm (${d >= 0 ? '+' : ''}${fmtCm((d / pre) * 100)}%)</span></p>`;
  }).join('');
  return out ? `${out}<p class="small muted">Day-to-day variation in CMJ height is often around 1–2 cm. Is your change bigger than the noise?</p>` : '';
}

// ------------------------------------------------------------------ perceived vs estimated box
function compareBlock() {
  const row = (id) => {
    const f = `perceived:${id}`, cur = A.get(f) || '';
    return `<label class="fieldset"><span class="label">${esc(athleteName(id))} thinks they could clear…</span>
      <select data-field="${f}"><option value="">Ask them…</option>${BOXES.map((x) => `<option value="${x.cm}" ${String(x.cm) === cur ? 'selected' : ''}>${x.label}</option>`).join('')}<option value="0" ${cur === '0' ? 'selected' : ''}>None of them</option></select></label>`;
  };
  return `<section class="block card">${row('1')}${A.get('athlete2') ? row('2') : ''}${region(() => compareResult())}</section>`;
}

function compareResult() {
  return ['1', '2'].map((id) => {
    const p = A.get(`perceived:${id}`), e = parse(A.get(`est:${id}`));
    if (!p) return '';
    const per = Number(p);
    if (!e) return `<p class="small muted">Save an estimate for ${esc(athleteName(id))} above to compare.</p>`;
    const highestOk = Math.max(0, ...BOXES.filter((b) => e.est >= b.cm).map((b) => b.cm));
    let msg;
    if (per < highestOk) msg = 'The equation says they can, but they don’t perceive it. That gap is a psychological or perceptual limiter, not a physical one.';
    else if (per > highestOk) msg = 'They believe they can go higher than the estimate. Either the equation underestimates them (trajectory, hip displacement) or confidence is running ahead of capability.';
    else msg = 'Perception and estimate agree. The box “affords” what the numbers predict.';
    return `<p class="pp-out"><strong>${esc(athleteName(id))}:</strong> estimate ${fmtCm(e.est)} cm · perceived ${per ? fmtCm(per) + ' cm box' : 'none of the boxes'}</p><p class="small">${msg}</p>`;
  }).join('');
}

// ------------------------------------------------------------------ summary
function summaryBlocks() {
  return [
    { type: 'feedback' },
    { type: 'note', html: `<p>Everything your team has done, organised into the five phases of the support model. Use it as the outline for your <strong>5-minute screencast</strong>.</p><p><button type="button" class="btn" onclick="window.print()">Print or save as PDF</button></p>` },
    { type: 'teamlink' },
    { type: 'summary' },
    { type: 'note', html: `<h2>Where did your team actually sit?</h2><p>Vote again on your own device, then compare with what you expected at the start.</p>` },
    { type: 'vote', id: 'spectrum_end', label: 'Mono, multi, inter or trans: where did your team really work today?', options: SPECTRUM_OPTS, scale: true },
    { type: 'spectrumShift' },
    { type: 'vote', id: 'best_fw', label: 'Which framework best explains what happened in your team today?', options: FRAMEWORKS.map((f) => ({ id: f.id, label: f.name })) },
    { type: 'short', id: 'best_fw_why', label: 'Why that framework? Give one piece of evidence from today.', placeholder: 'It explains… because…' },
    { type: 'note', html: `<h2>How well did you work together?</h2><p>Everyone rates each skill from 1 (poor) to 5 (excellent) on their own device. Discuss any big differences: that discussion is the second half of your screencast.</p>` },
    ...TEAMWORK.flatMap((t) => [
      { type: 'vote', id: t.id, label: t.label, hint: t.hint, scale: true, options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) })) },
      { type: 'short', id: `${t.id}_ex`, label: `One example of ${t.label.toLowerCase()} from today`, placeholder: 'When we…' },
    ]),
    { type: 'note', html: `<div class="callout"><h3>Taking this into your assessments</h3><ul>
      <li><strong>Assessment 1:</strong> your flow chart above shows how your team turned data into decisions. The assessment asks for one like it, for a scenario of your choice. Your spectrum votes and framework choice are starting points for critiquing definitions and frameworks.</li>
      <li><strong>Assessment 2:</strong> pick the station closest to your discipline. How would you propose that strategy as an intervention from a mono-disciplinary perspective, and then show how the other disciplines contribute to it?</li></ul></div>` },
    { type: 'note', html: `<div class="callout"><h3>Post-session task</h3><p>As a sport science team, record a short <strong>5-minute screencast</strong> covering:</p><ol><li>your scientific support process (the five phases above), and</li><li>an evaluation of your interdisciplinary working skills: critical thinking, communication, discussion and co-operation.</li></ol><p>Send it to <a href="mailto:${EMAIL}">${EMAIL}</a>. It will help you prepare for your individual presentation at the end of the module.</p></div>` },
  ];
}

function spectrumShiftHTML() {
  const dist = (id) => SPECTRUM_OPTS.map((o) => [...A].filter(([k, v]) => k.startsWith(`vote:${id}:`) && v === o.id).length);
  const s = dist('spectrum_start'), e = dist('spectrum_end');
  if (!s.some(Boolean) && !e.some(Boolean)) return '';
  const max = Math.max(1, ...s, ...e);
  const bar = (n) => `<span class="sbar" style="--w:${(n / max) * 100}%"></span><span class="small">${n}</span>`;
  return `<table class="shift"><thead><tr><th></th><th>Expected (start)</th><th>Actual (end)</th></tr></thead><tbody>
    ${SPECTRUM_OPTS.map((o, i) => `<tr><th>${o.label}</th><td>${bar(s[i])}</td><td>${bar(e[i])}</td></tr>`).join('')}</tbody></table>`;
}

function val(f) {
  const v = A.get(f)?.trim();
  return v ? `<p class="sv">${esc(v).replace(/\n/g, '<br>')}</p>` : '';
}

function claimText(id) {
  const g = (s) => A.get(`${id}.${s}`)?.trim();
  if (!g('s') && !g('m')) return '';
  return `We think <strong>${esc(g('s') || '…')}</strong> will change <strong>${esc(g('v') || '…')}</strong> because ${esc(g('m') || '…')}.${g('e') ? ` We’ll know it worked if ${esc(g('e'))}.` : ''}`;
}

function ruleText(id) {
  const g = (s) => A.get(`${id}.${s}`)?.trim();
  if (!g('v') || !g('a')) return '';
  return `If <strong>${esc(g('v'))}</strong> ${esc(g('d') || 'changes')}, then we will ${esc(g('a'))}.`;
}

function chipsOn(id, options) {
  return options.filter((o) => A.get(`${id}:${o.id}`) === '1');
}

function athleteBests() {
  const boxRows = phaseAttempts('box'), optRows = phaseAttempts('optojump');
  const ids = [...new Set([...boxRows, ...optRows].map((r) => r.athlete))];
  return ids.map((id) => {
    const best = Math.max(0, ...boxRows.filter((r) => r.athlete === id && r.success).map((r) => Number(r.box_cm)));
    const o = optRows.filter((r) => r.athlete === id).map((r) => Number(r.height_cm));
    return { id, best, nBox: boxRows.filter((r) => r.athlete === id).length, opt: o };
  });
}

function flowHTML() {
  const pri = itemsOf([...LIM, 'lim_athlete']).filter(isPriority);
  const vars = chosenVars();
  const links = [...webLinks('limweb'), ...webLinks('stratweb')];
  const cross = links.filter((l) => parse(A.get(l.a))?.d !== parse(A.get(l.b))?.d);
  const claims = ['claim1', 'claim2', 'psy_claim', 'fv_claim'].map((id) => A.get(`${id}.m`)?.trim() ? { s: A.get(`${id}.s`), m: A.get(`${id}.m`) } : null).filter(Boolean);
  const plan = items('final_plan').length ? items('final_plan') : items('strategies');
  const bests = athleteBests();
  const measured = [];
  ['1', '2'].forEach((id) => {
    const e = parse(A.get(`est:${id}`));
    if (e) measured.push(`${esc(athleteName(id))}: CMJ ${fmtCm(e.cmj)} cm → est. ${fmtCm(e.est)} cm`);
    const pre = A.get(`phys_pre:${id}`), post = A.get(`phys_post:${id}`);
    if (pre && post) measured.push(`${esc(athleteName(id))}: PAPE CMJ ${fmtCm(pre)} → ${fmtCm(post)} cm`);
  });
  if (A.get('psy_conf_before') && A.get('psy_conf_after')) measured.push(`Confidence ${A.get('psy_conf_before')} → ${A.get('psy_conf_after')}/10`);
  const col = (n, title, body) => `<div class="fc-col"><p class="fc-head"><span>${n}</span>${title}</p>${body || '<p class="empty small">Nothing yet</p>'}</div>`;
  return `<section class="sum-sec"><h2>From data to decisions</h2>
    <p class="small muted">How your team turned data from each discipline into information you could act on. Assessment 1 asks for a flow chart like this for a scenario of your choice.</p>
    <div class="flowchart">
      ${col(1, 'Limiters', pri.map((i) => chipHTML(i, false)).join(''))}
      ${col(2, 'Data collected', (vars.length ? vars.map((v) => `<span class="pill d-${v.d}"><span class="dot d-${v.d}"></span>${esc(v.label)}${A.get(`varm:${v.id}`) ? ` <em class="small">· ${esc(A.get(`varm:${v.id}`))}</em>` : ''}</span>`).join('') : '') + measured.map((m) => `<p class="small fc-m">${m}</p>`).join(''))}
      ${col(3, 'Information', cross.map((l) => `<p class="small fc-m">${esc(l.text)}</p>`).join('') + claims.map((c) => `<p class="small fc-m">${esc(c.s || 'Strategy')}: because ${esc(c.m)}</p>`).join(''))}
      ${col(4, 'Action', plan.map((i) => chipHTML(i)).join(''))}
      ${col(5, 'Outcome', bests.map((b) => `<p class="small fc-m"><strong>${esc(athleteName(b.id))}</strong>: ${b.best ? `cleared ${fmtCm(b.best)} cm` : 'no box cleared yet'}${b.opt.length ? `; Optojump ${fmtCm(b.opt[0])} → ${fmtCm(Math.max(...b.opt))} cm` : ''}</p>`).join(''))}
    </div></section>`;
}

function summaryHTML() {
  const members = items('members');
  const counts = Object.keys(DISC).map((d) => [d, members.filter((m) => m.d === d).length]).filter(([, n]) => n);
  const lims = itemsOf(LIM);
  const pri = itemsOf([...LIM, 'lim_athlete']).filter(isPriority);
  const athPicked = itemsOf([...LIM, 'lim_athlete']).filter((i) => getAttr(i.key, 'athpick') === '1');
  const cons = ['individual', 'task', 'environment'].map((c) => [c, lims.filter((i) => getAttr(i.key, 'cons') === c).length]);
  const strategies = items('final_plan').length ? items('final_plan') : items('strategies');
  const crossStrat = strategies.filter((s) => s.also?.length).length;
  const links = [...webLinks('limweb'), ...webLinks('stratweb')];
  const empty = '<p class="empty">Not filled in yet.</p>';
  const sec = (n, title, body) => `<section class="sum-sec"><h2><span class="phase-n">${n}</span>${title}</h2>${body.trim() || empty}</section>`;
  const bests = athleteBests();
  const varsOn = chosenVars();
  const evalOn = chipsOn('eval', PAGES.find((p) => p.id === 's1-6').blocks.find((b) => b.id === 'eval').options);

  const teamSec = `<section class="sum-sec"><h2>The team</h2>
    ${members.length ? `<div class="pills">${members.map((m) => chipHTML(m, false)).join('')}</div>
      <p class="muted small">${counts.map(([d, n]) => `${n} ${DISC[d].label.toLowerCase()}`).join(' · ')}</p>` : empty}
    <p>Athletes: <strong>${athletes().map((a) => esc(a.name)).join(', ')}</strong></p>
    ${ROLES.filter((r) => A.get(`role:${r.id}`)).map((r) => `<span class="pill">${esc(r.label.split(' (')[0])}: <strong>${esc(A.get(`role:${r.id}`))}</strong></span>`).join(' ')}</section>`;

  const describe = sec(1, 'Describe', `
    ${pri.length ? `<h4>Priorities</h4><div class="pills">${pri.map((i) => chipHTML(i, false)).join('')}</div>` : ''}
    ${lims.length ? `<p class="small muted">${lims.length} limiters listed across ${new Set(lims.map((i) => i.d)).size} disciplines${cons.some(([, n]) => n) ? ` · constraints: ${cons.map(([c, n]) => `${n} ${c}`).join(', ')}` : ''}</p>` : ''}
    ${athPicked.length ? `<h4>Athlete’s view</h4><p>Your athlete chose ${athPicked.length} limiters; ${athPicked.filter(isPriority).length} matched your priorities.</p>` : ''}
    ${A.get('determinant') ? `<h4>What will determine performance</h4>${val('determinant')}` : ''}
    ${varsOn.length ? `<h4>Variables to assess</h4><div class="pills">${varsOn.map((v) => `<span class="pill d-${v.d}"><span class="dot d-${v.d}"></span>${esc(v.label)}</span>`).join('')}</div>` : ''}`);

  const analyse = sec(2, 'Analyse', `
    ${varsOn.filter((v) => A.get(`varm:${v.id}`)).length ? `<ul>${varsOn.filter((v) => A.get(`varm:${v.id}`)).map((v) => `<li>${esc(v.label)}: ${esc(A.get(`varm:${v.id}`))}</li>`).join('')}</ul>` : ''}
    ${compareResult()}
    ${prepostResult({ id: 'phys' })}
    ${A.get('fv_stability') ? `<p>Technique across jumps: <strong>${esc({ stable: 'very consistent', some: 'slightly variable', variable: 'very variable' }[A.get('fv_stability')])}</strong></p>` : ''}`);

  const prescribe = sec(3, 'Prescribe', `
    ${strategies.length ? `<p>${strategies.length} strateg${strategies.length > 1 ? 'ies' : 'y'}; <strong>${crossStrat}</strong> affect more than one discipline. ${links.length ? `<strong>${links.length}</strong> interactions mapped.` : ''}</p>${pullHTML(items('final_plan').length ? 'final_plan' : 'strategies')}` : ''}
    ${['claim1', 'claim2', 'psy_claim', 'fv_claim'].map(claimText).filter(Boolean).map((t) => `<p class="claim-out">${t}</p>`).join('')}`);

  const optimise = sec(4, 'Optimise', `
    ${['rule1', 'rule2'].map(ruleText).filter(Boolean).map((t) => `<p class="claim-out">${t}</p>`).join('')}
    ${bests.length ? `<h4>Results</h4><ul>${bests.map((b) => `<li><strong>${esc(athleteName(b.id))}</strong>: ${b.nBox} box attempts, highest cleared ${b.best ? fmtCm(b.best) + ' cm' : '—'}${b.opt.length ? `; Optojump ${fmtCm(b.opt[0])} → best ${fmtCm(Math.max(...b.opt))} cm` : ''}</li>`).join('')}</ul>` : ''}
    ${strategyTexts().some((i) => attrByText(i.text, 'pred') || attrByText(i.text, 'act')) ? `<h4>Predicted vs actual</h4>${predictCompareHTML()}` : ''}`);

  const revise = sec(5, 'Revise', `
    ${evalOn.length ? `<p>You planned to evaluate: ${evalOn.map((o) => esc(o.label.toLowerCase())).join(', ')}.</p>` : ''}
    ${A.get('best_fw_why') ? `<h4>Framework that best explains your work</h4>${val('best_fw_why')}` : ''}`);

  return teamSec + flowHTML() + describe + analyse + prescribe + optimise + revise;
}

// ------------------------------------------------------------------ events
function bindMain(main) {
  main.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.field) setAnswer(el.dataset.field, el.value);
    else if (el.dataset.item) setItem(el.dataset.item, { text: el.value });
    else if (el.closest('.calc')) calcCompute();
    if (el.dataset.field || el.dataset.item) refreshDynamic();
  });

  main.addEventListener('change', (e) => {
    const el = e.target;
    const dyn = el.closest('[data-dyn]');
    if (el.dataset.idisc) { const cur = parse(A.get(el.dataset.idisc)) || {}; setItem(el.dataset.idisc, { d: el.value, also: (cur.also || []).filter((d) => d !== el.value) }); refreshDynamic(dyn); }
    else if (el.dataset.iwhen) { setItem(el.dataset.iwhen, { when: el.value }); refreshDynamic(dyn); }
    else if (el.closest('.calc')) calcCompute();
  });

  main.addEventListener('click', (e) => {
    const el = e.target.closest('button, [data-drop], [data-fw]');
    if (!el) return;
    const dyn = el.closest('[data-dyn]');
    if (el.dataset.pick) {
      const same = sel?.key === el.dataset.pick && sel.blk === el.dataset.blk;
      sel = same ? null : { blk: el.dataset.blk, key: el.dataset.pick };
      refreshDynamic(dyn);
    } else if ('drop' in el.dataset) {
      if (sel && sel.blk === el.dataset.blk) { setAnswer(attrKey(sel.key, el.dataset.attr), el.dataset.drop); sel = null; refreshDynamic(dyn); }
    } else if (el.dataset.toggle) {
      const f = el.dataset.toggle;
      setAnswer(f, A.get(f) === '1' ? '' : '1'); refreshDynamic(dyn);
    } else if (el.dataset.fw) {
      showFramework(el.dataset.fw);
    } else if (el.dataset.fwinfo) {
      const box = el.closest('.lens').querySelector('.fw-detail');
      const open = !box.hidden && box.dataset.fw === el.dataset.fwinfo;
      box.hidden = open; box.dataset.fw = el.dataset.fwinfo;
      if (!open) box.innerHTML = fwDetailHTML(el.dataset.fwinfo);
      el.closest('.lens').querySelectorAll('[data-fwinfo]').forEach((b) => b.setAttribute('aria-expanded', String(!open && b === el)));
    } else if (el.dataset.weblink) {
      addLink(el.dataset.weblink);
    } else if (el.dataset.rate) {
      const f = el.dataset.rate;
      setAnswer(f, A.get(f) === el.dataset.v ? '' : el.dataset.v);
      updateField(f);
      refreshDynamic(dyn);
    } else if (el.dataset.star) {
      setItem(el.dataset.star, { star: !parse(A.get(el.dataset.star))?.star }); refreshDynamic(dyn);
    } else if (el.dataset.del) {
      setItem(el.dataset.del, { del: true }); refreshDynamic(dyn);
    } else if (el.dataset.ialso) {
      const cur = parse(A.get(el.dataset.ialso))?.also || [];
      const d = el.dataset.d;
      setItem(el.dataset.ialso, { also: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] }); refreshDynamic(dyn);
    } else if ('switchteam' in el.dataset) {
      switchTeam();
    } else if ('copylink' in el.dataset) {
      copyTeamLink(el);
    } else if (el.dataset.addbtn) {
      addItem(el.dataset.addbtn);
    } else if (el.id === 'c-save') {
      const r = calcCompute();
      const ath = document.getElementById('c-ath').value;
      if (r) { setAnswer(`est:${ath}`, JSON.stringify({ cmj: r.cmj, est: Math.round(r.est * 10) / 10 })); refreshDynamic(); el.textContent = '✓ Saved'; }
    } else if (el.dataset.void) {
      const row = T.get(el.dataset.void);
      if (row && confirm('Remove this attempt from the log?')) { setAttempt({ ...row, phase: `${row.phase}:removed` }); refreshDynamic(); }
    }
  });

  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.add) { e.preventDefault(); addItem(e.target.dataset.add); }
    else if ((e.key === 'Enter' || e.key === ' ') && (e.target.dataset.fw || 'drop' in e.target.dataset) && e.target.tagName !== 'BUTTON') { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });

  main.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-attempt-form]');
    if (!form) return;
    e.preventDefault();
    const phase = form.dataset.attemptForm;
    const fd = new FormData(form);
    const key = fd.get('strategy');
    const it = key && key !== '__other' ? parse(A.get(key)) : null;
    setAttempt({
      id: uid(),
      team_id: team.id,
      athlete: fd.get('athlete'),
      phase,
      box_cm: phase === 'box' ? Number(fd.get('box')) : null,
      height_cm: phase === 'optojump' ? Number(fd.get('height')) : null,
      success: phase === 'box' ? fd.get('success') === '1' : null,
      strategy: it ? it.text : key === '__other' ? 'Other' : null,
      discipline: it?.d || null,
      confidence: fd.get('confidence') ? Number(fd.get('confidence')) : null,
      notes: fd.get('notes')?.trim() || null,
      created_at: new Date().toISOString(),
    });
    form.querySelector('[name=notes]').value = '';
    if (form.querySelector('[name=height]')) form.querySelector('[name=height]').value = '';
    refreshDynamic();
  });

  // Strategy and athlete dropdowns are built at render time; refresh them when opened.
  main.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.matches?.('[data-stratopts]')) { const v = el.value; el.innerHTML = stratSelectOptions(v); el.value = v; }
    if (el.matches?.('[data-webopts]')) { const v = el.value; el.innerHTML = webOptions(el.dataset.webopts.split(',')); el.value = v; }
    if (el.matches?.('[data-strats]')) { const v = el.value; el.innerHTML = strategyOptions(); el.value = v; }
    if (el.matches?.('[data-athletes]')) { const v = el.value; el.innerHTML = athletes().map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join(''); el.value = v || '1'; }
  });

  // Catch up on remote changes held back while someone was typing.
  main.addEventListener('focusout', () => setTimeout(() => {
    document.querySelectorAll('[data-dyn][data-dirty]').forEach((el) => { if (!el.contains(document.activeElement)) rerender(el); });
  }, 0));
}

function addItem(listId) {
  const input = document.querySelector(`[data-add="${listId}"]`);
  const text = input.value.trim();
  if (!text) return;
  const block = findBlock(listId);
  const fixed = block?.disc && block.disc !== 'choose' ? block.disc : '';
  setAnswer(`list:${listId}:${uid()}`, JSON.stringify({ text, d: fixed, star: false, also: [], when: '', t: Date.now() }));
  input.value = '';
  refreshDynamic(input.closest('.list-block')?.querySelector('[data-dyn]'));
  input.focus();
}

function findBlock(listId) {
  for (const p of PAGES) {
    const stack = [...p.blocks];
    while (stack.length) {
      const b = stack.shift();
      if (b.type === 'columns') stack.push(...b.blocks);
      else if (b.type === 'list' && b.id === listId) return b;
    }
  }
  return null;
}

// Start last, so every module-level binding above is initialised first.
boot();
