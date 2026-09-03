/*
 * km-curves.js — Figure 3 rebuilt, plus a demonstration of how the curve is
 * actually constructed.
 *
 * Two pieces:
 *   A. A tiny worked example — ten people, one at a time — so the reader sees
 *      that a survival curve is just "what fraction are still here", and that
 *      the steps come from events, not from time passing.
 *   B. The paper's own curves, with a time cursor you can drag.
 *
 * The honest wrinkle: censoring is the reason Kaplan-Meier exists, and this
 * paper says outright that it did not censor. Part A teaches the idea; the
 * caveat card says what the paper did instead.
 */

import { FIGURE3, STUDY } from '../data.js';
import { figure, toggle, card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, stepLine, line, drawIn, fadeIn } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

/* ===========================================================================
   A. How a survival curve gets built
   ======================================================================== */

// Ten imaginary people. `t` is when something happened; `event` true means
// they died, false means we simply stopped being able to follow them.
const DEMO = [
  { id: 1,  t: 1,  event: true },
  { id: 2,  t: 2,  event: false },
  { id: 3,  t: 3,  event: true },
  { id: 4,  t: 4,  event: true },
  { id: 5,  t: 5,  event: false },
  { id: 6,  t: 6,  event: true },
  { id: 7,  t: 7,  event: false },
  { id: 8,  t: 8,  event: true },
  { id: 9,  t: 9,  event: false },
  { id: 10, t: 10, event: false },
];

const DW = 720, DH = 300;
const DM = { top: 24, right: 130, bottom: 52, left: 52 };

export function kmDemo(mount) {
  let step = 0;

  const box = card(
    'How a survival curve is built',
    'Step through it',
    'Ten people, followed for ten years. Press the button to advance one year at a time. ' +
    'A cross means someone died. A hollow circle means we lost track of them &mdash; they moved ' +
    'away, or the study ended &mdash; and all we know is that they were alive up to that point.'
  );

  const chart = h('div', { class: 'v-chart', role: 'img', 'aria-label': '' });
  const explain = h('div', { class: 'v-callout' });

  const next = h('button', { class: 'v-btn v-btn-primary', type: 'button',
    onclick: () => { step = Math.min(DEMO.length, step + 1); render(); } }, 'Next year');
  const back = h('button', { class: 'v-btn', type: 'button',
    onclick: () => { step = Math.max(0, step - 1); render(); } }, 'Back');
  const reset = h('button', { class: 'v-btn', type: 'button',
    onclick: () => { step = 0; render(); } }, 'Start again');

  box.body.appendChild(chart);
  box.body.appendChild(h('p', { class: 'v-scroll-hint' }, 'Swipe the chart sideways to see all of it.'));
  box.body.appendChild(h('div', { class: 'v-controls' }, next, back, reset));
  box.body.appendChild(explain);
  mount.appendChild(box);
  onFirstView(box, render);

  /* The Kaplan-Meier estimate: at each death, multiply the running survival by
     the fraction of those still being followed who got through it. People we
     lost track of leave the count without ever pulling the curve down. */
  function curve(upTo) {
    let atRisk = DEMO.length;
    let s = 1;
    const pts = [[0, 1]];
    for (let i = 0; i < upTo; i++) {
      const p = DEMO[i];
      if (p.event) {
        s *= (atRisk - 1) / atRisk;
        pts.push([p.t, s]);
      }
      atRisk -= 1;
    }
    return { pts, s, atRisk };
  }

  function render() {
    const { pts, s, atRisk } = curve(step);
    const PW = DW - DM.left - DM.right;
    const PH = DH - DM.top - DM.bottom;
    const x = scaleLinear(0, 10, 0, PW);
    const y = scaleLinear(0, 1, PH, 0);

    const root = svg(DW, DH);
    const plot = group(DM.left, DM.top);

    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      add(plot,
        el('line', { x1: 0, y1: y(v), x2: PW, y2: y(v), class: 'v-grid-line' }),
        el('text', { x: -10, y: y(v) + 4, 'text-anchor': 'end', class: 'v-label-sm' }, `${v * 100}%`)
      );
    });
    add(plot, el('line', { x1: 0, y1: PH, x2: PW, y2: PH, class: 'v-axis-line' }));
    for (let t = 0; t <= 10; t += 2) {
      add(plot, el('text', { x: x(t), y: PH + 18, 'text-anchor': 'middle', class: 'v-label-sm' }, String(t)));
    }
    add(plot, el('text', { x: PW / 2, y: PH + 40, 'text-anchor': 'middle', class: 'v-label-strong' }, 'Years'));

    // The curve so far.
    const px = pts.map((p) => [x(p[0]), y(p[1])]);
    px.push([x(step ? DEMO[step - 1].t : 0), y(s)]);
    add(plot, el('path', { d: stepLine(px), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2.5 }));

    // Markers for what happened, and when.
    DEMO.slice(0, step).forEach((p) => {
      const cx = x(p.t);
      if (p.event) {
        add(plot, el('path', {
          d: `M${cx - 5},${PH + 6} L${cx + 5},${PH + 16} M${cx + 5},${PH + 6} L${cx - 5},${PH + 16}`,
          stroke: 'var(--v-risk)', 'stroke-width': 2,
        }));
      } else {
        add(plot, el('circle', {
          cx, cy: PH + 11, r: 4.5, fill: 'none', stroke: 'var(--v-neutral)', 'stroke-width': 2,
        }));
      }
    });

    // Running numbers.
    const stats = group(PW + 20, 10);
    add(stats,
      el('text', { x: 0, y: 0, class: 'v-label-strong' }, 'Still followed'),
      el('text', { x: 0, y: 22, class: 'v-label-strong', style: 'font-size:22px', fill: 'var(--secondary-color)' }, String(atRisk)),
      el('text', { x: 0, y: 54, class: 'v-label-strong' }, 'Survival'),
      el('text', { x: 0, y: 76, class: 'v-label-strong', style: 'font-size:22px', fill: 'var(--v-safe)' }, `${Math.round(s * 100)}%`)
    );
    add(plot, stats);

    add(root, plot);
    chart.innerHTML = '';
    chart.appendChild(root);
    chart.setAttribute('aria-label',
      `A step chart of survival for ten people over ten years. After year ${step}, ` +
      `${atRisk} are still being followed and the estimated survival is ${Math.round(s * 100)} per cent.`);

    next.disabled = step >= DEMO.length;
    back.disabled = step === 0;

    const last = step ? DEMO[step - 1] : null;
    explain.innerHTML = !last
      ? '<span class="v-callout-head">Year 0</span>Everybody is alive, so the curve starts at 100%.'
      : last.event
        ? `<span class="v-callout-head">Year ${last.t} &mdash; a death</span>` +
          `Someone died, so the line drops. Notice the drop gets <strong>bigger</strong> each time, ` +
          `even though it is always one person: with fewer people left, one death is a larger share of them. ` +
          `That is why the right-hand end of any survival curve is the least trustworthy part.`
        : `<span class="v-callout-head">Year ${last.t} &mdash; someone left the study</span>` +
          `We lost track of this person while they were still alive. The line does <strong>not</strong> drop &mdash; ` +
          `nothing bad happened. They simply stop counting towards the total from here on. ` +
          `This is called <em>censoring</em>, and handling it properly is the entire reason this kind of chart exists.`;
  }
}

/* ===========================================================================
   B. The paper's curves
   ======================================================================== */

const W = 780, H = 400;
const M = { top: 26, right: 140, bottom: 60, left: 56 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

export function kmCurves(mount) {
  let groupKey = 'normal';
  let year = 10;

  const box = card(
    'Survival over fourteen years, by fitness',
    'Drag the year',
    'The same chart, drawn from the study. The three lines are the men who managed less than ' +
    '5 METs, 5 to 8 METs, and more than 8 METs. Drag the cursor to read off any year.',
    true
  );

  const tog = toggle(
    [{ value: 'normal', label: 'Healthy men' }, { value: 'cvd', label: 'Men with heart disease' }],
    groupKey,
    (v) => { groupKey = v; render(true); },
    'Choose which group of men to show'
  );

  const out = readout([
    { value: '', label: 'More than 8 METs' },
    { value: '', label: '5 to 8 METs' },
    { value: '', label: 'Less than 5 METs' },
    { value: '', label: 'Gap, fittest to least fit' },
  ]);

  const fig = figure({
    label: '',
    caption:
      'Built from Figure 3 (panels A and C) of Myers et al. (2002). Survival percentages are read ' +
      'from the published curves and are approximate; the paper reports P&nbsp;&lt;&nbsp;0.001 for the ' +
      'difference between the lines, without naming the test used.',
    onReplay: () => render(true),
    onReset: () => { groupKey = 'normal'; yearSlider.set(10); tog.select('normal'); render(true); },
  });

  const yearSlider = slider({
    label: 'Years after the treadmill test',
    min: 1, max: FIGURE3.xMax - 1, step: 0.5, value: year,
    format: (v) => `${v} years`,
    onInput: (v) => { year = v; render(false); },
  });

  const caveat = h('div', { class: 'v-callout v-callout-warn' });

  box.body.appendChild(h('div', { class: 'v-controls' }, tog));
  box.body.appendChild(fig.figure);
  box.body.appendChild(yearSlider);
  box.body.appendChild(out);
  box.body.appendChild(caveat);
  mount.appendChild(box);
  onFirstView(box, () => render(true));

  const COLOURS = { high: 'var(--v-safe)', mid: 'var(--v-neutral)', low: 'var(--v-risk)' };

  /** Linear interpolation between the control points read off the figure. */
  function surviving(stratum, t) {
    const p = stratum.pts;
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i][0]) {
        const [x0, y0] = p[i - 1], [x1, y1] = p[i];
        return y0 + ((t - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return p[p.length - 1][1];
  }

  function render(animate) {
    const g = FIGURE3[groupKey];
    const x = scaleLinear(0, FIGURE3.xMax, 0, PLOT_W);
    const y = scaleLinear(0, 100, PLOT_H, 0);

    const root = svg(W, H);
    const plot = group(M.left, M.top);

    [0, 25, 50, 75, 100].forEach((v) => {
      add(plot,
        el('line', { x1: 0, y1: y(v), x2: PLOT_W, y2: y(v), class: 'v-grid-line' }),
        el('text', { x: -10, y: y(v) + 4, 'text-anchor': 'end', class: 'v-label-sm' }, `${v}%`)
      );
    });
    add(plot, el('line', { x1: 0, y1: PLOT_H, x2: PLOT_W, y2: PLOT_H, class: 'v-axis-line' }));
    [0, 3.5, 7, 10.5, 14].forEach((t) => {
      add(plot,
        el('line', { x1: x(t), y1: PLOT_H, x2: x(t), y2: PLOT_H + 5, class: 'v-axis-line' }),
        el('text', { x: x(t), y: PLOT_H + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(t))
      );
    });
    add(plot, el('text', { x: PLOT_W / 2, y: PLOT_H + 42, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Years of follow-up'));
    add(plot, el('text', {
      x: -40, y: PLOT_H / 2, 'text-anchor': 'middle', class: 'v-label-strong',
      transform: `rotate(-90 ${-40} ${PLOT_H / 2})`,
    }, 'Percentage still alive'));

    g.strata.forEach((s, i) => {
      const px = s.pts.map((p) => [x(p[0]), y(p[1])]);
      const path = el('path', {
        d: stepLine(px), fill: 'none', stroke: COLOURS[s.key], 'stroke-width': 2.5,
        'stroke-linejoin': 'round',
      });
      add(plot, path);
      if (animate) drawIn(path, 900, i * 160);

      const last = s.pts[s.pts.length - 1];
      const lbl = group(x(last[0]) + 8, y(last[1]) + 4);
      add(lbl, el('text', { x: 0, y: 0, class: 'v-label-strong', fill: COLOURS[s.key] }, s.label));
      add(plot, lbl);
      if (animate) fadeIn(lbl, 300, 700 + i * 160);
    });

    // The time cursor.
    const cx = x(year);
    add(plot, el('line', {
      x1: cx, y1: 0, x2: cx, y2: PLOT_H,
      stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
    }));
    const vals = {};
    g.strata.forEach((s) => {
      const v = surviving(s, year);
      vals[s.key] = v;
      add(plot, el('circle', { cx, cy: y(v), r: 5, fill: COLOURS[s.key], stroke: '#fff', 'stroke-width': 2 }));
    });

    add(root, plot);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    const gap = Math.round(vals.high - vals.low);
    out.setAll([
      `${Math.round(vals.high)}%`,
      `${Math.round(vals.mid)}%`,
      `${Math.round(vals.low)}%`,
      `${gap} points`,
    ]);

    fig.setLabel(
      `Three survival curves for ${g.label.toLowerCase()} over fourteen years, grouped by exercise capacity. ` +
      `At ${year} years, about ${Math.round(vals.high)} per cent of the men above 8 METs are still alive, ` +
      `compared with ${Math.round(vals.mid)} per cent of those between 5 and 8 METs and ` +
      `${Math.round(vals.low)} per cent of those below 5 METs.`);

    fig.setTable({
      caption: `Approximate survival by fitness band, ${g.label}`,
      head: ['Years', ...g.strata.map((s) => s.label)],
      rows: [2, 4, 6, 8, 10, 12, 13].map((t) => [
        String(t), ...g.strata.map((s) => `${Math.round(surviving(s, t))}%`),
      ]),
    });

    caveat.innerHTML =
      '<span class="v-callout-head">One thing this paper did differently</span>' +
      'The worked example above showed censoring &mdash; the proper way to handle people you stop being ' +
      'able to follow. This study says plainly that it did not do it: &ldquo;' + STUDY.censoringNote + '&rdquo; ' +
      'Men who later had bypass surgery or a stent stayed in the count as though nothing had changed. ' +
      'It is a genuine limitation, and the authors put it in the paper themselves rather than leaving ' +
      'someone else to find it.';
  }

  return { render };
}
