/*
 * met-explorer.js — what a MET actually is.
 *
 * A MET is a multiple of resting metabolism, so the fastest way to make it
 * concrete is to let people slide through the range and see, at every point,
 * an activity they recognise sitting next to the oxygen figure. The three
 * bands the paper uses as cut-points are drawn underneath, so by the time the
 * reader reaches section 07 the numbers already mean something physical.
 */

import { ACTIVITIES, MET_ML, BANDS, STUDY, PAPER, UNIT_ABS, UNIT_REL } from '../data.js';
import { card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, round } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 760, H = 150;
const M = { left: 26, right: 26, top: 34, bottom: 44 };
const PLOT_W = W - M.left - M.right;

const MIN_MET = 1, MAX_MET = 20, START_MET = 8, START_KG = 80;

export function metExplorer(mount) {
  let met = START_MET;
  let kg = START_KG;

  const box = card(
    'What a MET feels like',
    'Drag the slider',
    'Slide through the range and watch what each number actually means &mdash; ' +
    'in oxygen, and in something you could go and do this afternoon.'
  );

  const out = readout([
    { value: '', label: 'METs' },
    { value: '', labelHtml: `Oxygen uptake, <span class="v-nocase">${UNIT_REL}</span>` },
    { value: '', label: 'Times your resting rate' },
    { value: '', label: 'Feels like', small: true },
  ]);

  const chart = h('div', { class: 'v-chart', role: 'img', 'aria-label': '' });

  const massField = h('label', { class: 'v-field' },
    h('span', {}, 'Your body mass (kg), if you want the last two numbers'),
    h('input', { type: 'number', min: '30', max: '200', step: '1', value: String(START_KG) })
  );
  const massInput = massField.querySelector('input');
  massInput.addEventListener('input', () => {
    const v = Number(massInput.value);
    kg = Number.isFinite(v) && v >= 30 && v <= 200 ? v : 0;
    update();
  });

  const perPerson = readout([
    { value: '', labelHtml: `Oxygen uptake, <span class="v-nocase">${UNIT_ABS}</span>` },
    { value: '', label: 'Calories / min' },
  ]);

  const sld = slider({
    label: 'Exercise capacity',
    min: MIN_MET, max: MAX_MET, step: 0.1, value: START_MET,
    format: (v) => `${v.toFixed(1)} METs`,
    onInput: (v) => { met = v; update(); },
  });

  box.body.appendChild(sld);
  box.body.appendChild(chart);
  box.body.appendChild(h('p', { class: 'v-scroll-hint' }, 'Swipe the chart sideways to see all of it.'));
  box.body.appendChild(out);
  box.body.appendChild(h('div', { class: 'v-controls' }, massField));
  box.body.appendChild(perPerson);
  box.body.appendChild(h('div', { class: 'v-controls v-controls-end' },
    h('button', { class: 'v-btn', type: 'button', onclick: () => { sld.set(START_MET); massInput.value = String(START_KG); kg = START_KG; update(); } }, 'Reset')
  ));

  // The definition, in the paper's own words.
  box.body.appendChild(h('blockquote', { class: 'v-quote' },
    STUDY.metDefinition,
    h('cite', {}, `${PAPER.authors}, ${PAPER.citation}`)
  ));

  mount.appendChild(box);

  // The caveat that governs every MET figure in this module: nobody in the
  // study wore a mask. Both quotes are verbatim from the paper.
  const caveat = h('div', { class: 'v-callout v-callout-warn' });
  caveat.innerHTML =
    '<span class="v-callout-head">One thing to hold on to: estimated, not measured</span>' +
    'Not one of the 6,213 men had his oxygen actually measured. The METs in this study were worked ' +
    'out from how fast and how steep the treadmill was &mdash; &ldquo;' + STUDY.metEstimation + '&rdquo; ' +
    'The authors are straightforward about what that costs: &ldquo;' + STUDY.limitationMeasured + '&rdquo;' +
    '<br><br>' +
    'It matters in one direction in particular. The equations assume your body has settled into a ' +
    'steady state at each speed, which in the last minutes of a test to exhaustion it has not, so an ' +
    'estimated MET score tends to flatter the person being tested. A <em>measured</em> 8 METs is a ' +
    'fitter person than an <em>estimated</em> 8 METs. Keep that in mind every time a number in this ' +
    'module says 5 or 8.';
  mount.appendChild(caveat);

  let marker, markerLabel;

  drawScale();
  update();
  onFirstView(box, () => {});

  function drawScale() {
    const root = svg(W, H);
    const g = group(M.left, M.top);
    const x = scaleLinear(MIN_MET, MAX_MET, 0, PLOT_W);

    // The three bands the paper uses. Everything below 5 METs was called high
    // risk; everything above 8 was called low risk.
    const colours = { low: 'var(--v-risk)', mid: 'var(--v-neutral)', high: 'var(--v-safe)' };
    BANDS.forEach((b) => {
      const bx = x(Math.max(b.min, MIN_MET));
      const bw = x(Math.min(b.max, MAX_MET)) - bx;
      add(g, el('rect', {
        x: bx, y: 0, width: bw, height: 26, rx: 4,
        fill: colours[b.key], opacity: 0.18,
      }));
      add(g, el('text', {
        x: bx + bw / 2, y: 17, 'text-anchor': 'middle', class: 'v-label-sm',
        fill: colours[b.key], 'font-weight': '600',
      }, b.label));
    });

    // Axis ticks every 2 METs.
    for (let v = 2; v <= MAX_MET; v += 2) {
      add(g,
        el('line', { x1: x(v), y1: 30, x2: x(v), y2: 36, class: 'v-axis-line' }),
        el('text', { x: x(v), y: 50, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
      );
    }
    add(g, el('line', { x1: 0, y1: 30, x2: PLOT_W, y2: 30, class: 'v-axis-line' }));
    add(g, el('text', { x: PLOT_W / 2, y: 72, 'text-anchor': 'middle', class: 'v-label-strong' }, 'METs'));

    // The marker that follows the slider.
    marker = group(0, 0);
    add(marker,
      el('path', { d: 'M0,-8 L6,-20 L-6,-20 Z', fill: 'var(--secondary-color)' }),
      el('line', { x1: 0, y1: -8, x2: 0, y2: 30, stroke: 'var(--secondary-color)', 'stroke-width': 2 })
    );
    markerLabel = el('text', { x: 0, y: -26, 'text-anchor': 'middle', class: 'v-label-strong' }, '');
    add(marker, markerLabel);
    add(g, marker);

    add(root, g);
    chart.innerHTML = '';
    chart.appendChild(root);
    marker.__x = x;
  }

  function activityFor(v) {
    // The closest listed activity, so the label always names something real.
    let best = ACTIVITIES[0];
    let gap = Infinity;
    ACTIVITIES.forEach((a) => {
      const d = Math.abs(a.met - v);
      if (d < gap) { gap = d; best = a; }
    });
    return best;
  }

  function bandFor(v) {
    return BANDS.find((b) => v >= b.min && v < b.max) || BANDS[BANDS.length - 1];
  }

  function update() {
    const ml = met * MET_ML;
    const act = activityFor(met);
    const band = bandFor(met);

    out.setAll([
      met.toFixed(1),
      round(ml, 1).toFixed(1),
      `${met.toFixed(1)}×`,
      act.name,
    ]);

    if (kg) {
      const litres = (ml * kg) / 1000;
      // About 5 kilocalories are released per litre of oxygen consumed.
      perPerson.setAll([litres.toFixed(2), Math.round(litres * 5).toString()]);
    } else {
      perPerson.setAll(['—', '—']);
    }

    if (marker && marker.__x) {
      marker.setAttribute('transform', `translate(${marker.__x(met)},0)`);
      markerLabel.textContent = `${met.toFixed(1)}`;
    }

    chart.setAttribute('aria-label',
      `A scale of exercise capacity from 1 to 20 METs, split into the three bands used by the study. ` +
      `The marker is at ${met.toFixed(1)} METs, which is ${band.label}, about the effort of ${act.name.toLowerCase()}.`);
  }

  return { update };
}
