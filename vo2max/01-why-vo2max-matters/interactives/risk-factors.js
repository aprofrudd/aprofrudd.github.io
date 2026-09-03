/*
 * risk-factors.js — Figure 1 rebuilt.
 *
 * This is the figure that makes the paper's argument hardest to wriggle out of.
 * It does not compare fit people with unfit people in general. It takes only
 * the men who already have a given risk factor — only the diabetics, only the
 * smokers — and splits that group by fitness. The pattern survives every time.
 */

import { FIGURE1 } from '../data.js';
import { figure, card, legend, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, scaleBand, axisLeft, axisTitle, bar, ticks, round, growIn, fadeIn, comma } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 800, H = 430;
const M = { top: 30, right: 20, bottom: 78, left: 62 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

export function riskFactors(mount) {
  const box = card(
    'Fitness inside each risk group',
    'Every group tells the same story',
    'Six risk factors. Within each one, the men are split by how far they could walk. ' +
    'The men who managed more than 8 METs are the comparison, so their bar is always 1.',
    true
  );

  const fig = figure({
    label: '',
    wide: true,
    caption:
      'Built from Figure 1 of Myers et al. (2002). The paper prints the 95% confidence intervals ' +
      'on this figure but not the point estimates, so the bar heights here are read from the ' +
      'published artwork and are approximate. The intervals are exact.',
    onReplay: () => render(true),
  });

  const note = h('div', { class: 'v-callout' });

  box.body.appendChild(legend([
    { swatch: 'neutral', label: `More than 8 METs (${comma(FIGURE1.reference.n)} men) — the comparison` },
    { swatch: 'safe', label: `5 to 8 METs (${comma(FIGURE1.bands[0].n)} men)` },
    { swatch: 'risk', label: `Less than 5 METs (${comma(FIGURE1.bands[1].n)} men)` },
  ]));
  box.body.appendChild(fig.figure);
  box.body.appendChild(note);
  mount.appendChild(box);
  onFirstView(box, () => render(true));

  function render(animate) {
    const rows = FIGURE1.rows;
    const maxHi = Math.max(...rows.map((r) => Math.max(r.mid.hi, r.low.hi)));
    const yMax = maxHi * 1.1;
    const y = scaleLinear(0, yMax, PLOT_H, 0);
    const xg = scaleBand(rows.length, 0, PLOT_W, 0.26);
    const inner = xg.bandwidth / 3;

    const root = svg(W, H);
    const plot = group(M.left, M.top);

    add(plot, axisLeft(y, 0, PLOT_W, ticks(0, yMax, 5), (v) => String(round(v, 1))));
    add(plot, el('line', { x1: 0, y1: PLOT_H, x2: PLOT_W, y2: PLOT_H, class: 'v-axis-line' }));

    // The line of no difference, at the reference value of 1.
    add(plot, el('line', {
      x1: 0, y1: y(1), x2: PLOT_W, y2: y(1),
      stroke: 'var(--v-neutral)', 'stroke-width': 1, 'stroke-dasharray': '4 4',
    }));

    rows.forEach((r, i) => {
      const gx = xg(i);
      const series = [
        { rr: 1, lo: null, hi: null, colour: 'var(--v-neutral)' },
        { ...r.mid, colour: 'var(--v-safe)' },
        { ...r.low, colour: 'var(--v-risk)' },
      ];

      series.forEach((s, j) => {
        const bx = gx + j * inner + inner * 0.12;
        const bw = inner * 0.76;
        const by = y(s.rr);
        const shape = bar(bx, by, bw, PLOT_H - by, 3);
        shape.setAttribute('fill', s.colour);
        add(plot, shape);
        if (animate) growIn(shape, 480, i * 60 + j * 40);

        if (s.lo != null) {
          const cx = bx + bw / 2;
          const ci = group(0, 0);
          add(ci,
            el('line', { x1: cx, y1: y(s.hi), x2: cx, y2: y(s.lo), stroke: 'var(--secondary-color)', 'stroke-width': 1.2 }),
            el('line', { x1: cx - 4, y1: y(s.hi), x2: cx + 4, y2: y(s.hi), stroke: 'var(--secondary-color)', 'stroke-width': 1.2 }),
            el('line', { x1: cx - 4, y1: y(s.lo), x2: cx + 4, y2: y(s.lo), stroke: 'var(--secondary-color)', 'stroke-width': 1.2 })
          );
          add(plot, ci);
          if (animate) fadeIn(ci, 260, 380 + i * 60 + j * 40);
        }
      });

      // Risk-factor name under its group, wrapped onto two lines if needed.
      const words = r.name.split(' ');
      const lines = words.length > 2 ? [words.slice(0, -1).join(' '), words.slice(-1)[0]] : [r.name];
      lines.forEach((t, li) => {
        add(plot, el('text', {
          x: gx + xg.bandwidth / 2, y: PLOT_H + 20 + li * 14,
          'text-anchor': 'middle', class: 'v-label-sm',
        }, t));
      });
    });

    add(plot, axisTitle('How many times more likely to die', -46, PLOT_H / 2, -90));
    add(root, plot);
    add(root, el('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Each risk factor, split by fitness'));

    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    fig.setLabel(
      'Grouped bar chart. For each of six risk factors, men who managed more than 8 METs are the ' +
      'comparison at 1. ' +
      rows.map((r) => `Among men with ${r.name.toLowerCase()}, those under 5 METs were about ${r.low.rr} times as likely to die`).join('; ') +
      '.');

    fig.setTable({
      caption: 'Relative risk of death within each risk-factor group, by fitness band',
      head: ['Risk factor', 'More than 8 METs', '5 to 8 METs (95% CI)', 'Less than 5 METs (95% CI)'],
      rows: rows.map((r) => [
        r.name,
        '1 (comparison)',
        `${r.mid.rr} (${r.mid.lo} to ${r.mid.hi})`,
        `${r.low.rr} (${r.low.lo} to ${r.low.hi})`,
      ]),
    });

    note.innerHTML =
      '<span class="v-callout-head">What this figure rules out</span>' +
      'A reasonable objection to the whole study is that fit men are simply healthier men &mdash; ' +
      'that fitness is standing in for not having diabetes, not smoking, not being overweight. ' +
      'This figure answers it. Take only the men who <em>do</em> have each of those problems, and being ' +
      'unfit still roughly doubles the risk. In the authors’ words: &ldquo;' + FIGURE1.quote + '&rdquo;';
  }

  return { render };
}
