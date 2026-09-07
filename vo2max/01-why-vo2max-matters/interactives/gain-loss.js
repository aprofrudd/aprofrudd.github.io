/*
 * gain-loss.js — can it be trained, and can it be lost?
 *
 * Four scenarios, one card. Each is drawn in the unit its paper reports —
 * HERITAGE gives a change in L·min⁻¹, Coyle gives percentages, McGuire
 * gives litres and a printed percentage, and the bed-rest fall is not on
 * the page until the Saltin paper has been read (the McGuire abstract only
 * says it exceeded the fall of thirty years). A shared axis would have to
 * invent something, so there isn't one.
 */

import { HERITAGE, DETRAINING, AGEING, BEDREST, SOURCES, VO2MAX, UNIT_ABS, UNIT_REL } from '../data.js';
import { refLink, refLabel } from '../cite.js';
import { figure, card, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisLeft, axisBottom, axisTitle, ticks, line, bar, drawIn, growIn, fadeIn, prefersReducedMotion } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const SCENARIOS = [HERITAGE, DETRAINING, AGEING, BEDREST];
const W = 760, H = 320;
const M = { top: 34, right: 40, bottom: 58, left: 64 };
const PW = W - M.left - M.right, PH = H - M.top - M.bottom;

export function gainLoss(mount) {
  let key = HERITAGE.key;

  const box = card('Four things that move it', 'Press a scenario', null, true);
  const btns = SCENARIOS.map((s) =>
    h('button', { class: 'v-btn', type: 'button', 'aria-pressed': 'false', onclick: () => { key = s.key; render(true); } }, s.label)
  );
  const fig = figure({ label: '', wide: true, caption: 'Choose a scenario.', onReplay: () => render(true) });
  const captionEl = fig.figure.querySelector('figcaption');
  const out = readout([
    { value: '', label: 'Change' },
    { value: '', label: 'Over' },
    { value: '', label: 'People studied' },
  ]);
  const quote = h('div', { class: 'v-callout', style: 'margin-top:1.25rem' });

  box.body.appendChild(h('div', { class: 'v-controls' }, ...btns));
  box.body.appendChild(fig.figure);
  box.body.appendChild(out);
  box.body.appendChild(quote);
  mount.appendChild(box);
  onFirstView(box, () => render(true));

  function render(animate) {
    const s = SCENARIOS.find((x) => x.key === key);
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(SCENARIOS[i].key === key)));
    const root = svg(W, H);
    const plot = group(M.left, M.top);
    ({ train: drawHeritage, stop: drawCoyle, age: drawAgeing, bed: drawBedrest })[key](plot, animate);
    add(root, plot);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);
    const src = SOURCES[s.quoteSource || s.source];
    quote.innerHTML = `<span class="v-callout-head">${s.label} &mdash; in the paper&rsquo;s words</span>&ldquo;${s.quote}&rdquo; &mdash; ${refLink(s.quoteSource || s.source, refLabel(src))}`;
  }

  function drawHeritage(plot, animate) {
    const x = scaleLinear(HERITAGE.axis[0], HERITAGE.axis[1], 0, PW);
    const mid = PH / 2;
    add(plot, axisBottom(x, PH, ticks(HERITAGE.axis[0], HERITAGE.axis[1], 7), (v) => (v > 0 ? '+' : '') + v.toFixed(1)));
    add(plot, axisTitle(`Change in ${VO2MAX} after ${HERITAGE.weeks} weeks (${UNIT_ABS})`, PW / 2, PH + 44));
    add(plot, el('line', { x1: x(0), y1: 0, x2: x(0), y2: PH, stroke: 'var(--v-neutral)', 'stroke-dasharray': '4 4' }));

    const b = el('rect', { x: x(0), y: mid - 26, width: x(HERITAGE.meanGainL) - x(0), height: 52, rx: 4, fill: 'var(--v-safe)' });
    add(plot, b);
    if (animate && !prefersReducedMotion()) {
      b.style.transformBox = 'fill-box';
      b.style.transformOrigin = 'left';
      b.style.transform = 'scaleX(0)';
      b.style.transition = 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)';
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transform = 'scaleX(1)'; }));
    }
    const notes = [
      el('text', { x: x(HERITAGE.meanGainL) + 8, y: mid + 5, class: 'v-label-strong' }, `average gain ≈ +${HERITAGE.meanGainL.toFixed(1)} ${UNIT_ABS}`),
      el('circle', { cx: x(HERITAGE.lowGainL), cy: mid + 62, r: 6, fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2 }),
      el('text', { x: x(HERITAGE.lowGainL), y: mid + 86, 'text-anchor': 'middle', class: 'v-label-sm' }, 'some: little or no gain'),
      el('path', { d: `M${x(HERITAGE.highGainL)},${mid + 62} l18,0 m-6,-6 l6,6 l-6,6`, stroke: 'var(--v-safe)', 'stroke-width': 2, fill: 'none' }),
      el('text', { x: x(HERITAGE.highGainL), y: mid + 86, 'text-anchor': 'middle', class: 'v-label-sm' }, `others: more than +${HERITAGE.highGainL.toFixed(1)}`),
      el('text', { x: PW / 2, y: -12, 'text-anchor': 'middle', class: 'v-label-sm' },
        `${HERITAGE.n} people in ${HERITAGE.families} families · heritability estimate ${HERITAGE.heritabilityPct}%`),
    ];
    add(plot, notes);
    if (animate) notes.forEach((n, i) => fadeIn(n, 300, 350 + i * 80));

    out.setAll([`≈ +${HERITAGE.meanGainL.toFixed(1)} ${UNIT_ABS}`, `${HERITAGE.weeks} weeks`, String(HERITAGE.n)]);
    captionEl.innerHTML = `The HERITAGE Family Study, ${refLink('bouchard1999')}: ${HERITAGE.n} sedentary adults trained for ${HERITAGE.weeks} weeks.`;
    fig.setLabel(`A horizontal bar showing an average gain of about ${HERITAGE.meanGainL} litres per minute after ${HERITAGE.weeks} weeks of training in ${HERITAGE.n} people, ` +
      `with markers for those who gained little or nothing and those who gained more than ${HERITAGE.highGainL} litre per minute. Heritability estimate ${HERITAGE.heritabilityPct} per cent.`);
    fig.setTable({ caption: 'HERITAGE, Bouchard et al. 1999 (abstract)', head: ['Measure', 'Value'], rows: [
      ['People', `${HERITAGE.n}, from ${HERITAGE.families} families`],
      ['Training', `${HERITAGE.weeks} weeks`],
      ['Average gain', `about +${HERITAGE.meanGainL.toFixed(1)} ${UNIT_ABS}`],
      ['Lowest', 'little or no gain'],
      ['Highest', `more than +${HERITAGE.highGainL.toFixed(1)} ${UNIT_ABS}`],
      ['Heritability estimate', `${HERITAGE.heritabilityPct}%`],
    ], keyRow: 2 });
  }

  function drawCoyle(plot, animate) {
    const last = DETRAINING.days[DETRAINING.days.length - 1];
    const x = scaleLinear(0, last, 0, PW);
    const y = scaleLinear(75, 105, PH, 0);
    add(plot, axisLeft(y, 0, PW, [80, 85, 90, 95, 100], (v) => `${v}%`));
    add(plot, axisBottom(x, PH, [0, ...DETRAINING.days]));
    add(plot, axisTitle('Days after stopping training', PW / 2, PH + 44));
    add(plot, axisTitle(`${VO2MAX}, % of the trained value`, -48, PH / 2, -90));
    add(plot, el('line', { x1: 0, y1: y(100), x2: PW, y2: y(100), stroke: 'var(--v-neutral)', 'stroke-dasharray': '4 4' }));

    const path = el('path', { d: line(DETRAINING.course.map(([d, p]) => [x(d), y(p)])), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2.5 });
    add(plot, path);
    if (animate) drawIn(path, 900);
    DETRAINING.course.slice(1).forEach(([d, p], i) => {
      const t = el('text', { x: x(d), y: y(p) - 12, 'text-anchor': 'middle', class: 'v-label-strong' }, `−${100 - p}%`);
      add(plot, el('circle', { cx: x(d), cy: y(p), r: 5, fill: 'var(--v-risk)', stroke: '#fff', 'stroke-width': 2 }), t);
      if (animate) fadeIn(t, 300, 400 + i * 200);
    });
    add(plot, el('text', { x: PW, y: y(DETRAINING.course[3][1]) + 24, 'text-anchor': 'end', class: 'v-label-sm' },
      `still ${DETRAINING.after84Rel} against ${DETRAINING.neverTrainedRel} ${UNIT_REL} in men who never trained`));

    out.setAll([`−${DETRAINING.fall21Pct}%, then −${DETRAINING.fall56Pct}%`, `${DETRAINING.days[1]} then ${DETRAINING.days[2]} days`, `${DETRAINING.n} (+ ${DETRAINING.controls} controls)`]);
    captionEl.innerHTML = `${refLink('coyle1984')}: ${DETRAINING.n} endurance-trained people stopped training and were measured at ${DETRAINING.days.join(', ')} days. No figure is given for day ${DETRAINING.days[0]}, so it is not plotted.`;
    fig.setLabel(`A line falling from 100 per cent to ${DETRAINING.course[1][1]} per cent at ${DETRAINING.days[1]} days and ${DETRAINING.course[2][1]} per cent at ${DETRAINING.days[2]} days, then flat to ${last} days. ` +
      `At ${last} days the ${DETRAINING.n} men still measured ${DETRAINING.after84Rel} against ${DETRAINING.neverTrainedRel} for ${DETRAINING.controls} men who never trained.`);
    fig.setTable({ caption: 'Coyle et al. 1984 (abstract)', head: ['Days after stopping', 'VO2max, % of trained value'],
      rows: DETRAINING.course.map(([d, p]) => [String(d), `${p}%${d ? ' (derived from the printed fall)' : ''}`])
        .concat([[`${last}, absolute`, `${DETRAINING.after84Rel} against ${DETRAINING.neverTrainedRel} ${UNIT_REL} never trained`]]), keyRow: 2 });
  }

  function drawAgeing(plot, animate) {
    const y = scaleLinear(0, AGEING.axisMax, PH, 0);
    const slots = [{ label: `1966, aged 20`, v: AGEING.before, rel: AGEING.beforeRel }, { label: `${AGEING.years} years later`, v: AGEING.after, rel: AGEING.afterRel }];
    const bw = 120, gap = 140;
    const x0 = PW / 2 - bw - gap / 2;
    add(plot, axisLeft(y, 0, PW, ticks(0, AGEING.axisMax, 4), (v) => v.toFixed(1)));
    add(plot, axisTitle(`${VO2MAX} (${UNIT_ABS})`, -48, PH / 2, -90));
    slots.forEach((s, i) => {
      const bxp = x0 + i * (bw + gap);
      const b = bar(bxp, y(s.v), bw, PH - y(s.v), 6);
      b.setAttribute('fill', i ? 'var(--v-risk)' : 'var(--v-safe)');
      add(plot, b);
      if (animate) growIn(b, 500, i * 150);
      add(plot,
        el('text', { x: bxp + bw / 2, y: y(s.v) - 10, 'text-anchor': 'middle', class: 'v-label-strong' }, `${s.v.toFixed(2)} ${UNIT_ABS}`),
        el('text', { x: bxp + bw / 2, y: PH + 20, 'text-anchor': 'middle', class: 'v-label-sm' }, s.label),
        el('text', { x: bxp + bw / 2, y: PH + 36, 'text-anchor': 'middle', class: 'v-label-sm' }, `${s.rel} ${UNIT_REL}`)
      );
    });
    const t = el('text', { x: PW / 2, y: y(AGEING.before) - 34, 'text-anchor': 'middle', class: 'v-label-strong', fill: 'var(--v-risk)' }, `−${AGEING.fallPct}% (as printed)`);
    add(plot, t);
    if (animate) fadeIn(t, 300, 600);

    out.setAll([`−${AGEING.fallPct}%`, `${AGEING.years} years`, String(AGEING.n)]);
    captionEl.innerHTML = `${refLink('mcguire2001')}: the five Dallas men, measured in 1966 and again ${AGEING.years} years later. The paper prints ${AGEING.fallPct}%, the mean of the individual changes.`;
    fig.setLabel(`Two bars: ${AGEING.before} litres per minute at age 20 and ${AGEING.after} thirty years later, a printed fall of ${AGEING.fallPct} per cent; ${AGEING.beforeRel} against ${AGEING.afterRel} millilitres per kilogram per minute.`);
    fig.setTable({ caption: 'McGuire et al. 2001 (abstract)', head: ['Measure', '1966, aged 20', `${AGEING.years} years later`], rows: [
      [`VO2max (${UNIT_ABS})`, AGEING.before.toFixed(2), AGEING.after.toFixed(2)],
      [`VO2max (${UNIT_REL})`, String(AGEING.beforeRel), String(AGEING.afterRel)],
      ['Change (as printed)', '', `−${AGEING.fallPct}%`],
    ], keyRow: 0 });
  }

  function drawBedrest(plot, animate) {
    const y = scaleLinear(0, AGEING.axisMax, PH, 0);
    const bw = 120, gap = 140;
    const x0 = PW / 2 - bw - gap / 2;
    add(plot, axisLeft(y, 0, PW, ticks(0, AGEING.axisMax, 4), (v) => v.toFixed(1)));
    add(plot, axisTitle(`${VO2MAX} (${UNIT_ABS})`, -48, PH / 2, -90));
    // The thirty-year fall, faintly, for scale.
    const ghost = bar(x0, y(AGEING.before), bw, PH - y(AGEING.before), 6);
    ghost.setAttribute('fill', 'var(--v-neutral)'); ghost.setAttribute('opacity', '0.35');
    add(plot, ghost,
      el('line', { x1: x0 - 8, y1: y(AGEING.after), x2: x0 + bw + 8, y2: y(AGEING.after), stroke: 'var(--v-neutral)', 'stroke-dasharray': '4 4' }),
      el('text', { x: x0 + bw / 2, y: PH + 20, 'text-anchor': 'middle', class: 'v-label-sm' }, `${AGEING.years} years of ageing`),
      el('text', { x: x0 + bw / 2, y: PH + 36, 'text-anchor': 'middle', class: 'v-label-sm' }, `−${AGEING.fallPct}%`));

    const bxp = x0 + bw + gap;
    const top = y(AGEING.before);
    if (BEDREST.fallPct == null) {
      // Known: the fall was bigger than the thirty-year fall. Unknown: by how much.
      const known = y(AGEING.before * (1 - BEDREST.exceedsPct / 100));
      add(plot,
        el('rect', { x: bxp, y: top, width: bw, height: known - top, fill: 'var(--v-risk)', opacity: 0.15, stroke: 'var(--v-risk)', 'stroke-width': 2, 'stroke-dasharray': '6 4', rx: 4 }),
        el('path', { d: `M${bxp + bw / 2},${known} L${bxp + bw / 2},${known + 46} m-8,-10 l8,10 l8,-10`, stroke: 'var(--v-risk)', 'stroke-width': 2, fill: 'none' }),
        el('text', { x: bxp + bw / 2, y: known + 70, 'text-anchor': 'middle', class: 'v-label-strong', fill: 'var(--v-risk)', style: 'font-size:22px' }, '?'),
        el('text', { x: bxp + bw / 2, y: top - 10, 'text-anchor': 'middle', class: 'v-label-strong', fill: 'var(--v-risk)' }, `more than −${BEDREST.exceedsPct}%`)
      );
    } else {
      const b = bar(bxp, y(AGEING.before * (1 - BEDREST.fallPct / 100)), bw, PH - y(AGEING.before * (1 - BEDREST.fallPct / 100)), 6);
      b.setAttribute('fill', 'var(--v-risk)');
      add(plot, b, el('text', { x: bxp + bw / 2, y: top - 10, 'text-anchor': 'middle', class: 'v-label-strong', fill: 'var(--v-risk)' }, `−${BEDREST.fallPct}%`));
      if (animate) growIn(b);
    }
    add(plot,
      el('text', { x: bxp + bw / 2, y: PH + 20, 'text-anchor': 'middle', class: 'v-label-sm' }, `${BEDREST.weeks} weeks in bed, aged 20`),
      el('text', { x: bxp + bw / 2, y: PH + 36, 'text-anchor': 'middle', class: 'v-label-sm' }, `the same men, ${BEDREST.year}`));

    const change = BEDREST.fallPct == null ? `more than −${BEDREST.exceedsPct}%` : `−${BEDREST.fallPct}%`;
    out.setAll([change, `${BEDREST.weeks} weeks`, String(BEDREST.n)]);
    captionEl.innerHTML = `${refLink('saltin1968')} put these same five men to bed for ${BEDREST.weeks} weeks in ${BEDREST.year}. ` +
      (BEDREST.fallPct == null
        ? `The exact fall is in that paper, which is not yet on this page; the ${refLink('mcguire2001', 'thirty-year follow-up')} says only that it was larger than the fall of thirty years.`
        : `The fall is from that paper.`);
    fig.setLabel(BEDREST.fallPct == null
      ? `A bar for the thirty-year fall of ${AGEING.fallPct} per cent beside an open-ended bar for three weeks of bed rest, whose fall was larger but is not yet quantified on this page.`
      : `Two bars: a thirty-year fall of ${AGEING.fallPct} per cent and a three-week bed-rest fall of ${BEDREST.fallPct} per cent.`);
    fig.setTable({ caption: 'Bed rest, from the McGuire et al. 2001 abstract', head: ['Scenario', 'Change', 'Over', 'People', 'Note'], rows: [
      [`${AGEING.years} years of ageing`, `−${AGEING.fallPct}%`, `${AGEING.years} years`, String(AGEING.n), 'as printed'],
      [`${BEDREST.weeks} weeks of bed rest`, change, `${BEDREST.weeks} weeks`, String(BEDREST.n), BEDREST.fallPct == null ? 'exact figure is in Saltin et al. 1968, not yet on the page' : 'from Saltin et al. 1968'],
    ], keyRow: 1 });
  }
}
