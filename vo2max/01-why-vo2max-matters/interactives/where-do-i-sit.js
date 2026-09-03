/*
 * where-do-i-sit.js — placing your own number in the study.
 *
 * People will inevitably ask "so where am I?", and it is better to answer it
 * with the caveats attached than to leave them guessing. This maps a MET or
 * VO2max value onto the paper's own fitness bands and quintiles — and says
 * clearly what that does and does not mean, because the cohort was men,
 * referred by a doctor, tested between 1987 and 2000.
 */

import { FIGURE2, BANDS, MET_ML, ACTIVITIES, VO2MAX, UNIT_REL } from '../data.js';
import { card, toggle, readout, h } from '../../lib/figure.js';
import { onFirstView } from '../../lib/reveal.js';

export function whereDoISit(mount) {
  let unit = 'met';
  let value = 10;
  let groupKey = 'normal';

  const box = card(
    'Where would you sit in this study?',
    'Enter a number',
    `If you know your ${VO2MAX} or your MET score from a test, this places it against ` +
    'the bands the paper used. Read the caveat underneath before you take it to heart.'
  );

  const unitTog = toggle(
    [{ value: 'met', label: 'METs' }, { value: 'vo2', label: UNIT_REL }],
    unit,
    (v) => { unit = v; input.value = String(unit === 'met' ? 10 : 35); sync(); },
    'Choose which unit you want to type in'
  );

  const groupTog = toggle(
    [{ value: 'normal', label: 'Compare with the healthy men' }, { value: 'cvd', label: 'Compare with the men with heart disease' }],
    groupKey,
    (v) => { groupKey = v; sync(); },
    'Choose which group to compare against'
  );

  const field = h('label', { class: 'v-field' },
    h('span', {}, 'Your number'),
    h('input', { type: 'number', min: '1', max: '90', step: '0.1', value: '10' })
  );
  const input = field.querySelector('input');
  input.addEventListener('input', sync);

  const out = readout([
    { value: '', label: 'In METs' },
    { value: '', labelHtml: `In <span class="v-nocase">${UNIT_REL}</span>` },
    { value: '', label: 'The study’s band' },
    { value: '', label: 'Which fifth', small: true },
  ]);

  const verdict = h('div', { class: 'v-callout' });

  box.body.appendChild(h('div', { class: 'v-controls' }, unitTog, field));
  box.body.appendChild(h('div', { class: 'v-controls' }, groupTog));
  box.body.appendChild(out);
  box.body.appendChild(verdict);
  box.body.appendChild(h('div', { class: 'v-callout v-callout-warn' },
    h('span', { class: 'v-callout-head' }, 'Please read this bit'),
    h('span', { html: '' })
  ));
  box.body.lastChild.lastChild.innerHTML =
    'This is <strong>not</strong> a health check and it is not a norm table. Every man in this study was ' +
    'referred for a treadmill test by a doctor, was tested between 1987 and 2000, and had his METs ' +
    '<em>estimated</em> from the treadmill rather than measured. If your number came from a proper ' +
    'laboratory test with a mask, it is measured, and a measured value is worth more than an estimated ' +
    'one at the same number. If you are not a man, this study says nothing directly about you &mdash; the ' +
    'authors say so themselves. Use this to understand the paper, not to predict your own future.';

  mount.appendChild(box);
  onFirstView(box, sync);

  function sync() {
    const raw = Number(input.value);
    if (!Number.isFinite(raw) || raw <= 0) {
      out.setAll(['—', '—', '—', '—']);
      verdict.innerHTML = 'Type a number above.';
      return;
    }
    value = unit === 'met' ? raw : raw / MET_ML;
    const ml = value * MET_ML;

    const band = BANDS.find((b) => value >= b.min && value < b.max) || BANDS[BANDS.length - 1];
    const qs = FIGURE2[groupKey].quintiles;
    const q = qs.find((s) => value >= s.lo3 && (s.hi3 === null || value <= s.hi3)) || qs[qs.length - 1];

    // The closest everyday activity, to keep the number physical.
    let act = ACTIVITIES[0], gap = Infinity;
    ACTIVITIES.forEach((a) => { const d = Math.abs(a.met - value); if (d < gap) { gap = d; act = a; } });

    out.setAll([
      value.toFixed(1),
      ml.toFixed(1),
      band.label,
      q.q === 5 ? 'Fittest fifth' : q.q === 1 ? 'Least fit fifth' : `Fifth ${q.q} of 5`,
    ]);

    const rr = q.rr;
    const groupLabel = FIGURE2[groupKey].label.toLowerCase();
    verdict.innerHTML =
      `<span class="v-callout-head">${value.toFixed(1)} METs</span>` +
      `That is roughly the effort of <strong>${act.name.toLowerCase()}</strong>. ` +
      `Among the ${groupLabel} in this study, that puts you in the ` +
      `<strong>${q.q === 5 ? 'fittest fifth' : q.q === 1 ? 'least fit fifth' : `${['', 'first', 'second', 'third', 'fourth', 'fifth'][q.q]} fifth`}</strong> ` +
      `(${q.range}). ` +
      (q.q === 5
        ? 'That was the group everyone else in the study was compared against.'
        : `Men in that fifth were about <strong>${rr}×</strong> as likely to die during the study as the fittest fifth.`);
  }
}
