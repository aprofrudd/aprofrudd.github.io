// Tutor view: rotation clock for the projector + live progress of every team.
import { PAGES, SLOT_MIN, stationFor, pageHasContent } from './content.js';
import * as store from './store.js';
import { esc, LS, localDate, mmss, fmtCm, parse } from './util.js';

const params = new URLSearchParams(location.search);
let classCode = params.get('class') || LS.get('ia:tutor-class') || localDate();
let teams = [];
const answers = new Map();   // team id -> Map(field -> value)
const attempts = new Map();  // team id -> Map(id -> row)
let rotation = null;
let projector = false;
let renderTimer;

const S1 = PAGES.filter((p) => p.id.startsWith('s1-'));
const ST = PAGES.filter((p) => p.station);
const stationTitle = (n) => ST.find((p) => p.station === n)?.short || `Station ${n}`;

const app = document.getElementById('app');
app.innerHTML = `
  <header class="top">
    <a class="brand" href="./"><strong>Tutor view</strong><span>Optimising jump performance</span></a>
    <label class="cls">Class <input id="cls" value="${esc(classCode)}" autocomplete="off"></label>
    <button class="btn" id="proj">Projector mode</button>
  </header>
  <main class="tutor">
    <section class="card clock" id="clock"></section>
    <section id="where"></section>
    <section id="grid" class="team-cards"></section>
  </main>`;

document.getElementById('cls').onchange = (e) => { classCode = e.target.value.trim(); LS.set('ia:tutor-class', classCode); loadAll(); };
document.getElementById('proj').onclick = () => {
  projector = !projector;
  document.body.classList.toggle('projector', projector);
  document.getElementById('proj').textContent = projector ? 'Exit projector mode' : 'Projector mode';
  render();
};

async function loadAll() {
  try {
    teams = (await store.listTeams(classCode)).filter((t) => t.name !== store.CONTROL);
    const ids = teams.map((t) => t.id);
    const [ans, att] = await Promise.all([store.loadAnswers(ids), store.loadAttempts(ids)]);
    answers.clear(); attempts.clear();
    ans.forEach(addAnswer);
    att.forEach(addAttempt);
    rotation = await store.getRotation(classCode);
  } catch (e) {
    console.warn(e);
  }
  render();
}

function addAnswer(r) {
  if (!answers.has(r.team_id)) answers.set(r.team_id, new Map());
  answers.get(r.team_id).set(r.field, r.value);
}
function addAttempt(r) {
  if (!attempts.has(r.team_id)) attempts.set(r.team_id, new Map());
  attempts.get(r.team_id).set(r.id, r);
}

store.subscribe(null, {
  onAnswer: (r) => { if (teams.some((t) => t.id === r.team_id)) { addAnswer(r); renderSoon(); } },
  onAttempt: (r) => { if (teams.some((t) => t.id === r.team_id)) { addAttempt(r); renderSoon(); } },
  onTeam: (t) => { if (t.class_code === classCode) loadAll(); },
});
setInterval(loadAll, 30000);
setInterval(tickClock, 1000);
loadAll();

function renderSoon() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 400); }

// ------------------------------------------------------------------ rotation
function info() {
  if (!rotation?.start) return { state: 'waiting' };
  const elapsed = Date.now() - rotation.start;
  const slot = Math.floor(elapsed / (SLOT_MIN * 60000));
  if (slot >= 6) return { state: 'part2', elapsed };
  return { state: 'running', slot, left: SLOT_MIN * 60000 * (slot + 1) - elapsed };
}

async function setRot(start) {
  rotation = { start };
  render();
  try { await store.setRotation(classCode, rotation); }
  catch (e) { alert('Couldn’t save the rotation clock. Check the connection and try again.'); }
}

let clockKey = '';
function tickClock() {
  const r = info();
  const key = `${r.state}-${r.slot}`;
  if (key !== clockKey) { clockKey = key; render(); return; }
  const el = document.getElementById('left');
  if (el && r.left != null) el.textContent = mmss(r.left);
}

function clockHTML() {
  const r = info();
  const slotMs = SLOT_MIN * 60000;
  let main;
  if (r.state === 'waiting') main = `<p class="clock-state">Rotation not started</p><p class="muted">Each group starts at the station matching its group number.</p>`;
  else if (r.state === 'part2') main = `<p class="clock-state">Stations complete</p><p class="clock-big">Part 2: box challenge</p>`;
  else main = `<p class="clock-state">Slot ${r.slot + 1} of 6 · ${r.slot * SLOT_MIN}–${(r.slot + 1) * SLOT_MIN} min</p><p class="clock-big" id="left">${mmss(r.left)}</p><p class="muted">until groups move one station on</p>`;
  const now = Date.now();
  return `<div class="clock-main">${main}</div>
    <div class="clock-ctrl">
      ${r.state === 'waiting' ? `<button class="btn primary" data-act="start">Start rotation</button>` : `
        <button class="btn" data-act="back" ${r.state === 'running' && r.slot === 0 ? 'disabled' : ''}>← Previous slot</button>
        <button class="btn primary" data-act="next">${r.state === 'running' && r.slot === 5 ? 'Finish stations' : 'Next slot →'}</button>
        <button class="btn" data-act="reset">Reset</button>`}
    </div>`;
}

app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const r = info();
  const slotMs = SLOT_MIN * 60000;
  const now = Date.now();
  if (b.dataset.act === 'start') setRot(now);
  if (b.dataset.act === 'reset' && confirm('Stop and reset the rotation clock for every group?')) setRot(null);
  if (b.dataset.act === 'next') setRot(now - ((r.state === 'part2' ? 6 : r.slot + 1) * slotMs));
  if (b.dataset.act === 'back') setRot(now - ((r.state === 'part2' ? 5 : Math.max(0, r.slot - 1)) * slotMs));
});

// ------------------------------------------------------------------ who's where
function whereHTML() {
  const r = info();
  const groups = teams.map((t) => ({ t, g: Number(answers.get(t.id)?.get('group')) || null }));
  const maxG = Math.max(6, ...groups.map((x) => x.g || 0));
  const slot = r.state === 'running' ? r.slot : 0;
  const rows = Array.from({ length: maxG }, (_, i) => {
    const g = i + 1;
    const names = groups.filter((x) => x.g === g).map((x) => esc(x.t.name)).join(', ');
    const s = stationFor(g, slot);
    const p = ST.find((x) => x.station === s);
    return `<li class="tag-${p.tag}"><span class="g">Group ${g}</span><strong>${r.state === 'part2' ? 'Box challenge' : esc(p.short)}</strong><span class="muted small">${names || '—'}</span></li>`;
  }).join('');
  const unassigned = groups.filter((x) => !x.g).map((x) => esc(x.t.name));
  return `<h2>${r.state === 'running' ? 'Where groups are now' : r.state === 'waiting' ? 'Starting stations' : 'All groups'}</h2>
    <ol class="where">${rows}</ol>
    ${unassigned.length ? `<p class="muted small">No group number yet: ${unassigned.join(', ')}</p>` : ''}`;
}

// ------------------------------------------------------------------ team cards
function teamCard(t) {
  const A = answers.get(t.id) || new Map();
  const T = [...(attempts.get(t.id)?.values() || [])];
  const s1 = S1.filter((p) => pageHasContent(p, A)).length;
  const st = ST.filter((p) => pageHasContent(p, A)).length;
  const members = [...A].filter(([k, v]) => k.startsWith('list:members:') && !parse(v)?.del).length;
  const name = (id) => A.get(`athlete${id}`)?.trim() || `Athlete ${id}`;
  const box = T.filter((r) => r.phase === 'box');
  const opt = T.filter((r) => r.phase === 'optojump');
  const best = ['1', '2'].map((id) => {
    const b = Math.max(0, ...box.filter((r) => r.athlete === id && r.success).map((r) => Number(r.box_cm)));
    const o = opt.filter((r) => r.athlete === id).map((r) => Number(r.height_cm));
    if (!b && !o.length) return '';
    return `<li>${esc(name(id))}: ${b ? `box ${fmtCm(b)} cm` : 'no box yet'}${o.length ? ` · Optojump best ${fmtCm(Math.max(...o))} cm` : ''}</li>`;
  }).join('');
  const strategies = [...A].filter(([k, v]) => (k.startsWith('list:strategies:') || k.startsWith('list:final_plan:')) && !parse(v)?.del).length;
  const g = A.get('group');
  return `<article class="card team-card">
    <header><h3>${esc(t.name)}</h3>${g ? `<span class="badge">Group ${esc(g)}</span>` : ''}</header>
    <p class="muted small">${members} member${members === 1 ? '' : 's'} · ${strategies} strateg${strategies === 1 ? 'y' : 'ies'}</p>
    <div class="bar" title="Session 1 tasks with content"><span style="--p:${(s1 / S1.length) * 100}%"></span></div>
    <p class="small">Session 1: ${s1}/${S1.length} tasks</p>
    <div class="bar" title="Stations with content"><span style="--p:${(st / ST.length) * 100}%"></span></div>
    <p class="small">Stations: ${st}/${ST.length} · ${box.length + opt.length} attempts logged</p>
    ${best ? `<ul class="small best">${best}</ul>` : ''}
    <a class="btn small-btn" href="./?class=${encodeURIComponent(classCode)}&team=${t.id}#/summary" target="_blank" rel="noopener">Open team summary</a>
  </article>`;
}

function render() {
  document.getElementById('clock').innerHTML = clockHTML();
  document.getElementById('where').innerHTML = whereHTML();
  document.getElementById('grid').innerHTML = projector ? '' : (teams.length
    ? teams.map(teamCard).join('')
    : `<p class="muted">No teams in class “${esc(classCode)}” yet. Students join at <strong>${esc(location.origin + location.pathname.replace(/tutor\.html$/, ''))}</strong></p>`);
}
