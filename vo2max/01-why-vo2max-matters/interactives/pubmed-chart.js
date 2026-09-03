/*
 * pubmed-chart.js — how much the research world has been writing about this.
 *
 * Two lines, and a toggle that is the whole point of the chart.
 *
 * Raw publication counts climb relentlessly, which looks like an explosion of
 * interest. But PubMed itself grew from about 220,000 records a year in 1970
 * to nearly 1.9 million in 2025, so a lot of that climb is simply "more of
 * everything". Dividing by the size of the literature separates the two, and
 * the shape changes: the rise is real, large, and it stopped around 2015.
 *
 * That flattening is what makes the section's argument work — the science was
 * largely settled a decade before the public started paying attention.
 */

import { PUBMED_SERIES, PUBMED_META } from '../pubmed-data.js';
import { PAPER, VO2MAX } from '../data.js';
import { figure, toggle, card, legend, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisLeft, axisTitle, line, ticks, round, drawIn, fadeIn, comma } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 780, H = 420;
const M = { top: 40, right: 150, bottom: 58, left: 62 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/*
 * The series is plotted from 1975, not from the start of the data.
 *
 * PubMed only began indexing abstracts consistently in 1975: fewer than 6% of
 * records before that carry one, against more than 40% from 1975 onwards. A
 * title-and-abstract search therefore finds almost nothing in the early
 * seventies, and plotting it produces a vertical cliff in 1975 that looks like
 * an explosion of scientific interest but is really MEDLINE changing what it
 * stored. The earlier years stay in the data table, flagged, so nothing is
 * hidden — they are simply not drawn.
 */
const PLOT_FROM = 1975;

const SERIES = [
  { key: 'vo2', label: `${VO2MAX} and cardiorespiratory fitness`, short: `${VO2MAX} / fitness`, plain: 'VO2max / fitness', colour: 'var(--v-safe)', swatch: 'safe' },
  { key: 'aerobic', label: '“aerobic capacity”', short: '“aerobic capacity”', plain: '“aerobic capacity”', colour: 'var(--v-risk)', swatch: 'risk' },
];

export function pubmedChart(mount) {
  let mode = 'share';   // 'share' | 'count'

  const box = card(
    `Papers per year, ${PLOT_FROM}\u2013${PUBMED_META.lastYear}`,
    'Try both views',
    'Every paper in PubMed whose title or abstract mentions these terms, counted by year.',
    true
  );

  const tog = toggle(
    [{ value: 'share', label: 'Share of all papers' }, { value: 'count', label: 'Number of papers' }],
    mode,
    (v) => { mode = v; render(true); },
    'Choose how to count the papers'
  );

  const fig = figure({
    label: '',
    caption:
      `Counted from PubMed on ${PUBMED_META.fetched} via the NCBI E-utilities API. ` +
      `Plotted from ${PLOT_FROM}, when PubMed began storing abstracts consistently, to ` +
      `${PUBMED_META.lastYear}, the last year that is fully indexed. Earlier years are in the table below.`,
    wide: true,
    onReplay: () => render(true),
    onReset: () => { mode = 'share'; tog.select('share'); render(true); },
  });


  box.body.appendChild(h('div', { class: 'v-controls' }, tog));
  box.body.appendChild(legend(SERIES.map((s) => ({ swatch: s.swatch, label: s.label }))));
  box.body.appendChild(fig.figure);
  mount.appendChild(box);
  onFirstView(box, () => render(true));

  const valueOf = (row, key) => mode === 'share'
    ? (row[key] * 10000) / row.total
    : row[key];

  function render(animate) {
    const rows = PUBMED_SERIES.filter((r) => r.year >= PLOT_FROM);
    const y0 = rows[0].year;
    const y1 = rows[rows.length - 1].year;
    const maxV = Math.max(...rows.flatMap((r) => SERIES.map((s) => valueOf(r, s.key))));

    const x = scaleLinear(y0, y1, 0, PLOT_W);
    const y = scaleLinear(0, maxV * 1.08, PLOT_H, 0);

    const root = svg(W, H);
    const plot = group(M.left, M.top);

    const tickVals = ticks(0, maxV * 1.08, 5);
    add(plot, axisLeft(y, 0, PLOT_W, tickVals,
      (v) => (mode === 'share' ? String(round(v, 1)) : comma(Math.round(v)))));
    add(plot, el('line', { x1: 0, y1: PLOT_H, x2: PLOT_W, y2: PLOT_H, class: 'v-axis-line' }));

    for (let yr = Math.ceil(y0 / 10) * 10; yr <= y1; yr += 10) {
      add(plot,
        el('line', { x1: x(yr), y1: PLOT_H, x2: x(yr), y2: PLOT_H + 5, class: 'v-axis-line' }),
        el('text', { x: x(yr), y: PLOT_H + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(yr))
      );
    }
    add(plot, el('text', { x: x(y0), y: PLOT_H + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(y0)));
    add(plot, el('text', { x: x(y1), y: PLOT_H + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(y1)));
    add(plot, el('text', { x: PLOT_W / 2, y: PLOT_H + 42, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Year of publication'));
    add(plot, axisTitle(
      mode === 'share' ? 'Papers per 10,000 published that year' : 'Papers published',
      -46, PLOT_H / 2, -90));

    // The paper this module is about, marked on the timeline. It lands while
    // the research curve is still climbing steeply.
    const px = x(PAPER.year);
    add(plot,
      el('line', {
        x1: px, y1: 0, x2: px, y2: PLOT_H,
        stroke: 'var(--secondary-color)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.55,
      }),
      el('text', { x: px, y: -20, 'text-anchor': 'middle', class: 'v-label-sm', fill: 'var(--secondary-color)' },
        'Myers et al.'),
      el('text', { x: px, y: -7, 'text-anchor': 'middle', class: 'v-label-sm', fill: 'var(--secondary-color)' },
        String(PAPER.year))
    );

    SERIES.forEach((s, i) => {
      const pts = rows.map((r) => [x(r.year), y(valueOf(r, s.key))]);
      const path = el('path', {
        d: line(pts), fill: 'none', stroke: s.colour, 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      });
      add(plot, path);
      if (animate) drawIn(path, 1100, i * 200);

      const last = pts[pts.length - 1];
      const lbl = group(last[0] + 10, last[1] + 4);
      add(lbl, el('text', { x: 0, y: 0, class: 'v-label-strong', fill: s.colour }, s.short));
      add(plot, lbl);
      if (animate) fadeIn(lbl, 300, 900 + i * 200);
    });

    add(root, plot);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    // Numbers used in the summary, computed rather than typed.
    const first = rows[0];
    const lastRow = rows[rows.length - 1];

    const fmt = (v) => (mode === 'share' ? round(v, 2).toFixed(2) : comma(Math.round(v)));

    fig.setLabel(
      `Line chart of PubMed publications per year from ${y0} to ${y1}, ` +
      (mode === 'share' ? 'as a share of all papers published that year. ' : 'as raw counts. ') +
      SERIES.map((s) => `${s.plain} rose from ${fmt(valueOf(first, s.key))} in ${y0} to ${fmt(valueOf(lastRow, s.key))} in ${y1}`).join('; ') +
      '. ' + (mode === 'share'
        ? `Both peaked in the 2010s and have been flat since.`
        : `Raw counts keep climbing, partly because PubMed itself grew.`));

    fig.setTable({
      caption: `PubMed publications per year, ${PUBMED_META.firstYear} to ${y1}`,
      head: ['Year', '"aerobic capacity"', `${VO2MAX} / fitness`, 'All PubMed papers', '"aerobic capacity" per 10,000', `${VO2MAX} / fitness per 10,000`, 'Plotted?'],
      rows: PUBMED_SERIES.map((r) => [
        String(r.year), comma(r.aerobic), comma(r.vo2), comma(r.total),
        round((r.aerobic * 10000) / r.total, 2).toFixed(2),
        round((r.vo2 * 10000) / r.total, 2).toFixed(2),
        r.year >= PLOT_FROM ? 'yes' : 'no — abstracts not yet indexed',
      ]),
    });

  }

  return { render };
}
