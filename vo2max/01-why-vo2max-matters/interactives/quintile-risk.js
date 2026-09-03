/*
 * quintile-risk.js — Figure 2 rebuilt.
 *
 * The paper splits each group into five equal-sized fitness bands and asks:
 * how much more likely were the men in each band to die than the fittest band?
 *
 * The interaction that does the teaching: you can MOVE the reference band.
 * "Relative risk" only means anything relative to something, and watching all
 * five numbers change while the picture stays the same shape is the fastest
 * way to see that.
 *
 * Honesty rule enforced here: the published confidence intervals apply only
 * to the paper's own comparison against quintile 5. Move the reference and we
 * hide them, and say why, rather than silently drawing numbers that are no
 * longer the paper's.
 */

import { FIGURE2 } from '../data.js';
import { figure, toggle, card, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, scaleBand, axisLeft, axisTitle, bar, ticks, round, growIn, fadeIn } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 760, H = 440;
const M = { top: 34, right: 24, bottom: 96, left: 62 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

export function quintileRisk(mount) {
  let groupKey = 'normal';
  let refIndex = 4;           // quintile 5 is the paper's own reference
  let drawn = false;

  const box = card(
    'Relative risk of death, by fitness',
    'Tap a bar to change the comparison',
    'The five bars split each group into equal fifths, least fit on the left. ' +
    'Every bar is drawn <em>relative</em> to one chosen band &mdash; the one marked ' +
    '&ldquo;compared with this&rdquo;. Tap a different bar to compare against that one instead ' +
    'and watch every number change.',
    true
  );

  const fig = figure({
    label: '',
    caption: 'Built from Figure 2 of Myers et al. (2002). MET ranges and confidence intervals are as printed in the paper.',
    onReplay: () => { drawn = false; render(true); },
    onReset: () => { refIndex = 4; groupKey = 'normal'; tog.select('normal'); drawn = false; render(true); },
  });

  const tog = toggle(
    [{ value: 'normal', label: 'Healthy men' }, { value: 'cvd', label: 'Men with heart disease' }],
    groupKey,
    (v) => { groupKey = v; refIndex = 4; drawn = false; render(true); },
    'Choose which group of men to show'
  );

  const note = h('p', { class: 'v-card-sub', style: 'margin:1.25rem 0 0' });

  const dashKey = h('span', { class: 'v-key', style: 'color:var(--text-light);font-size:0.85rem' },
    h('span', { 'aria-hidden': 'true', style: 'display:inline-block;width:22px;border-top:1px dashed var(--v-neutral)' }),
    'dashed line = same risk as the comparison band'
  );
  box.body.appendChild(h('div', { class: 'v-controls' }, tog, dashKey));
  box.body.appendChild(fig.figure);
  box.body.appendChild(note);
  mount.appendChild(box);

  onFirstView(box, () => render(true));

  function render(animate) {
    const g = FIGURE2[groupKey];
    const refRR = g.quintiles[refIndex].rr;
    const values = g.quintiles.map((q) => q.rr / refRR);
    const isPaperRef = refIndex === 4;

    // The scale has to clear the confidence-interval whiskers too, not just
    // the bar tops, or quintile 1's interval runs off the top of the plot.
    const ceiling = isPaperRef
      ? Math.max(...values, ...g.quintiles.map((q) => q.hi ?? 0))
      : Math.max(...values);
    const yMax = ceiling * 1.14;
    const y = scaleLinear(0, yMax, PLOT_H, 0);
    const x = scaleBand(5, 0, PLOT_W, 0.32);

    const root = svg(W, H);
    const plot = group(M.left, M.top);

    // Gridlines and y axis.
    const tickVals = ticks(0, yMax, 5);
    add(plot, axisLeft(y, 0, PLOT_W, tickVals, (v) => String(round(v, 2))));
    add(plot, el('line', { x1: 0, y1: PLOT_H, x2: PLOT_W, y2: PLOT_H, class: 'v-axis-line' }));

    // The line of "no difference" — only meaningful once, at 1.0.
    if (yMax > 1) {
      const y1 = y(1);
      add(plot,
        el('line', { x1: 0, y1, x2: PLOT_W, y2: y1, stroke: 'var(--v-neutral)', 'stroke-width': 1, 'stroke-dasharray': '4 4' })
      );
    }

    g.quintiles.forEach((q, i) => {
      const v = values[i];
      const isRef = i === refIndex;
      const bx = x(i);
      const bw = x.bandwidth;
      const by = y(v);
      const bh = PLOT_H - by;

      const fill = isRef ? 'var(--v-neutral)' : (v > 1 ? 'var(--v-risk)' : 'var(--v-safe)');

      const rect = bar(bx, by, bw, bh, 4);
      rect.setAttribute('fill', fill);
      rect.setAttribute('class', 'v-hit');
      rect.setAttribute('tabindex', '0');
      rect.setAttribute('role', 'button');
      rect.setAttribute('aria-label',
        `Fitness band ${q.q}, ${q.range}. Relative risk ${round(v, 2)}. Press to compare everything against this band.`);
      const pick = () => { refIndex = i; drawn = false; render(true); };
      rect.addEventListener('click', pick);
      rect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      add(plot, rect);
      if (animate) growIn(rect, 520, i * 70);

      // Confidence interval — only while the paper's own reference is in use.
      if (isPaperRef && q.lo != null && q.hi != null) {
        const cx = bx + bw / 2;
        const ciTop = y(q.hi);
        const ciBot = y(q.lo);
        const ci = group(0, 0);
        add(ci,
          el('line', { x1: cx, y1: ciTop, x2: cx, y2: ciBot, stroke: 'var(--secondary-color)', 'stroke-width': 1.5 }),
          el('line', { x1: cx - 6, y1: ciTop, x2: cx + 6, y2: ciTop, stroke: 'var(--secondary-color)', 'stroke-width': 1.5 }),
          el('line', { x1: cx - 6, y1: ciBot, x2: cx + 6, y2: ciBot, stroke: 'var(--secondary-color)', 'stroke-width': 1.5 })
        );
        add(plot, ci);
        if (animate) fadeIn(ci, 300, 400 + i * 70);
      }

      // Value above the bar.
      // The reference bar always sits at 1.00, which is exactly where the
      // dashed "no difference" line runs, so lift its label clear of it.
      const labelY = (isPaperRef && q.hi != null ? y(q.hi) : by) - (isRef ? 14 : 10);
      const valueText = el('text', {
        x: bx + bw / 2, y: labelY, 'text-anchor': 'middle', class: 'v-label-strong',
      }, isRef ? '1.00' : `${round(v, 2)}×`);
      add(plot, valueText);
      if (animate) fadeIn(valueText, 300, 300 + i * 70);

      // MET range and quintile number below the axis.
      add(plot,
        el('text', { x: bx + bw / 2, y: PLOT_H + 20, 'text-anchor': 'middle', class: 'v-label-strong' }, q.range),
        el('text', { x: bx + bw / 2, y: PLOT_H + 37, 'text-anchor': 'middle', class: 'v-label-sm' },
          i === 0 ? 'least fit fifth' : i === 4 ? 'fittest fifth' : `fifth ${q.q}`)
      );

      if (isRef) {
        add(plot, el('text', {
          x: bx + bw / 2, y: PLOT_H + 56, 'text-anchor': 'middle', class: 'v-label-sm',
          fill: 'var(--secondary-color)', 'font-weight': '600',
        }, 'compared with this'));
      }
    });

    add(plot, axisTitle(
      refIndex === 4 ? 'How many times more likely to die' : 'Risk, compared with the chosen band',
      -46, PLOT_H / 2, -90));
    add(root, plot);
    add(root, el('text', { x: W / 2, y: H - 12, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Fitness, split into five equal groups'));

    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    // Accessible summary and data table.
    const refLabel = g.quintiles[refIndex].range;
    fig.setLabel(
      `Bar chart of relative risk of death across five fitness bands in ${g.label.toLowerCase()}. ` +
      `Compared with the band at ${refLabel}, the values are ` +
      g.quintiles.map((q, i) => `${q.range}: ${round(values[i], 2)}`).join('; ') + '.'
    );

    fig.setTable({
      caption: `Relative risk of death by fitness band, ${g.label}`,
      head: ['Fitness band', 'Exercise capacity', 'Relative risk', isPaperRef ? '95% confidence interval' : 'Confidence interval'],
      rows: g.quintiles.map((q, i) => [
        i === 0 ? 'Least fit fifth' : i === 4 ? 'Fittest fifth' : `Fifth ${q.q}`,
        q.range,
        i === refIndex ? '1.00 (comparison)' : values[i].toFixed(2) + (q.printed ? '' : ' (read from the figure)'),
        isPaperRef ? (q.lo != null ? `${q.lo} to ${q.hi}` : '—') : 'not applicable',
      ]),
      keyRow: 0,
    });

    // The explanatory note changes with what the reader has done.
    if (isPaperRef) {
      const headline = FIGURE2.headline[groupKey];
      note.innerHTML =
        `This is the comparison the paper itself makes. The least fit fifth were <strong>${headline} times</strong> ` +
        `as likely to die as the fittest fifth. The black bars are 95% confidence intervals &mdash; the range of ` +
        `values the data are consistent with. ` +
        (groupKey === 'normal'
          ? 'Notice the fourth band: its interval runs from 0.7 to 2.2, which includes 1. This study could not tell that group apart from the fittest.'
          : 'Notice how evenly the bars step down here &mdash; among men with heart disease the fall in risk is close to a straight line.');
    } else {
      note.innerHTML =
        `You are now comparing every band with <strong>${refLabel}</strong>. The numbers all changed, but the ` +
        `picture did not: the ordering and the spacing are exactly the same. That is the point &mdash; a relative risk ` +
        `is a ratio, and it is meaningless until you say what it is relative to. ` +
        `<em>The confidence intervals are hidden here because the ones printed in the paper apply only to its own ` +
        `comparison against the fittest fifth.</em>`;
    }

    drawn = true;
  }

  return { render };
}
