/*
 * watch-vo2max.js — how a running watch gets a VO2max number without a mask.
 *
 * Three panels sharing one control, each rebuilding one step of the Firstbeat
 * method (the physiology engine behind Garmin's on-device estimate):
 *
 *   A. Heart rate vs running speed — the watch's raw material. A near-
 *      straight line, extrapolated past the effort actually run to an
 *      assumed maximum heart rate, reads off an estimated top speed. This
 *      rebuilds the concept in Firstbeat's own Figure 2.
 *   B. Oxygen uptake vs running speed — the physiological bridge. Nobody
 *      measured this; it comes from a standard published equation.
 *   C. Heart rate vs oxygen uptake — the payoff. Both A and B are close to
 *      straight lines against speed, so heart rate and oxygen uptake end up
 *      close to a straight line against each other. Extrapolate that to the
 *      same assumed maximum heart rate and a VO2max estimate falls out.
 *
 * All three panels share one geometry so their axes line up when stacked.
 * Oxygen uptake is shown as absolute L·min⁻¹, which needs a body mass — the
 * imagined runner's is in WATCH_RUN. Every number here is invented for
 * illustration; see WATCH_RUN in data.js for exactly how.
 */

import { WATCH_RUN, FIRSTBEAT, VO2MAX, UNIT_ABS, UNIT_REL } from '../data.js';
import { figure, card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisLeft, axisTitle, line, ticks, round } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const SPEED_MIN = 6, SPEED_MAX = 18;   // km/h
const HR_MIN = 100, HR_MAX = 225;      // bpm
const VO2_MIN = 0, VO2_MAX = 5;        // L·min⁻¹

// One geometry for all three panels, so the axes align when stacked.
const W = 760, H = 340;
const M = { top: 40, right: 24, bottom: 50, left: 52 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

/** Ordinary least-squares fit y = a + b*x. */
function linreg(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** ACSM level-running equation, relative (mL·kg⁻¹·min⁻¹). */
function acsmRel(speedKmh) {
  return WATCH_RUN.acsmCoefficient * ((speedKmh * 1000) / 60) + WATCH_RUN.acsmIntercept;
}
const toAbs = (rel) => (rel * WATCH_RUN.massKg) / 1000;   // → L·min⁻¹
const toRel = (abs) => (abs * 1000) / WATCH_RUN.massKg;   // → mL·kg⁻¹·min⁻¹

/* Shared axis furniture. */
function speedAxis(plot, x) {
  add(plot, el('line', { x1: 0, y1: PH, x2: PW, y2: PH, class: 'v-axis-line' }));
  for (let v = SPEED_MIN; v <= SPEED_MAX; v += 2) {
    add(plot,
      el('line', { x1: x(v), y1: PH, x2: x(v), y2: PH + 5, class: 'v-axis-line' }),
      el('text', { x: x(v), y: PH + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
    );
  }
  add(plot, el('text', { x: PW / 2, y: PH + 40, 'text-anchor': 'middle', class: 'v-label-strong' }, 'Running speed (km/h)'));
}
function hrAxisX(plot, x) {
  add(plot, el('line', { x1: 0, y1: PH, x2: PW, y2: PH, class: 'v-axis-line' }));
  for (let v = HR_MIN; v <= HR_MAX; v += 25) {
    add(plot,
      el('line', { x1: x(v), y1: PH, x2: x(v), y2: PH + 5, class: 'v-axis-line' }),
      el('text', { x: x(v), y: PH + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
    );
  }
  add(plot, el('text', { x: PW / 2, y: PH + 40, 'text-anchor': 'middle', class: 'v-label-strong' }, 'Heart rate (bpm)'));
}
const dashed = { stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' };

export function watchVo2max(mount) {
  let hrMax = WATCH_RUN.hrMaxDefault;

  const pts = WATCH_RUN.points;
  const speeds = pts.map((p) => p.speed);
  const hrs = pts.map((p) => p.hr);
  const vo2Abs = pts.map((p) => toAbs(p.vo2));
  const regHrSpeed = linreg(speeds, hrs);   // heart rate = a + b × speed
  const regHrVo2 = linreg(hrs, vo2Abs);     // uptake (L·min⁻¹) = a + b × heart rate
  const lo = speeds[0], hi = speeds[speeds.length - 1];
  const loHr = Math.min(...hrs), hiHr = Math.max(...hrs);

  const box = card('How your watch works this out', 'Illustrative data · drag the slider', null, true);

  const figA = figure({ label: '', caption:
    `Heart rate against running speed. In Firstbeat&rsquo;s words: &ldquo;${FIRSTBEAT.calculationQuote}&rdquo;` });
  const figB = figure({ label: '', caption:
    'Oxygen uptake at each speed, from a standard published equation &mdash; never measured.' });
  const figC = figure({ label: '', caption: 'Heart rate against oxygen uptake.' });

  const out = readout([
    { value: '', label: 'Estimated top speed' },
    { value: '', labelHtml: `Estimated ${VO2MAX}` },
  ]);
  const sentence = h('p', { class: 'v-card-sub', style: 'margin:0 0 1rem;text-align:center' });
  const hrSlider = slider({
    label: 'If your watch assumes your maximum heart rate is',
    min: WATCH_RUN.hrMaxMin, max: WATCH_RUN.hrMaxMax, step: 1, value: hrMax,
    format: (v) => `${v} bpm`,
    onInput: (v) => { hrMax = v; render(); },
  });
  const sensitivity = h('div', { class: 'v-callout v-callout-warn' });

  box.body.appendChild(figA.figure);
  box.body.appendChild(figB.figure);
  box.body.appendChild(figC.figure);
  box.body.appendChild(hrSlider);
  box.body.appendChild(out);
  box.body.appendChild(sentence);
  box.body.appendChild(h('div', { class: 'v-controls v-controls-end' },
    h('button', { class: 'v-btn', type: 'button', onclick: () => hrSlider.set(WATCH_RUN.hrMaxDefault) }, 'Reset')
  ));
  box.body.appendChild(sensitivity);
  mount.appendChild(box);
  onFirstView(box, render);

  function estimate(assumedMax) {
    const maxSpeed = (assumedMax - regHrSpeed.a) / regHrSpeed.b;
    return {
      maxSpeed,
      viaSpeed: toAbs(acsmRel(maxSpeed)),              // Panel B's route
      vo2max: regHrVo2.a + regHrVo2.b * assumedMax,    // Panel C's route — the headline
    };
  }

  function render() {
    const est = estimate(hrMax);
    renderA(est); renderB(est); renderC(est);

    out.setAll([`${est.maxSpeed.toFixed(1)} km/h`, `${est.vo2max.toFixed(2)} ${UNIT_ABS}`]);
    sentence.innerHTML =
      `Assume a maximum of <strong>${hrMax} bpm</strong>: top speed about <strong>${est.maxSpeed.toFixed(1)} km/h</strong>, ` +
      `${VO2MAX} about <strong>${est.vo2max.toFixed(2)} ${UNIT_ABS}</strong> &mdash; ` +
      `${toRel(est.vo2max).toFixed(1)} ${UNIT_REL} at ${WATCH_RUN.massKg} kg, the figure a watch would show.` +
      `<span class="v-caption" style="display:block;margin-top:0.4rem">Panel B: ${est.viaSpeed.toFixed(2)} via top speed ` +
      `&middot; Panel C: ${est.vo2max.toFixed(2)} direct &mdash; the headline uses C.</span>`;

    const low = estimate(hrMax - 15).vo2max, high = estimate(hrMax + 15).vo2max;
    const pct = (v) => `${v >= est.vo2max ? '+' : '−'}${Math.abs(round(((v - est.vo2max) / est.vo2max) * 100, 0))}%`;
    sensitivity.innerHTML =
      '<span class="v-callout-head">The whole estimate leans on one guess</span>' +
      `${hrMax - 15} bpm &rarr; <strong>${low.toFixed(2)}</strong> (${pct(low)}) &nbsp;&middot;&nbsp; ` +
      `${hrMax + 15} bpm &rarr; <strong>${high.toFixed(2)}</strong> (${pct(high)}) &nbsp;${UNIT_ABS}`;
  }

  function renderA(est) {
    const x = scaleLinear(SPEED_MIN, SPEED_MAX, 0, PW);
    const y = scaleLinear(HR_MIN, HR_MAX, PH, 0);
    const root = svg(W, H), plot = group(M.left, M.top);
    add(plot, axisLeft(y, 0, PW, ticks(HR_MIN, HR_MAX, 5), (v) => String(Math.round(v))));
    speedAxis(plot, x);
    add(plot, axisTitle('Heart rate (bpm)', -40, PH / 2, -90));

    const hy = y(hrMax), ex = x(est.maxSpeed);
    add(plot,
      el('line', { x1: 0, y1: hy, x2: PW, y2: hy, ...dashed }),
      el('text', { x: PW, y: hy - 8, 'text-anchor': 'end', class: 'v-label-sm' }, `assumed max: ${hrMax} bpm`)
    );
    const at = (v) => y(regHrSpeed.a + regHrSpeed.b * v);
    add(plot,
      el('path', { d: line([[x(lo), at(lo)], [x(hi), at(hi)]]), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2.5 }),
      el('path', { d: line([[x(hi), at(hi)], [ex, hy]]), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2, 'stroke-dasharray': '6 4' })
    );
    pts.forEach((p) => add(plot, el('circle', { cx: x(p.speed), cy: y(p.hr), r: 5, fill: 'var(--v-safe)', stroke: '#fff', 'stroke-width': 1.5 })));
    add(plot,
      el('line', { x1: ex, y1: hy, x2: ex, y2: PH, ...dashed }),
      el('circle', { cx: ex, cy: hy, r: 5, fill: 'var(--secondary-color)' }),
      el('text', { x: ex, y: -18, 'text-anchor': 'middle', class: 'v-label-strong' }, `${est.maxSpeed.toFixed(1)} km/h`)
    );
    add(root, plot);
    figA.chart.innerHTML = ''; figA.chart.appendChild(root);
    figA.setLabel(`Heart rate against running speed for ${pts.length} points from an imagined run, ${lo} to ${hi} kilometres per hour. ` +
      `A fitted line extrapolated to an assumed maximum heart rate of ${hrMax} beats per minute reads off an estimated top speed of ${est.maxSpeed.toFixed(1)} kilometres per hour.`);
    figA.setTable({ caption: 'Panel A data (illustrative)', head: ['Running speed (km/h)', 'Heart rate (bpm)'],
      rows: pts.map((p) => [String(p.speed), String(p.hr)]) });
  }

  function renderB(est) {
    const x = scaleLinear(SPEED_MIN, SPEED_MAX, 0, PW);
    const y = scaleLinear(VO2_MIN, VO2_MAX, PH, 0);
    const root = svg(W, H), plot = group(M.left, M.top);
    add(plot, axisLeft(y, 0, PW, ticks(VO2_MIN, VO2_MAX, 5), (v) => String(Math.round(v))));
    speedAxis(plot, x);
    add(plot, axisTitle(`Oxygen uptake (${UNIT_ABS})`, -40, PH / 2, -90));

    // The equation itself, only where it applies: solid across the speeds
    // actually run, dashed beyond, nothing down at walking pace.
    const at = (v) => y(toAbs(acsmRel(v)));
    add(plot,
      el('path', { d: line([[x(lo), at(lo)], [x(hi), at(hi)]]), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2, opacity: 0.55 }),
      el('path', { d: line([[x(hi), at(hi)], [x(SPEED_MAX), at(SPEED_MAX)]]), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2, opacity: 0.55, 'stroke-dasharray': '6 4' })
    );
    pts.forEach((p) => add(plot, el('circle', { cx: x(p.speed), cy: y(toAbs(p.vo2)), r: 5, fill: 'var(--v-risk)', stroke: '#fff', 'stroke-width': 1.5 })));
    const mx = x(est.maxSpeed), my = y(est.viaSpeed);
    add(plot,
      el('line', { x1: mx, y1: my, x2: mx, y2: PH, ...dashed }),
      el('line', { x1: mx, y1: my, x2: PW, y2: my, ...dashed }),
      el('circle', { cx: mx, cy: my, r: 5, fill: 'var(--secondary-color)' }),
      el('text', { x: mx, y: -18, 'text-anchor': 'middle', class: 'v-label-strong' }, `${est.viaSpeed.toFixed(2)} ${UNIT_ABS}`)
    );
    add(root, plot);
    figB.chart.innerHTML = ''; figB.chart.appendChild(root);
    figB.setLabel(`Oxygen uptake against running speed, from the standard ACSM running equation for a ${WATCH_RUN.massKg} kilogram runner, not measurement. ` +
      `At the estimated top speed of ${est.maxSpeed.toFixed(1)} kilometres per hour it predicts ${est.viaSpeed.toFixed(2)} litres per minute.`);
    figB.setTable({ caption: 'Panel B data (illustrative, from the ACSM equation)',
      head: ['Running speed (km/h)', `Oxygen uptake (${UNIT_ABS})`, `Oxygen uptake (${UNIT_REL})`],
      rows: pts.map((p) => [String(p.speed), toAbs(p.vo2).toFixed(2), p.vo2.toFixed(1)]) });
  }

  function renderC(est) {
    const x = scaleLinear(HR_MIN, HR_MAX, 0, PW);
    const y = scaleLinear(VO2_MIN, VO2_MAX, PH, 0);
    const root = svg(W, H), plot = group(M.left, M.top);
    add(plot, axisLeft(y, 0, PW, ticks(VO2_MIN, VO2_MAX, 5), (v) => String(Math.round(v))));
    hrAxisX(plot, x);
    add(plot, axisTitle(`Oxygen uptake (${UNIT_ABS})`, -40, PH / 2, -90));

    const at = (v) => y(regHrVo2.a + regHrVo2.b * v);
    const ex = x(hrMax), ey = y(est.vo2max);
    add(plot,
      el('path', { d: line([[x(loHr), at(loHr)], [x(hiHr), at(hiHr)]]), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2.5 }),
      el('path', { d: line([[x(hiHr), at(hiHr)], [ex, ey]]), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2, 'stroke-dasharray': '6 4' })
    );
    pts.forEach((p) => add(plot, el('circle', { cx: x(p.hr), cy: y(toAbs(p.vo2)), r: 5, fill: 'var(--v-risk)', stroke: '#fff', 'stroke-width': 1.5 })));
    add(plot,
      el('line', { x1: ex, y1: ey, x2: ex, y2: PH, ...dashed }),
      el('line', { x1: ex, y1: ey, x2: PW, y2: ey, ...dashed }),
      el('circle', { cx: ex, cy: ey, r: 6, fill: 'var(--secondary-color)' }),
      el('text', { x: ex, y: -18, 'text-anchor': 'middle', class: 'v-label-strong' }, `${VO2MAX} ≈ ${est.vo2max.toFixed(2)}`)
    );
    add(root, plot);
    figC.chart.innerHTML = ''; figC.chart.appendChild(root);
    figC.setLabel(`Heart rate against oxygen uptake. The points fall close to a straight line; extrapolated to an assumed maximum heart rate of ${hrMax} beats per minute ` +
      `it reads off an estimated VO2max of ${est.vo2max.toFixed(2)} litres per minute.`);
    figC.setTable({ caption: 'Panel C data (illustrative)', head: ['Heart rate (bpm)', `Oxygen uptake (${UNIT_ABS})`],
      rows: pts.map((p) => [String(p.hr), toAbs(p.vo2).toFixed(2)]) });
  }
}
