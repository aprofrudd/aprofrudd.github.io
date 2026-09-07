/*
 * endurance-model.js — is the number the whole story?
 *
 * Joyner (1991) modelled the marathon from three things: V̇O₂max, the
 * fraction of it a runner can hold (the lactate threshold), and running
 * economy. Only the first is the number this page is about. Two sliders
 * move the first two; the third has no figure in the abstract, so its box
 * stays open. The anchor is Joyner's own hypothetical runner: 84, 85%,
 * exceptional economy, 1:57:58 — against a world record then of 2:06:50.
 */

import { JOYNER, VO2MAX, UNIT_REL } from '../data.js';
import { refLink } from '../cite.js';
import { figure, card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, scaleLinear, round } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 760, H = 330;
const BOX = { w: 140, gap: 46, top: 52, h: 200, x0: 22 };
const bx = (i) => BOX.x0 + i * (BOX.w + BOX.gap);
const BAR = { x: 44, w: 52 };   // bar inset within a box

export function enduranceModel(mount) {
  let vo2 = JOYNER.vo2max;
  let frac = Math.round(JOYNER.ltFraction * 100);

  const box = card(
    "Joyner's three-part model of a marathon",
    'Drag the sliders',
    'Three things decide how fast you can run for two hours: the ceiling, the share of it you can hold, ' +
    `and how much of it each stride costs. Only the first is ${VO2MAX}.`,
    true
  );

  const fig = figure({
    label: '', wide: true,
    caption: `After ${refLink('joyner1991')}. The abstract gives no figure for running economy, so the third box stays open.`,
    onReset: () => preset(),
  });

  const vSlider = slider({
    label: `${VO2MAX}, ${UNIT_REL}`, ariaLabel: 'VO2max, millilitres per kilogram per minute',
    min: JOYNER.sliders.vo2[0], max: JOYNER.sliders.vo2[1], step: 1, value: vo2,
    format: String, onInput: (v) => { vo2 = v; render(); },
  });
  const fSlider = slider({
    label: 'Fraction you can hold to the finish',
    min: JOYNER.sliders.lt[0], max: JOYNER.sliders.lt[1], step: 1, value: frac,
    format: (v) => `${v}%`, onInput: (v) => { frac = v; render(); },
  });

  const out = readout([
    { value: '', labelHtml: `Available at threshold, <span class="v-nocase">${UNIT_REL}</span>` },
    { value: '', label: "Against Joyner's runner" },
    { value: 'running economy', label: 'The missing piece', small: true },
  ]);

  box.body.appendChild(h('div', { class: 'v-controls' },
    h('button', { class: 'v-btn', type: 'button', onclick: preset }, "Joyner's hypothetical runner")));
  box.body.appendChild(fig.figure);
  box.body.appendChild(vSlider);
  box.body.appendChild(fSlider);
  box.body.appendChild(out);
  mount.appendChild(box);
  onFirstView(box, render);

  function preset() { vSlider.set(JOYNER.vo2max); fSlider.set(Math.round(JOYNER.ltFraction * 100)); }

  function render() {
    const y = scaleLinear(0, 100, BOX.top + BOX.h, BOX.top);
    const root = svg(W, H);
    const avail = (vo2 * frac) / 100;
    const jAvail = JOYNER.vo2max * JOYNER.ltFraction;
    const mid = BOX.top + BOX.h / 2;

    const frame = (i, title) => add(root,
      el('rect', { x: bx(i), y: BOX.top, width: BOX.w, height: BOX.h, rx: 8, fill: 'var(--background-alt)', stroke: 'var(--border-color)' }),
      el('text', { x: bx(i) + BOX.w / 2, y: BOX.top - 16, 'text-anchor': 'middle', class: 'v-label-strong' }, title));
    const arrow = (i, label) => {
      const x1 = bx(i) + BOX.w + 6, x2 = bx(i + 1) - 8;
      add(root,
        el('path', { d: `M${x1},${mid} L${x2 - 6},${mid}`, stroke: 'var(--v-neutral)', 'stroke-width': 1.5 }),
        el('path', { d: `M${x2 - 6},${mid - 5} L${x2},${mid} L${x2 - 6},${mid + 5} Z`, fill: 'var(--v-neutral)' }),
        el('text', { x: (x1 + x2) / 2, y: mid - 10, 'text-anchor': 'middle', class: 'v-label-sm' }, label));
    };

    frame(0, VO2MAX); frame(1, 'what you can hold'); frame(2, 'running economy'); frame(3, 'marathon time');
    arrow(0, `× ${frac}%`); arrow(1, '÷ ?'); arrow(2, '=');

    // Box 1 — the ceiling, with Joyner's runner as a ghost behind.
    add(root,
      el('rect', { x: bx(0) + BAR.x, y: y(JOYNER.vo2max), width: BAR.w, height: y(0) - y(JOYNER.vo2max), fill: 'none', stroke: 'var(--v-neutral)', 'stroke-dasharray': '3 3' }),
      el('rect', { x: bx(0) + BAR.x, y: y(vo2), width: BAR.w, height: y(0) - y(vo2), fill: 'var(--v-safe)', rx: 3 }),
      el('text', { x: bx(0) + BOX.w / 2, y: y(vo2) - 7, 'text-anchor': 'middle', class: 'v-label-strong' }, String(vo2))
    );
    // Box 2 — the same bar, the part you cannot hold hatched out.
    add(root,
      el('rect', { x: bx(1) + BAR.x, y: y(vo2), width: BAR.w, height: Math.max(0, y(avail) - y(vo2)), fill: 'var(--v-risk)', opacity: 0.18, rx: 3 }),
      el('rect', { x: bx(1) + BAR.x, y: y(avail), width: BAR.w, height: y(0) - y(avail), fill: 'var(--v-safe)', rx: 3 }),
      el('text', { x: bx(1) + BOX.w / 2, y: y(avail) - 7, 'text-anchor': 'middle', class: 'v-label-strong' }, avail.toFixed(1))
    );
    // Box 3 — the unknown.
    add(root,
      el('text', { x: bx(2) + BOX.w / 2, y: mid + 14, 'text-anchor': 'middle', class: 'v-label-strong', style: 'font-size:38px', fill: 'var(--v-neutral)' },
        JOYNER.economy == null ? '?' : String(JOYNER.economy)),
      el('text', { x: bx(2) + BOX.w / 2, y: BOX.top + BOX.h - 16, 'text-anchor': 'middle', class: 'v-label-sm' }, 'no figure in the abstract')
    );
    // Box 4 — the anchor, fixed.
    add(root,
      el('text', { x: bx(3) + BOX.w / 2, y: mid - 8, 'text-anchor': 'middle', class: 'v-label-strong', style: 'font-size:24px' }, JOYNER.predicted),
      el('text', { x: bx(3) + BOX.w / 2, y: mid + 16, 'text-anchor': 'middle', class: 'v-label-sm' }, `Joyner's runner: ${JOYNER.vo2max} × ${Math.round(JOYNER.ltFraction * 100)}%`),
      el('text', { x: bx(3) + BOX.w / 2, y: mid + 34, 'text-anchor': 'middle', class: 'v-label-sm' }, `record then ${JOYNER.recordThen}`)
    );

    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    const diff = ((avail - jAvail) / jAvail) * 100;
    out.setAll([avail.toFixed(1), `${diff >= 0 ? '+' : '−'}${Math.abs(round(diff, 0))}%`, 'running economy']);

    fig.setLabel(
      `Three linked boxes. A VO2max of ${vo2} millilitres per kilogram per minute, of which ${frac} per cent can be held, ` +
      `leaves ${avail.toFixed(1)} at threshold. Running economy has no figure. Joyner's model predicted a marathon of ` +
      `${JOYNER.predicted} with 84, 85 per cent and exceptional economy; the record then was ${JOYNER.recordThen}.`);
    fig.setTable({
      caption: "Joyner's model, from the abstract",
      head: ['Factor', 'Your runner', "Joyner's runner"],
      rows: [
        [`VO2max (${UNIT_REL})`, String(vo2), String(JOYNER.vo2max)],
        ['Fraction held', `${frac}%`, `${Math.round(JOYNER.ltFraction * 100)}%`],
        [`Available at threshold (${UNIT_REL})`, avail.toFixed(1), jAvail.toFixed(1)],
        ['Running economy', 'no figure', 'exceptional (no figure)'],
        ['Predicted marathon', '—', JOYNER.predicted],
      ],
      keyRow: 2,
    });
  }
}
