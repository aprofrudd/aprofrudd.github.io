/*
 * table2-distributions.js — Table 2, drawn as two distributions.
 *
 * The paper reports a mean and a standard deviation for each group, which is
 * enough to draw the whole bell curve. That matters, because a table of means
 * invites the reader to think "under 8.4 METs and you are one of the ones who
 * died". The curves show the opposite: they overlap almost completely. The
 * gap between the groups is real and it is small, and both things are true.
 *
 * The draggable threshold makes the point concrete — wherever you put the
 * line, it catches a similar share of both groups.
 */

import { TABLE2, TABLE2_FULL } from '../data.js';
import { figure, toggle, card, slider, readout, legend, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, normalPdf, normalCdf, line, comma, round } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 760, H = 360;
const M = { top: 24, right: 24, bottom: 62, left: 30 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const MET_MIN = 0, MET_MAX = 22;
const START_CUT = 8;   // the paper's own "low risk" cut-point

export function table2Distributions(mount) {
  let groupKey = 'normal';
  let cut = START_CUT;

  const box = card(
    'How fit were the men who died, and the men who did not?',
    'Move the line',
    'Each curve shows the spread of fitness in one group, built from the average and ' +
    'the variation the paper reports. Drag the line to any level of fitness and see what ' +
    'share of each group falls below it.',
    true
  );

  const tog = toggle(
    [{ value: 'normal', label: 'Healthy men' }, { value: 'cvd', label: 'Men with heart disease' }],
    groupKey,
    (v) => { groupKey = v; render(); },
    'Choose which group of men to show'
  );

  const out = readout([
    { value: '', label: 'Survivors below the line' },
    { value: '', label: 'Men who died below the line' },
    { value: '', label: 'Gap in averages' },
  ]);

  const fig = figure({
    label: '',
    caption: 'Built from Table 2 of Myers et al. (2002). Curves are drawn from the reported mean and standard deviation of each group.',
    onReset: () => { cut = START_CUT; cutSlider.set(START_CUT); groupKey = 'normal'; tog.select('normal'); render(); },
  });

  const cutSlider = slider({
    label: 'Fitness threshold',
    min: 2, max: 18, step: 0.1, value: START_CUT,
    format: (v) => `${v.toFixed(1)} METs`,
    onInput: (v) => { cut = v; render(); },
  });

  const note = h('p', { class: 'v-card-sub', style: 'margin:1.25rem 0 0' });

  box.body.appendChild(h('div', { class: 'v-controls' }, tog));
  box.body.appendChild(legend([
    { swatch: 'safe', label: 'Men who survived' },
    { swatch: 'risk', label: 'Men who died' },
  ]));
  box.body.appendChild(fig.figure);
  box.body.appendChild(cutSlider);
  box.body.appendChild(out);
  box.body.appendChild(note);
  mount.appendChild(box);

  onFirstView(box, render);

  function render() {
    const g = TABLE2[groupKey];
    const series = [
      { key: 'survived', label: 'Survived', d: g.survived, colour: 'var(--v-safe)' },
      { key: 'died', label: 'Died', d: g.died, colour: 'var(--v-risk)' },
    ];

    const peak = Math.max(...series.map((s) => normalPdf(s.d.met, s.d.met, s.d.sd)));
    const x = scaleLinear(MET_MIN, MET_MAX, 0, PLOT_W);
    const y = scaleLinear(0, peak * 1.12, PLOT_H, 0);

    const root = svg(W, H);
    const plot = group(M.left, M.top);

    // Baseline and MET ticks.
    add(plot, el('line', { x1: 0, y1: PLOT_H, x2: PLOT_W, y2: PLOT_H, class: 'v-axis-line' }));
    for (let v = 0; v <= MET_MAX; v += 2) {
      add(plot,
        el('line', { x1: x(v), y1: PLOT_H, x2: x(v), y2: PLOT_H + 5, class: 'v-axis-line' }),
        el('text', { x: x(v), y: PLOT_H + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
      );
    }
    add(plot, el('text', { x: PLOT_W / 2, y: PLOT_H + 42, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Exercise capacity (METs)'));

    // The two curves, filled so the overlap is unmissable.
    const pts = (s) => {
      const out2 = [];
      for (let v = MET_MIN; v <= MET_MAX; v += 0.2) out2.push([x(v), y(normalPdf(v, s.d.met, s.d.sd))]);
      return out2;
    };

    series.forEach((s) => {
      const p = pts(s);
      const area = `${line(p)} L${PLOT_W},${PLOT_H} L0,${PLOT_H} Z`;
      add(plot,
        el('path', { d: area, fill: s.colour, opacity: 0.16 }),
        el('path', { d: line(p), fill: 'none', stroke: s.colour, 'stroke-width': 2.5 })
      );
      // Mean marker.
      const mx = x(s.d.met);
      const my = y(normalPdf(s.d.met, s.d.met, s.d.sd));
      add(plot,
        el('line', { x1: mx, y1: my, x2: mx, y2: PLOT_H, stroke: s.colour, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
        el('text', {
          x: mx, y: my - 8, 'text-anchor': 'middle', class: 'v-label-strong',
          fill: s.colour,
        }, `${s.label}: ${s.d.met}`)
      );
    });

    // The draggable threshold.
    const cx = x(cut);
    add(plot,
      el('rect', { x: 0, y: 0, width: cx, height: PLOT_H, fill: 'var(--secondary-color)', opacity: 0.05 }),
      el('line', { x1: cx, y1: -6, x2: cx, y2: PLOT_H, stroke: 'var(--secondary-color)', 'stroke-width': 2 }),
      el('text', { x: cx, y: -12, 'text-anchor': 'middle', class: 'v-label-strong' }, `${cut.toFixed(1)} METs`)
    );

    add(root, plot);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    // Readouts.
    const belowSurv = normalCdf(cut, g.survived.met, g.survived.sd) * 100;
    const belowDied = normalCdf(cut, g.died.met, g.died.sd) * 100;
    const gap = round(g.survived.met - g.died.met, 1);
    out.setAll([`${Math.round(belowSurv)}%`, `${Math.round(belowDied)}%`, `${gap} METs`]);

    fig.setLabel(
      `Two overlapping bell curves of exercise capacity for ${g.label.toLowerCase()}. ` +
      `Men who survived averaged ${g.survived.met} METs; men who died averaged ${g.died.met} METs. ` +
      `Below a threshold of ${cut.toFixed(1)} METs sit ${Math.round(belowSurv)} per cent of the survivors ` +
      `and ${Math.round(belowDied)} per cent of those who died.`);

    fig.setTable({
      caption: `Table 2 of Myers et al. 2002, ${g.label}`,
      head: ['Measurement', 'All', 'Survived', 'Died', 'P value'],
      rows: TABLE2_FULL.map((r) => groupKey === 'normal'
        ? [r.row, r.nTot, r.nSur, r.nDied, r.nP]
        : [r.row, r.cTot, r.cSur, r.cDied, r.cP]),
      keyRow: TABLE2_FULL.length - 1,
    });

    note.innerHTML =
      `Among the <strong>${g.label.toLowerCase()}</strong>, ${comma(g.survived.n)} men survived and ` +
      `${comma(g.died.n)} died. The men who survived averaged <strong>${g.survived.met} METs</strong>; ` +
      `the men who died averaged <strong>${g.died.met} METs</strong>. That difference is ` +
      `statistically solid (p&nbsp;${g.p}) &mdash; and it is only ${gap} METs. ` +
      `Look at how far the two curves overlap. Fitness shifts the odds across a whole population; ` +
      `it does not tell you what will happen to any one person. Both of those statements come from ` +
      `this same picture, and people routinely take only the first one away from it.`;
  }

  return { render };
}
