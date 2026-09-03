/*
 * trends-chart.js — how much the public has been searching for this.
 *
 * The counterpart to the PubMed chart. Where that one shows research interest
 * levelling off in the 2010s, this shows public interest doing the opposite,
 * and the gap between the two is the point of the section.
 *
 * Google publishes no Trends API, so the data is a manual CSV export converted
 * by vo2max/tools/convert-trends.py. Until that has been done the chart shows
 * a short panel explaining what is missing rather than an empty frame.
 */

import { TRENDS_SERIES, TRENDS_META } from '../trends-data.js';
import { PAPER } from '../data.js';
import { figure, card, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisLeft, axisTitle, line, ticks, round, drawIn, fadeIn } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 780, H = 400;
const M = { top: 40, right: 30, bottom: 58, left: 58 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** "2018-04" or "2018-04-15" -> fractional year, so the axis is even. */
function toYear(stamp) {
  const [y, m = '1', d = '1'] = stamp.split('-');
  return Number(y) + ((Number(m) - 1) + (Number(d) - 1) / 30.4) / 12;
}

export function trendsChart(mount) {
  const box = card(
    'What everyone else has been searching for',
    TRENDS_META.ready ? 'Google Trends' : 'Waiting on data',
    'How often people searched Google for this term, worldwide. The scale is ' +
    'Google&rsquo;s own: 100 is the busiest month in the window and everything else ' +
    'is measured against it.',
    true
  );
  mount.appendChild(box);

  if (!TRENDS_META.ready) {
    box.body.appendChild(placeholder());
    return;
  }

  const fig = figure({
    label: '',
    caption:
      `Google Trends, search term &ldquo;${TRENDS_META.term}&rdquo;, worldwide, ` +
      `${TRENDS_META.first} to ${TRENDS_META.last}. Exported ${TRENDS_META.converted}. ` +
      'Values are relative search interest, not numbers of searches.',
    wide: true,
    onReplay: () => render(true),
  });
  const note = h('div', { class: 'v-callout' });

  box.body.appendChild(fig.figure);
  box.body.appendChild(note);
  onFirstView(box, () => render(true));

  function render(animate) {
    const pts = TRENDS_SERIES.map(([stamp, v]) => ({ t: toYear(stamp), v, stamp }));
    const x0 = pts[0].t, x1 = pts[pts.length - 1].t;
    const x = scaleLinear(x0, x1, 0, PLOT_W);
    const y = scaleLinear(0, 100, PLOT_H, 0);

    const root = svg(W, H);
    const plot = group(M.left, M.top);

    add(plot, axisLeft(y, 0, PLOT_W, ticks(0, 100, 5), (v) => String(round(v, 0))));
    add(plot, el('line', { x1: 0, y1: PLOT_H, x2: PLOT_W, y2: PLOT_H, class: 'v-axis-line' }));

    // Tick spacing follows the span: a three-year export needs yearly labels,
    // a twenty-year one would be unreadable with them.
    const span = x1 - x0;
    const step = span > 24 ? 5 : span > 8 ? 2 : 1;
    for (let yr = Math.ceil(x0); yr <= x1; yr += step) {
      add(plot,
        el('line', { x1: x(yr), y1: PLOT_H, x2: x(yr), y2: PLOT_H + 5, class: 'v-axis-line' }),
        el('text', { x: x(yr), y: PLOT_H + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(yr))
      );
    }
    add(plot, el('text', { x: PLOT_W / 2, y: PLOT_H + 42, 'text-anchor': 'middle', class: 'v-label-strong' }, 'Year'));
    add(plot, axisTitle('Relative search interest', -44, PLOT_H / 2, -90));

    // Filled area, because this is a "look at the shape" chart rather than a
    // "read off a value" one.
    const px = pts.map((p) => [x(p.t), y(p.v)]);
    add(plot, el('path', {
      d: `${line(px)} L${PLOT_W},${PLOT_H} L0,${PLOT_H} Z`,
      fill: 'var(--v-safe)', opacity: 0.14,
    }));
    const path = el('path', {
      d: line(px), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    });
    add(plot, path);
    if (animate) drawIn(path, 1200);

    // The Myers paper, if it falls inside the window Trends covers.
    if (PAPER.year >= x0 && PAPER.year <= x1) {
      const mx = x(PAPER.year);
      add(plot,
        el('line', { x1: mx, y1: 0, x2: mx, y2: PLOT_H, stroke: 'var(--secondary-color)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.55 }),
        el('text', { x: mx, y: -8, 'text-anchor': 'middle', class: 'v-label-sm' }, `Myers et al. ${PAPER.year}`)
      );
    }

    // The peak, labelled, since it anchors the whole 0-100 scale.
    const peak = pts.reduce((a, b) => (b.v > a.v ? b : a));
    const peakG = group(0, 0);
    add(peakG,
      el('circle', { cx: x(peak.t), cy: y(peak.v), r: 5, fill: 'var(--v-safe)', stroke: '#fff', 'stroke-width': 2 }),
      el('text', {
        x: x(peak.t), y: y(peak.v) - 14,
        'text-anchor': x(peak.t) > PLOT_W - 80 ? 'end' : 'middle',
        class: 'v-label-strong',
      }, `busiest: ${peak.stamp}`)
    );
    add(plot, peakG);
    if (animate) fadeIn(peakG, 300, 1100);

    add(root, plot);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    // A like-for-like comparison of the first and last full years in the data.
    const yearAvg = (yr) => {
      const inYear = pts.filter((p) => Math.floor(p.t) === yr);
      return inYear.length ? inYear.reduce((a, b) => a + b.v, 0) / inYear.length : null;
    };
    const firstFull = Math.ceil(x0);
    const lastFull = Math.floor(x1) - (pts.filter((p) => Math.floor(p.t) === Math.floor(x1)).length < 6 ? 1 : 0);
    const a = yearAvg(firstFull), b = yearAvg(lastFull);
    const growth = a && b ? (b / a) : null;

    fig.setLabel(
      `Area chart of Google search interest in “${TRENDS_META.term}” worldwide from ` +
      `${TRENDS_META.first} to ${TRENDS_META.last}, on a 0 to 100 relative scale. ` +
      `Interest peaked in ${peak.stamp}` +
      (growth ? `, and averaged ${round(b, 0)} in ${lastFull} against ${round(a, 0)} in ${firstFull}.` : '.'));

    fig.setTable({
      caption: `Google Trends relative search interest in “${TRENDS_META.term}”`,
      head: [TRENDS_META.interval, 'Relative interest (0–100)'],
      rows: TRENDS_SERIES.map(([stamp, v]) => [stamp, String(v)]),
    });

    note.innerHTML =
      '<span class="v-callout-head">The other half of the story</span>' +
      (growth && growth > 1.5
        ? `Search interest averaged <strong>${round(a, 0)}</strong> in ${firstFull} and ` +
          `<strong>${round(b, 0)}</strong> in ${lastFull} &mdash; about <strong>${round(growth, 1)}×</strong> higher &mdash; ` +
          `and peaked in ${peak.stamp}. `
        : `Search interest peaked in ${peak.stamp}. `) +
      `<br><br><em>One caveat worth knowing: this is a 0–100 index of relative interest, not a count of ` +
      `searches. It shows the shape of public attention, not its size, and Google rescales it to whatever ` +
      `window you ask for.</em>`;
  }
}

/** Shown until a CSV has been exported and converted. */
function placeholder() {
  const wrap = h('div', { class: 'v-callout v-callout-warn' });
  wrap.innerHTML =
    '<span class="v-callout-head">This chart is waiting on one manual step</span>' +
    'Google publishes no Trends API, so the data has to be exported by hand. It takes about a minute:' +
    '<br><br>' +
    '<strong>1.</strong> Go to <a href="https://trends.google.com/trends/explore" target="_blank" rel="noopener">trends.google.com</a> ' +
    `and search for <strong>${TRENDS_META.term}</strong><br>` +
    '<strong>2.</strong> Set the region to <strong>Worldwide</strong> and the range to <strong>2004 – present</strong><br>' +
    '<strong>3.</strong> Download the CSV and save it as <code>vo2max/01-why-vo2max-matters/trends.csv</code><br>' +
    '<strong>4.</strong> Run <code>vo2max/tools/convert-trends.py</code>' +
    '<br><br>' +
    'The chart then appears here automatically, drawn in the site&rsquo;s own colours.';
  return wrap;
}
