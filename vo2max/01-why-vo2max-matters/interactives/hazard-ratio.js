/*
 * hazard-ratio.js — three linked pieces that together explain Table 3.
 *
 *   A. What a hazard ratio is, using two crowds of a hundred people.
 *   B. The real Table 3, drawn as a forest plot on a log axis.
 *   C. Why "12% per MET" compounds rather than adds.
 *
 * Part B is where the paper's actual argument lives: among the healthy men,
 * only fitness and smoking have intervals that clear 1. Everything a check-up
 * normally measures sits astride it.
 */

import { TABLE3, PER_MET } from '../data.js';
import { figure, toggle, card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLog, round, fadeIn, growIn } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

/* ===========================================================================
   A. What a hazard ratio is
   ======================================================================== */

const BASE_EVENTS = 20;   // out of 100, in the comparison group
const COLS = 20, ROWS = 5, DOT = 13;

export function hazardIntuition(mount) {
  let hr = 0.84;

  const box = card(
    'A hazard ratio, using two hundred people',
    'Drag the slider',
    'A hazard ratio compares the rate at which something happens in two groups. ' +
    'Below, 20 out of the first 100 people die. The slider sets the hazard ratio, ' +
    'and the second hundred changes to match.'
  );

  const chart = h('div', { class: 'v-chart', role: 'img', 'aria-label': '' });
  const sentence = h('p', { class: 'v-callout' });

  const sld = slider({
    label: 'Hazard ratio',
    min: 0.4, max: 2, step: 0.01, value: hr,
    format: (v) => v.toFixed(2),
    onInput: (v) => { hr = v; render(); },
  });

  box.body.appendChild(chart);
  box.body.appendChild(h('p', { class: 'v-scroll-hint' }, 'Swipe the chart sideways to see all of it.'));
  box.body.appendChild(sld);
  box.body.appendChild(sentence);
  box.body.appendChild(h('div', { class: 'v-controls v-controls-end' },
    h('button', { class: 'v-btn', type: 'button', onclick: () => sld.set(0.84) }, 'Back to 0.84')
  ));
  mount.appendChild(box);
  onFirstView(box, render);

  function crowd(gx, gy, deaths, colour, title) {
    const g = group(gx, gy);
    add(g, el('text', { x: 0, y: -12, class: 'v-label-strong' }, title));
    for (let i = 0; i < 100; i++) {
      const isDead = i < deaths;
      add(g, el('circle', {
        cx: (i % COLS) * DOT + 5,
        cy: Math.floor(i / COLS) * DOT + 5,
        r: 4.4,
        fill: isDead ? colour : 'var(--border-color)',
      }));
    }
    return g;
  }

  function render() {
    const deaths = Math.round(BASE_EVENTS * hr);
    const root = svg(600, 130);
    add(root, crowd(10, 30, BASE_EVENTS, 'var(--v-neutral)', `Comparison group — ${BASE_EVENTS} of 100 die`));
    add(root, crowd(320, 30, deaths, hr <= 1 ? 'var(--v-safe)' : 'var(--v-risk)',
      `Other group — ${deaths} of 100 die`));
    chart.innerHTML = '';
    chart.appendChild(root);

    const pct = Math.round(Math.abs(1 - hr) * 100);
    const dir = hr < 1 ? 'lower' : hr > 1 ? 'higher' : 'the same as';
    chart.setAttribute('aria-label',
      `Two groups of a hundred dots. In the comparison group ${BASE_EVENTS} are marked as deaths. ` +
      `At a hazard ratio of ${hr.toFixed(2)}, ${deaths} of the other hundred are marked as deaths.`);

    sentence.innerHTML = hr === 1
      ? '<span class="v-callout-head">In words</span>A hazard ratio of <strong>1.00</strong> means no difference at all between the groups.'
      : `<span class="v-callout-head">In words</span>A hazard ratio of <strong>${hr.toFixed(2)}</strong> means the risk of dying ` +
        `at any given moment is <strong>${pct}% ${dir}</strong> than in the comparison group. ` +
        (hr < 1
          ? 'Below 1 is protective. The further below, the stronger.'
          : 'Above 1 is harmful. The further above, the stronger.');
  }
}

/* ===========================================================================
   B. Table 3 as a forest plot
   ======================================================================== */

const FW = 760;
const FM = { left: 250, right: 30, top: 40, bottom: 54 };
const ROW_H = 27;

export function hazardForest(mount) {
  let groupKey = 'normal';
  let selected = 0;

  const box = card(
    'Everything the study measured, side by side',
    'Tap any row',
    'Each row is one thing the researchers measured. The dot is its hazard ratio and the ' +
    'bar is the range the data are consistent with. The vertical line is 1 &mdash; no effect. ' +
    'A bar that crosses that line means this study could not tell that factor apart from nothing.',
    true
  );

  const tog = toggle(
    [{ value: 'normal', label: 'Healthy men' }, { value: 'cvd', label: 'Men with heart disease' }],
    groupKey,
    (v) => { groupKey = v; selected = 0; render(true); },
    'Choose which group of men to show'
  );

  const fig = figure({
    label: '',
    caption: 'Built from Table 3 of Myers et al. (2002). Drawn on a logarithmic scale, as forest plots conventionally are.',
    onReplay: () => render(true),
    onReset: () => { groupKey = 'normal'; selected = 0; tog.select('normal'); render(true); },
  });

  const detail = h('div', { class: 'v-callout' });

  box.body.appendChild(h('div', { class: 'v-controls' }, tog));
  box.body.appendChild(fig.figure);
  box.body.appendChild(detail);
  mount.appendChild(box);
  onFirstView(box, () => render(true));

  function render(animate) {
    const g = TABLE3[groupKey];
    const rows = g.rows;
    const H = FM.top + rows.length * ROW_H + FM.bottom;
    const PW = FW - FM.left - FM.right;

    const lo = Math.min(...rows.map((r) => r.lo)) * 0.92;
    const hi = Math.max(...rows.map((r) => r.hi)) * 1.08;
    const x = scaleLog(lo, hi, 0, PW);

    const root = svg(FW, H);
    const plot = group(FM.left, FM.top);

    // Axis: a few round ratios, plus 1.
    const marks = [0.5, 0.75, 1, 1.5, 2, 3].filter((v) => v >= lo && v <= hi);
    marks.forEach((v) => {
      add(plot,
        el('line', {
          x1: x(v), y1: -14, x2: x(v), y2: rows.length * ROW_H,
          stroke: v === 1 ? 'var(--secondary-color)' : 'var(--v-grid)',
          'stroke-width': v === 1 ? 1.5 : 1,
          'stroke-dasharray': v === 1 ? null : '2 3',
        }),
        el('text', { x: x(v), y: rows.length * ROW_H + 20, 'text-anchor': 'middle', class: 'v-label-sm' },
          v === 1 ? '1  no effect' : String(v))
      );
    });

    rows.forEach((r, i) => {
      const cy = i * ROW_H + ROW_H / 2;
      const crosses = r.lo <= 1 && r.hi >= 1;
      const colour = crosses ? 'var(--v-neutral)' : (r.hr < 1 ? 'var(--v-safe)' : 'var(--v-risk)');
      const isSel = i === selected;

      // Row hit area, so the whole line is tappable.
      const hit = el('rect', {
        x: -FM.left + 8, y: i * ROW_H, width: FW - 38, height: ROW_H,
        fill: isSel ? 'var(--background-alt)' : 'transparent',
        rx: 4, class: 'v-hit', tabindex: '0', role: 'button',
        'aria-label': `${r.name}: hazard ratio ${r.hr}, confidence interval ${r.lo} to ${r.hi}, p ${r.p}.`,
      });
      const pick = () => { selected = i; render(false); };
      hit.addEventListener('click', pick);
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      add(plot, hit);

      // Label column.
      add(plot,
        el('text', {
          x: -FM.left + 18, y: cy + 4, class: r.star ? 'v-label-strong' : null,
          'font-weight': r.star ? '700' : null,
        }, (r.star ? '★ ' : '') + r.name)
      );

      // Interval and point estimate.
      const bar = group(0, 0);
      add(bar,
        el('line', { x1: x(r.lo), y1: cy, x2: x(r.hi), y2: cy, stroke: colour, 'stroke-width': 2 }),
        el('line', { x1: x(r.lo), y1: cy - 4, x2: x(r.lo), y2: cy + 4, stroke: colour, 'stroke-width': 2 }),
        el('line', { x1: x(r.hi), y1: cy - 4, x2: x(r.hi), y2: cy + 4, stroke: colour, 'stroke-width': 2 }),
        el('circle', { cx: x(r.hr), cy, r: r.star ? 6 : 4.5, fill: colour })
      );
      add(plot, bar);
      if (animate) fadeIn(bar, 300, i * 45);
    });

    add(plot, el('text', { x: PW / 2, y: rows.length * ROW_H + 44, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Hazard ratio for death'));
    add(root, plot);
    add(root, el('text', { x: FM.left - 12, y: 22, 'text-anchor': 'end', class: 'v-label-sm' }, 'protective ←'));
    add(root, el('text', { x: FM.left + 12, y: 22, 'text-anchor': 'start', class: 'v-label-sm' }, '→ harmful'));

    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    const clear = rows.filter((r) => !(r.lo <= 1 && r.hi >= 1));
    fig.setLabel(
      `Forest plot of hazard ratios for death among ${g.label.toLowerCase()}. ` +
      `Of ${rows.length} factors measured, ${clear.length} have confidence intervals that do not include 1: ` +
      clear.map((r) => `${r.name} at ${r.hr}`).join(', ') + '. ' +
      'The rest cross the line of no effect.');

    fig.setTable({
      caption: `Table 3 of Myers et al. 2002, ${g.label}`,
      head: ['Factor', 'Measured as', 'Hazard ratio', '95% confidence interval', 'P value'],
      rows: rows.map((r) => [r.name, r.detail || '—', r.hr.toFixed(2), `${r.lo} to ${r.hi}`, r.p]),
      keyRow: 0,
    });

    const r = rows[selected];
    const crosses = r.lo <= 1 && r.hi >= 1;
    detail.innerHTML =
      `<span class="v-callout-head">${r.name}${r.detail ? ' &mdash; ' + r.detail : ''}</span>` +
      `<strong>Hazard ratio ${r.hr.toFixed(2)}</strong> (95% confidence interval ${r.lo} to ${r.hi}, p&nbsp;${r.p}). ` +
      r.plain +
      (crosses ? '' : ' Because the whole interval sits on one side of 1, this is a result the study can stand behind.');
  }
}

/* ===========================================================================
   C. Why 12% per MET compounds
   ======================================================================== */

export function hazardCompounding(mount) {
  let gain = 3;

  const box = card(
    'The most common mistake with this number',
    'Drag the slider',
    'The paper says every extra MET was worth a 12% improvement in survival. ' +
    'It is tempting to double that for two METs and triple it for three. That is wrong, ' +
    'and the difference gets large quickly.'
  );

  const out = readout([
    { value: '', label: 'METs gained' },
    { value: '', label: 'Risk multiplied by' },
    { value: '', label: 'Actual reduction in risk' },
    { value: '', label: 'If you wrongly added it up' },
  ]);

  const chart = h('div', { class: 'v-chart', role: 'img', 'aria-label': '' });

  const sld = slider({
    label: 'Improvement in fitness',
    min: 1, max: 10, step: 1, value: gain,
    format: (v) => `${v} MET${v === 1 ? '' : 's'}`,
    onInput: (v) => { gain = v; render(); },
  });

  const warn = h('div', { class: 'v-callout v-callout-warn' });

  box.body.appendChild(sld);
  box.body.appendChild(out);
  box.body.appendChild(chart);
  box.body.appendChild(h('p', { class: 'v-scroll-hint' }, 'Swipe the chart sideways to see all of it.'));
  box.body.appendChild(warn);
  box.body.appendChild(h('div', { class: 'v-controls v-controls-end' },
    h('button', { class: 'v-btn', type: 'button', onclick: () => sld.set(3) }, 'Reset')
  ));
  mount.appendChild(box);
  onFirstView(box, render);

  function render() {
    const hr = PER_MET.impliedHR;
    const multiplied = Math.pow(hr, gain);
    const realCut = (1 - multiplied) * 100;
    const naiveCut = PER_MET.improvementPct * gain;

    out.setAll([
      String(gain),
      multiplied.toFixed(3),
      `${Math.round(realCut)}%`,
      `${naiveCut}%`,
    ]);

    // Two bars: what actually happens versus the additive mistake.
    const W2 = 600, H2 = 130, left = 150, barW = W2 - left - 60;
    const root = svg(W2, H2);
    const scale = (pct) => (Math.min(pct, 100) / 100) * barW;

    const draw = (yy, pct, colour, label) => {
      const g = group(left, yy);
      add(g,
        el('rect', { x: 0, y: 0, width: barW, height: 22, rx: 4, fill: 'var(--background-alt)' }),
        el('rect', { x: 0, y: 0, width: scale(pct), height: 22, rx: 4, fill: colour }),
        el('text', { x: -12, y: 16, 'text-anchor': 'end', class: 'v-label-sm' }, label),
        el('text', { x: scale(pct) + 8, y: 16, class: 'v-label-strong' }, `${Math.round(pct)}%`)
      );
      return g;
    };

    add(root, draw(28, realCut, 'var(--v-safe)', 'What actually happens'));
    add(root, draw(74, naiveCut, 'var(--v-risk)', 'Adding 12% each time'));
    chart.innerHTML = '';
    chart.appendChild(root);
    chart.setAttribute('aria-label',
      `Two bars comparing a ${Math.round(realCut)} per cent reduction in risk, which is what compounding ` +
      `${gain} METs at 12 per cent each actually gives, with the ${naiveCut} per cent you would get by ` +
      `wrongly adding 12 per cent ${gain} times.`);

    warn.innerHTML =
      `<span class="v-callout-head">Why the two differ</span>` +
      `Each MET multiplies the risk by ${hr}, it does not subtract 12 percentage points. ` +
      `So ${gain} METs means ${hr} multiplied by itself ${gain} times &mdash; ` +
      `<strong>${hr}<sup>${gain}</sup> = ${multiplied.toFixed(3)}</strong>, a ${Math.round(realCut)}% reduction, ` +
      `not ${naiveCut}%. ` +
      (naiveCut >= 100
        ? 'Notice that simply adding it up passes 100%, which would mean nobody dies at all. That is how you know the additive version cannot be right.'
        : 'The gap widens with every MET you add.');
  }
}
