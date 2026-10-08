// Turns a team's raw answers into readable spreadsheet rows for the tutor.
// Walks the same PAGES blocks the student app renders, so new pages are exported automatically.
import { PAGES, DISC, WHEN, VARS, EFFECT, BOXES, ROLES } from './content.js';
import { FRAMEWORKS, SPECTRUM, SPECTRUM_EXAMPLES } from './frameworks.js';

const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
const QUAD = { hh: 'High impact, can change today (priority)', hl: 'High impact, can’t change today', lh: 'Lower impact, can change today', ll: 'Lower impact, can’t change today' };
const EFF = Object.fromEntries(EFFECT.map((e) => [e.id, e.label]));

function listItems(A, id) {
  const pre = `list:${id}:`;
  return [...A].filter(([k]) => k.startsWith(pre)).map(([key, v]) => ({ key, ...parse(v) }))
    .filter((i) => i.text != null && !i.del).sort((a, b) => (a.t || 0) - (b.t || 0));
}

function itemDetails(A, i) {
  const at = (n) => A.get(`attr:${i.key}:${n}`) || '';
  const bits = [];
  if (i.d) bits.push(`Discipline: ${DISC[i.d]?.label || i.d}`);
  if (i.when) bits.push(`When: ${WHEN.find((w) => w.id === i.when)?.label || i.when}`);
  if (i.also?.length) bits.push(`Also affects: ${i.also.map((d) => DISC[d]?.label).join(', ')}`);
  if (at('q')) bits.push(`Priority grid: ${QUAD[at('q')]}`);
  else if (i.star) bits.push('Priority: yes');
  if (at('cons')) bits.push(`Constraint: ${at('cons')}`);
  if (at('ring')) bits.push(`Bronfenbrenner: ${at('ring')}system`);
  if (at('athpick') === '1') bits.push('Athlete picked as important');
  if (at('pred')) bits.push(`Predicted: ${EFF[at('pred')]}`);
  if (at('act')) bits.push(`Actual: ${EFF[at('act')]}`);
  if (at('keep')) bits.push(`Station 5: ${at('keep')}`);
  return bits.join('; ');
}

const athleteName = (A, id) => A.get(`athlete${id}`)?.trim() || `Athlete ${id}`;

function blockRows(b, A, push) {
  const opt = (opts, v) => opts.find((o) => o.id === v)?.label || v;
  switch (b.type) {
    case 'columns': b.blocks.forEach((x) => blockRows(x, A, push)); break;
    case 'field': case 'short': if (A.get(b.id)) push(b.label, '', A.get(b.id)); break;
    case 'questions': b.items.forEach((q) => { if (A.get(q.id)) push(q.q, q.tag, A.get(q.id)); }); break;
    case 'rating': if (A.get(b.id)) push(b.label, '', `${A.get(b.id)}/${b.max || 10}`); break;
    case 'choice': if (A.get(b.id)) push(b.label, '', opt(b.options, A.get(b.id))); break;
    case 'chips': {
      const on = b.options.filter((o) => A.get(`${b.id}:${o.id}`) === '1').map((o) => o.label);
      if (on.length) push(b.label, '', on.join('; '));
      break;
    }
    case 'list': listItems(A, b.id).forEach((i) => push(b.label, i.text, itemDetails(A, i))); break;
    case 'web': listItems(A, b.id).forEach((l) => push(b.label, '', l.text)); break;
    case 'claim': {
      const g = (s) => A.get(`${b.id}.${s}`)?.trim();
      if (g('s') || g('m')) push(b.label || 'Claim', '', `We think ${g('s') || '…'} will change ${g('v') || '…'} because ${g('m') || '…'}. We’ll know it worked if ${g('e') || '…'}.`);
      break;
    }
    case 'rule': {
      const g = (s) => A.get(`${b.id}.${s}`)?.trim();
      if (g('v') || g('a')) push(b.label || 'Decision rule', '', `If ${g('v') || '…'} ${g('d') || '…'}, then we will ${g('a') || '…'}.`);
      break;
    }
    case 'varMethods': VARS.filter((v) => A.get(`var:${v.id}`) === '1').forEach((v) => push('Method for each variable', v.label, A.get(`varm:${v.id}`) || '(no method chosen)')); break;
    case 'roles': [...A].filter(([k, v]) => k.startsWith('role:') && v).forEach(([k, v]) => push('Roles', ROLES.find((r) => r.id === k.slice(5))?.label || k.slice(5), v)); break;
    case 'prepost': ['1', '2'].forEach((id) => {
      const pre = A.get(`${b.id}_pre:${id}`), post = A.get(`${b.id}_post:${id}`);
      if (pre || post) push(b.label, athleteName(A, id), `Before ${pre || '–'} cm, after ${post || '–'} cm`);
    }); break;
    case 'compare': ['1', '2'].forEach((id) => {
      const p = A.get(`perceived:${id}`);
      if (p) push('Box the athlete thinks they could clear', athleteName(A, id), Number(p) ? BOXES.find((x) => String(x.cm) === p)?.label || `${p} cm` : 'None of them');
    }); break;
    case 'calc': ['1', '2'].forEach((id) => {
      const e = parse(A.get(`est:${id}`));
      if (e) push('Plyobox estimate', athleteName(A, id), `CMJ ${e.cmj} cm → estimated max box ${e.est} cm`);
    }); break;
    case 'vote': {
      const votes = [...A].filter(([k, v]) => k.startsWith(`vote:${b.id}:`) && v).map(([, v]) => v);
      if (votes.length) push(b.label, `${votes.length} vote${votes.length === 1 ? '' : 's'}`, b.options.map((o) => `${o.label}: ${votes.filter((v) => v === o.id).length}`).join('; '));
      break;
    }
    case 'spectrum': SPECTRUM_EXAMPLES.forEach((ex) => {
      const v = A.get(`spec:${ex.id}`);
      if (v) push('Mono / multi / inter / trans', ex.text, `Team: ${opt(SPECTRUM, v)} · Suggested: ${opt(SPECTRUM, ex.answer)}${v === ex.answer ? ' (agree)' : ''}`);
    }); break;
    default: break;
  }
}

// Extra summary-page items that aren't in PAGES.
const SUMMARY_VOTES = [
  { id: 'spectrum_end', label: 'Where did your team really work today?', options: SPECTRUM },
  { id: 'best_fw', label: 'Framework that best explains your team today', options: FRAMEWORKS.map((f) => ({ id: f.id, label: f.name })) },
  { id: 'tw_critical', label: 'Teamwork: critical thinking (1–5)', options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) })) },
  { id: 'tw_comm', label: 'Teamwork: communication (1–5)', options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) })) },
  { id: 'tw_discussion', label: 'Teamwork: discussion (1–5)', options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) })) },
  { id: 'tw_coop', label: 'Teamwork: co-operation (1–5)', options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) })) },
];
const SUMMARY_FIELDS = [
  { id: 'best_fw_why', label: 'Why that framework?' },
  { id: 'tw_critical_ex', label: 'Example of critical thinking' },
  { id: 'tw_comm_ex', label: 'Example of communication' },
  { id: 'tw_discussion_ex', label: 'Example of discussion' },
  { id: 'tw_coop_ex', label: 'Example of co-operation' },
];

export function answerRows(team, A) {
  const rows = [];
  const base = { Team: team.name, Group: A.get('group') || '' };
  for (const page of PAGES) {
    const push = (question, item, response) => rows.push({ ...base, Page: page.title, Question: question, Item: item, Response: response });
    page.blocks.forEach((b) => blockRows(b, A, push));
    if (page.id === 'summary') {
      SUMMARY_VOTES.forEach((v) => blockRows({ type: 'vote', ...v }, A, push));
      SUMMARY_FIELDS.forEach((f) => blockRows({ type: 'short', ...f }, A, push));
    }
  }
  if (A.get('tutor_feedback')) rows.push({ ...base, Page: 'Tutor', Question: 'Your feedback', Item: '', Response: A.get('tutor_feedback') });
  return rows;
}

export function attemptRows(team, A, attempts) {
  return attempts.filter((r) => !String(r.phase).endsWith(':removed'))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((r) => ({
      Team: team.name,
      Group: A.get('group') || '',
      Athlete: athleteName(A, r.athlete),
      Phase: r.phase === 'box' ? 'Box challenge' : r.phase === 'optojump' ? 'Optojump' : r.phase,
      'Box (cm)': r.box_cm ?? '',
      'Jump height (cm)': r.height_cm ?? '',
      Outcome: r.success == null ? '' : r.success ? 'Made it' : 'Didn’t make it',
      Strategy: r.strategy || 'Baseline',
      Discipline: r.discipline ? DISC[r.discipline]?.label || r.discipline : '',
      'Confidence (1-10)': r.confidence ?? '',
      Notes: r.notes || '',
      Time: new Date(r.created_at).toLocaleString('en-GB'),
    }));
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

export function download(name, csv) {
  // The BOM makes Excel read the file as UTF-8 (curly quotes, accents, arrows).
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
