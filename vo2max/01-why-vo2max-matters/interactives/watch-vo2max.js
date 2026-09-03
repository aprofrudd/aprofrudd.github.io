/*
 * watch-vo2max.js — how a running watch gets a VO2max number without a mask.
 *
 * Three panels sharing one control, each rebuilding one step of the Firstbeat
 * method (the physiology engine behind Garmin's on-device estimate):
 *
 *   A. Heart rate vs running speed — the watch's raw material. A near-
 *      straight line, extrapolated past the effort actually run to an
 *      assumed maximum heart rate, reads off an estimated top speed. This
 *      rebuilds the concept in Firstbeat's own Figure 2 (their right-hand
 *      panel: "Extrapolation to maximal heart rate").
 *   B. Oxygen cost vs running speed — the physiological bridge. Nobody
 *      measured this; it comes from a standard published equation for the
 *      oxygen cost of running.
 *   C. Heart rate vs oxygen cost — the payoff. Because both A and B are
 *      close to straight lines against speed, heart rate and oxygen cost end
 *      up close to a straight line against each other too. Extrapolate that
 *      line to the same assumed maximum heart rate and a VO2max estimate
 *      falls out, with no gas mask involved at any point.
 *
 * Every number on these three charts is invented for illustration — see
 * WATCH_RUN in data.js for exactly how. Nothing here is a measurement.
 */

import { WATCH_RUN, FIRSTBEAT } from '../data.js';
import { figure, card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisLeft, axisTitle, line, ticks, round } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const SPEED_MIN = 0, SPEED_MAX = 20;
const HR_MIN = 100, HR_MAX = 225;
const VO2_MIN = 0, VO2_MAX = 75;

const W = 760;
const MA = { top: 40, right: 24, bottom: 50, left: 52 };
const MB = { top: 34, right: 24, bottom: 50, left: 52 };
const MC = { top: 40, right: 24, bottom: 50, left: 52 };
const HA = 340, HB = 300, HC = 340;

const PWA = W - MA.left - MA.right, PHA = HA - MA.top - MA.bottom;
const PWB = W - MB.left - MB.right, PHB = HB - MB.top - MB.bottom;
const PWC = W - MC.left - MC.right, PHC = HC - MC.top - MC.bottom;

/** Ordinary least-squares fit y = a + b*x, plus r-squared. */
function linreg(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxy / sxx;
  const a = my - b * mx;
  const ssTot = ys.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = xs.reduce((s, x, i) => s + (ys[i] - (a + b * x)) ** 2, 0);
  return { a, b, r2: ssTot ? 1 - ssRes / ssTot : 1 };
}

/** The published ACSM equation for the oxygen cost of level running. */
function acsmVo2(speedKmh) {
  const speedMmin = (speedKmh * 1000) / 60;
  return WATCH_RUN.acsmCoefficient * speedMmin + WATCH_RUN.acsmIntercept;
}

export function watchVo2max(mount) {
  let hrMax = WATCH_RUN.hrMaxDefault;

  const pts = WATCH_RUN.points;
  const speeds = pts.map((p) => p.speed);
  const hrs = pts.map((p) => p.hr);
  const vo2s = pts.map((p) => p.vo2);
  const regHrSpeed = linreg(speeds, hrs);  // heart rate = a + b x speed
  const regHrVo2 = linreg(hrs, vo2s);      // VO2 = a + b x heart rate

  const box = card(
    'How your watch works this out',
    'Drag the slider',
    'Three charts built from one imagined training run, walking through the same steps a ' +
    'Firstbeat-powered watch takes while you run. The numbers are invented, but the method ' +
    'and the physiology behind it are real.',
    true
  );

  const figA = figure({
    label: '',
    caption:
      'Panel A &mdash; heart rate against running speed, the watch&rsquo;s raw material. In ' +
      `Firstbeat&rsquo;s words: &ldquo;${FIRSTBEAT.calculationQuote}&rdquo;`,
  });
  const figB = figure({
    label: '',
    caption: 'Panel B &mdash; the oxygen cost of running at each speed, from a standard published equation, never measured.',
  });
  const figC = figure({
    label: '',
    caption: 'Panel C &mdash; heart rate against oxygen cost, the relationship that makes the estimate possible.',
  });

  const out = readout([
    { value: '', label: 'Estimated top speed' },
    { value: '', label: 'Estimated VO2max' },
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
    const vo2AtMaxSpeed = acsmVo2(maxSpeed);
    const vo2max = regHrVo2.a + regHrVo2.b * assumedMax;
    return { maxSpeed, vo2AtMaxSpeed, vo2max };
  }

  function render() {
    const est = estimate(hrMax);
    renderPanelA(est);
    renderPanelB(est);
    renderPanelC(est);

    out.setAll([`${est.maxSpeed.toFixed(1)} km/h`, `${est.vo2max.toFixed(1)} mL/kg/min`]);
    const gap = Math.abs(est.vo2AtMaxSpeed - est.vo2max);
    sentence.innerHTML =
      `Assuming a maximum heart rate of <strong>${hrMax} bpm</strong>, this run&rsquo;s numbers ` +
      `extrapolate to a top speed of about <strong>${est.maxSpeed.toFixed(1)} km/h</strong> &mdash; and a ` +
      `VO&#8322;max of about <strong>${est.vo2max.toFixed(1)} mL/kg/min</strong>. ` +
      `<span class="v-caption" style="display:block;margin-top:0.5rem">Panel B reaches ` +
      `${est.vo2AtMaxSpeed.toFixed(1)} by way of the top speed; Panel C reaches ${est.vo2max.toFixed(1)} ` +
      `by fitting heart rate to oxygen cost directly. Two routes through the same data, ` +
      `${gap < 1 ? 'within a unit of each other' : gap.toFixed(1) + ' apart'} &mdash; the headline uses Panel C.</span>`;

    const lowEst = estimate(hrMax - 15).vo2max;
    const highEst = estimate(hrMax + 15).vo2max;
    const lowPct = ((lowEst - est.vo2max) / est.vo2max) * 100;
    const highPct = ((highEst - est.vo2max) / est.vo2max) * 100;
    sensitivity.innerHTML =
      '<span class="v-callout-head">The whole estimate leans on one guess</span>' +
      `Nobody in this example ran anywhere near their actual maximum &mdash; the watch has to assume ` +
      `one. In this data, guessing 15 beats too low (${hrMax - 15} bpm) would put the estimate at ` +
      `<strong>${lowEst.toFixed(1)}</strong> (${lowPct >= 0 ? '+' : ''}${round(lowPct, 0)}%); guessing 15 too high ` +
      `(${hrMax + 15} bpm) would put it at <strong>${highEst.toFixed(1)}</strong> ` +
      `(${highPct >= 0 ? '+' : ''}${round(highPct, 0)}%). Firstbeat report a similar order of error from ` +
      `their own real-world database: &ldquo;${FIRSTBEAT.hrMaxErrorQuote}&rdquo;`;
  }

  function renderPanelA(est) {
    const x = scaleLinear(SPEED_MIN, SPEED_MAX, 0, PWA);
    const y = scaleLinear(HR_MIN, HR_MAX, PHA, 0);
    const root = svg(W, HA);
    const plot = group(MA.left, MA.top);

    add(plot, axisLeft(y, 0, PWA, ticks(HR_MIN, HR_MAX, 5), (v) => String(Math.round(v))));
    add(plot, el('line', { x1: 0, y1: PHA, x2: PWA, y2: PHA, class: 'v-axis-line' }));
    for (let v = 0; v <= SPEED_MAX; v += 4) {
      add(plot,
        el('line', { x1: x(v), y1: PHA, x2: x(v), y2: PHA + 5, class: 'v-axis-line' }),
        el('text', { x: x(v), y: PHA + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
      );
    }
    add(plot, el('text', { x: PWA / 2, y: PHA + 40, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Running speed (km/h)'));
    add(plot, axisTitle('Heart rate (bpm)', -40, PHA / 2, -90));

    // Assumed maximum heart rate — the number the slider controls.
    const hy = y(hrMax);
    add(plot,
      el('line', { x1: 0, y1: hy, x2: PWA, y2: hy, stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),
      el('text', { x: PWA, y: hy - 8, 'text-anchor': 'end', class: 'v-label-sm' }, `assumed max: ${hrMax} bpm`)
    );

    // The fitted line: solid across the range actually run, dashed beyond it.
    const lo = speeds[0], hi = speeds[speeds.length - 1];
    const solid = [[x(lo), y(regHrSpeed.a + regHrSpeed.b * lo)], [x(hi), y(regHrSpeed.a + regHrSpeed.b * hi)]];
    const dashed = [[x(hi), y(regHrSpeed.a + regHrSpeed.b * hi)], [x(est.maxSpeed), hy]];
    add(plot,
      el('path', { d: line(solid), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2.5 }),
      el('path', { d: line(dashed), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2, 'stroke-dasharray': '6 4' })
    );

    pts.forEach((p) => add(plot,
      el('circle', { cx: x(p.speed), cy: y(p.hr), r: 5, fill: 'var(--v-safe)', stroke: '#fff', 'stroke-width': 1.5 })
    ));

    // Where the extrapolation lands.
    const ex = x(est.maxSpeed);
    add(plot,
      el('line', { x1: ex, y1: hy, x2: ex, y2: PHA, stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),
      el('circle', { cx: ex, cy: hy, r: 5, fill: 'var(--secondary-color)' }),
      el('text', { x: ex, y: -18, 'text-anchor': 'middle', class: 'v-label-strong' }, `${est.maxSpeed.toFixed(1)} km/h`)
    );

    add(root, plot);
    figA.chart.innerHTML = '';
    figA.chart.appendChild(root);
    figA.setLabel(
      `Scatter plot of heart rate against running speed for ${pts.length} points from an imagined run, ` +
      `speeds ${lo} to ${hi} kilometres per hour. A fitted line, extrapolated to an assumed maximum ` +
      `heart rate of ${hrMax} beats per minute, reads off an estimated top speed of ` +
      `${est.maxSpeed.toFixed(1)} kilometres per hour.`
    );
    figA.setTable({
      caption: 'Panel A data — heart rate against running speed (illustrative)',
      head: ['Running speed (km/h)', 'Heart rate (bpm)'],
      rows: pts.map((p) => [String(p.speed), String(p.hr)]),
    });
  }

  function renderPanelB(est) {
    const x = scaleLinear(SPEED_MIN, SPEED_MAX, 0, PWB);
    const y = scaleLinear(VO2_MIN, VO2_MAX, PHB, 0);
    const root = svg(W, HB);
    const plot = group(MB.left, MB.top);

    add(plot, axisLeft(y, 0, PWB, ticks(VO2_MIN, VO2_MAX, 5), (v) => String(Math.round(v))));
    add(plot, el('line', { x1: 0, y1: PHB, x2: PWB, y2: PHB, class: 'v-axis-line' }));
    for (let v = 0; v <= SPEED_MAX; v += 4) {
      add(plot,
        el('line', { x1: x(v), y1: PHB, x2: x(v), y2: PHB + 5, class: 'v-axis-line' }),
        el('text', { x: x(v), y: PHB + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
      );
    }
    add(plot, el('text', { x: PWB / 2, y: PHB + 40, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Running speed (km/h)'));
    add(plot, axisTitle('Oxygen cost (mL/kg/min)', -40, PHB / 2, -90));

    // The known physiological relationship. This line was never fitted to
    // data — it is the ACSM running equation itself — but it is only drawn
    // where that equation applies: solid across the speeds actually run,
    // dashed beyond them, and not at all down at walking pace, where the
    // oxygen cost follows a different slope.
    const lo = speeds[0], hi = speeds[speeds.length - 1];
    add(plot,
      el('path', {
        d: line([[x(lo), y(acsmVo2(lo))], [x(hi), y(acsmVo2(hi))]]),
        fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2, opacity: 0.55,
      }),
      el('path', {
        d: line([[x(hi), y(acsmVo2(hi))], [x(SPEED_MAX), y(acsmVo2(SPEED_MAX))]]),
        fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2, opacity: 0.55, 'stroke-dasharray': '6 4',
      })
    );

    pts.forEach((p) => add(plot,
      el('circle', { cx: x(p.speed), cy: y(p.vo2), r: 5, fill: 'var(--v-risk)', stroke: '#fff', 'stroke-width': 1.5 })
    ));

    // Carry the estimated top speed across from Panel A and read the oxygen
    // cost the equation predicts at that speed.
    const mx = x(est.maxSpeed);
    const my = y(est.vo2AtMaxSpeed);
    add(plot,
      el('line', { x1: mx, y1: my, x2: mx, y2: PHB, stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),
      el('line', { x1: mx, y1: my, x2: PWB, y2: my, stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),
      el('circle', { cx: mx, cy: my, r: 5, fill: 'var(--secondary-color)' }),
      el('text', { x: PWB, y: my - 8, 'text-anchor': 'end', class: 'v-label-strong' },
        `${est.vo2AtMaxSpeed.toFixed(1)} mL/kg/min`)
    );

    add(root, plot);
    figB.chart.innerHTML = '';
    figB.chart.appendChild(root);
    figB.setLabel(
      `Oxygen cost against running speed. The reference line comes from the standard ACSM running ` +
      `equation, not measurement. At the estimated top speed of ${est.maxSpeed.toFixed(1)} kilometres per ` +
      `hour, the equation predicts an oxygen cost of ${est.vo2AtMaxSpeed.toFixed(1)} millilitres per ` +
      `kilogram per minute.`
    );
    figB.setTable({
      caption: 'Panel B data — oxygen cost against running speed (illustrative, from the ACSM equation)',
      head: ['Running speed (km/h)', 'Oxygen cost (mL/kg/min)'],
      rows: pts.map((p) => [String(p.speed), p.vo2.toFixed(1)]),
    });
  }

  function renderPanelC(est) {
    const x = scaleLinear(HR_MIN, HR_MAX, 0, PWC);
    const y = scaleLinear(VO2_MIN, VO2_MAX, PHC, 0);
    const root = svg(W, HC);
    const plot = group(MC.left, MC.top);

    add(plot, axisLeft(y, 0, PWC, ticks(VO2_MIN, VO2_MAX, 5), (v) => String(Math.round(v))));
    add(plot, el('line', { x1: 0, y1: PHC, x2: PWC, y2: PHC, class: 'v-axis-line' }));
    for (let v = HR_MIN; v <= HR_MAX; v += 25) {
      add(plot,
        el('line', { x1: x(v), y1: PHC, x2: x(v), y2: PHC + 5, class: 'v-axis-line' }),
        el('text', { x: x(v), y: PHC + 19, 'text-anchor': 'middle', class: 'v-label-sm' }, String(v))
      );
    }
    add(plot, el('text', { x: PWC / 2, y: PHC + 40, 'text-anchor': 'middle', class: 'v-label-strong' },
      'Heart rate (bpm)'));
    add(plot, axisTitle('Oxygen cost (mL/kg/min)', -40, PHC / 2, -90));

    add(plot, el('text', { x: 6, y: 16, class: 'v-label-sm' }, `R² = ${round(regHrVo2.r2, 2)}`));

    const loHr = hrs.reduce((a, b) => Math.min(a, b));
    const hiHr = hrs.reduce((a, b) => Math.max(a, b));
    const solid = [[x(loHr), y(regHrVo2.a + regHrVo2.b * loHr)], [x(hiHr), y(regHrVo2.a + regHrVo2.b * hiHr)]];
    const dashed = [[x(hiHr), y(regHrVo2.a + regHrVo2.b * hiHr)], [x(hrMax), y(est.vo2max)]];
    add(plot,
      el('path', { d: line(solid), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2.5 }),
      el('path', { d: line(dashed), fill: 'none', stroke: 'var(--v-risk)', 'stroke-width': 2, 'stroke-dasharray': '6 4' })
    );

    pts.forEach((p) => add(plot,
      el('circle', { cx: x(p.hr), cy: y(p.vo2), r: 5, fill: 'var(--v-risk)', stroke: '#fff', 'stroke-width': 1.5 })
    ));

    const ex = x(hrMax);
    const ey = y(est.vo2max);
    add(plot,
      el('line', { x1: ex, y1: ey, x2: ex, y2: PHC, stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),
      el('line', { x1: ex, y1: ey, x2: PWC, y2: ey, stroke: 'var(--secondary-color)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),
      el('circle', { cx: ex, cy: ey, r: 6, fill: 'var(--secondary-color)' }),
      el('text', { x: ex, y: -18, 'text-anchor': 'middle', class: 'v-label-strong' },
        `VO₂max ≈ ${est.vo2max.toFixed(1)}`)
    );

    add(root, plot);
    figC.chart.innerHTML = '';
    figC.chart.appendChild(root);
    figC.setLabel(
      `Heart rate against oxygen cost, the relationship that makes the whole method possible. The ` +
      `points fall close to a straight line (R squared ${round(regHrVo2.r2, 2)}). Extrapolated to an ` +
      `assumed maximum heart rate of ${hrMax} beats per minute, the line reads off an estimated VO2max ` +
      `of ${est.vo2max.toFixed(1)} millilitres per kilogram per minute.`
    );
    figC.setTable({
      caption: 'Panel C data — heart rate against oxygen cost (illustrative)',
      head: ['Heart rate (bpm)', 'Oxygen cost (mL/kg/min)'],
      rows: pts.map((p) => [String(p.hr), p.vo2.toFixed(1)]),
    });
  }
}
