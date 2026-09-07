/*
 * fick-explorer.js — what V̇O₂ is, as a picture.
 *
 * Fick's principle: oxygen uptake = cardiac output × arteriovenous O₂
 * difference. Draw cardiac output along the bottom and extraction up the
 * side and the rectangle from the origin has an AREA equal to the uptake.
 * Two sliders move the corner; the presets are the five Dallas men of
 * McGuire et al. 2001, measured at 20 and again at 50. The 7.5 L·min⁻¹
 * upper human limit (Haugen et al. 2018) is drawn as a contour — every
 * pump-times-extraction that reaches it — so no particular split is claimed.
 */

import { FICK, MET_ML, VO2, UNIT_ABS, UNIT_REL, UNIT_EXT } from '../data.js';
import { refLink } from '../cite.js';
import { figure, card, slider, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisBottom, axisLeft, axisTitle, ticks, line, fadeIn } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 760, H = 400;
const M = { top: 26, right: 28, bottom: 58, left: 62 };
const PW = W - M.left - M.right, PH = H - M.top - M.bottom;
const Q_MIN = 5, EXT_MIN = 5;   // slider floors (UI)

export function fickExplorer(mount) {
  const start = FICK.presets[0];
  let q = start.q, ext = start.ext, kg = start.kg, preset = start.key;

  const box = card(
    'The pump times the extraction',
    'Drag the sliders, or press a preset',
    'Width is how much blood the heart pumps each minute. Height is how much oxygen the muscles ' +
    `take out of every 100 mL of it. The shaded area is ${VO2}.`,
    true
  );

  const fig = figure({
    label: '', wide: true,
    caption:
      'Oxygen uptake = cardiac output &times; arteriovenous O&#8322; difference. The two measured points are ' +
      `the five Dallas men of ${refLink('mcguire2001')}, at 20 and again at 50; the 7.5 ${UNIT_ABS} contour ` +
      `is the upper human limit described by ${refLink('haugen2018')}.`,
    onReset: () => applyPreset(FICK.presets[0]),
  });

  const qSlider = slider({
    label: `Cardiac output, ${UNIT_ABS}`, min: Q_MIN, max: FICK.qMax, step: 0.5, value: q,
    format: (v) => v.toFixed(1), onInput: (v) => { q = v; preset = null; render(); },
  });
  const eSlider = slider({
    label: `Oxygen extracted, ${UNIT_EXT}`, min: EXT_MIN, max: FICK.extMax, step: 0.1, value: ext,
    format: (v) => v.toFixed(1), onInput: (v) => { ext = v; preset = null; render(); },
  });

  const massField = h('label', { class: 'v-field' },
    h('span', {}, 'Body mass (kg)'),
    h('input', { type: 'number', min: '30', max: '200', step: '1', value: String(kg) })
  );
  const massInput = massField.querySelector('input');
  massInput.addEventListener('input', () => {
    const v = Number(massInput.value);
    kg = Number.isFinite(v) && v >= 30 && v <= 200 ? v : 0;
    render();
  });

  const presetBtns = FICK.presets.map((p) =>
    h('button', { class: 'v-btn', type: 'button', 'aria-pressed': 'false', onclick: () => applyPreset(p) }, p.label)
  );

  const out = readout([
    { value: '', labelHtml: `${VO2}, <span class="v-nocase">${UNIT_ABS}</span>` },
    { value: '', labelHtml: `Per kilogram, <span class="v-nocase">${UNIT_REL}</span>` },
    { value: '', label: 'METs' },
    { value: '', label: 'Made of', small: true },
  ]);
  const measured = h('p', { class: 'v-card-sub', style: 'margin:0.5rem 0 0;text-align:center;min-height:2.4em' });

  box.body.appendChild(h('div', { class: 'v-controls' }, ...presetBtns, massField));
  box.body.appendChild(fig.figure);
  box.body.appendChild(qSlider);
  box.body.appendChild(eSlider);
  box.body.appendChild(out);
  box.body.appendChild(measured);
  mount.appendChild(box);
  onFirstView(box, () => render(true));

  function applyPreset(p) {
    // slider.set() fires onInput, which clears the preset — so it is set last.
    qSlider.set(p.q);
    eSlider.set(p.ext);
    kg = p.kg;
    massInput.value = String(kg);
    preset = p.key;
    render(true);
  }

  function render(animate) {
    const x = scaleLinear(0, FICK.qMax, 0, PW);
    const y = scaleLinear(0, FICK.extMax, PH, 0);
    const root = svg(W, H);
    const plot = group(M.left, M.top);

    add(plot, axisLeft(y, 0, PW, ticks(0, FICK.extMax, 5)));
    add(plot, axisBottom(x, PH, ticks(0, FICK.qMax, 9)));
    add(plot, axisTitle(`Cardiac output (${UNIT_ABS})`, PW / 2, PH + 44));
    add(plot, axisTitle(`Oxygen extracted (${UNIT_EXT})`, -46, PH / 2, -90));

    // Iso-uptake contours: extraction = 100 · V / Q.
    const contour = (v, attrs) => {
      const pts = [];
      for (let qq = (100 * v) / FICK.extMax; qq <= FICK.qMax; qq += 0.5) pts.push([x(qq), y((100 * v) / qq)]);
      return pts.length > 1 ? el('path', { d: line(pts), fill: 'none', ...attrs }) : null;
    };
    FICK.contours.forEach((v) => {
      add(plot, contour(v, { stroke: 'var(--v-grid)', 'stroke-width': 1 }));
      if (FICK.labelledContours.includes(v)) {
        add(plot, el('text', { x: PW - 4, y: y((100 * v) / FICK.qMax) - 5, 'text-anchor': 'end', class: 'v-label-sm' }, `${v} ${UNIT_ABS}`));
      }
    });
    add(plot,
      contour(FICK.ceilingAbs, { stroke: 'var(--v-safe)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
      // Labelled where the contour enters at the top, clear of the preset labels.
      el('text', { x: x((100 * FICK.ceilingAbs) / FICK.extMax) - 8, y: 12, 'text-anchor': 'end', class: 'v-label-strong', fill: 'var(--v-safe)' },
        `≈ ${FICK.ceilingAbs} ${UNIT_ABS} — upper human limit`)
    );

    // The rectangle whose area is the uptake.
    const vo2 = (q * ext) / 100;
    add(plot,
      el('rect', { x: 0, y: y(ext), width: x(q), height: PH - y(ext), fill: 'var(--v-safe)', opacity: 0.2, rx: 3 }),
      el('rect', { x: 0, y: y(ext), width: x(q), height: PH - y(ext), fill: 'none', stroke: 'var(--v-safe)', 'stroke-width': 2, rx: 3 })
    );
    const areaLabel = el('text', { x: x(q) / 2, y: y(ext) - 8, 'text-anchor': 'middle', class: 'v-label-strong', style: 'font-size:16px' },
      `${vo2.toFixed(2)} ${UNIT_ABS}`);
    add(plot, areaLabel);
    if (animate) fadeIn(areaLabel, 300, 150);

    // The two measured points, always shown.
    FICK.presets.forEach((p, i) => {
      const active = preset === p.key;
      add(plot,
        el('circle', { cx: x(p.q), cy: y(p.ext), r: active ? 6 : 5, fill: active ? 'var(--secondary-color)' : 'var(--v-neutral)', stroke: '#fff', 'stroke-width': 2 }),
        el('text', { x: x(p.q) + 9, y: y(p.ext) + (i === 0 ? -6 : 14), class: active ? 'v-label-strong' : 'v-label-sm' },
          `${p.label} · measured ${p.measuredAbs.toFixed(2)}`)
      );
    });

    add(root, plot);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    const rel = kg ? (vo2 * 1000) / kg : null;
    out.setAll([vo2.toFixed(2), rel ? rel.toFixed(1) : '—', rel ? (rel / MET_ML).toFixed(1) : '—', `${q.toFixed(1)} × ${ext.toFixed(1)}`]);
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(FICK.presets[i].key === preset)));

    const p = FICK.presets.find((s) => s.key === preset);
    measured.innerHTML = p
      ? `The paper measured <strong>${p.measuredAbs.toFixed(2)} ${UNIT_ABS}</strong> &mdash; ${p.measuredRel} ${UNIT_REL}, ` +
        `${(p.measuredRel / MET_ML).toFixed(1)} METs &mdash; at ${p.kg} kg. Multiplying the two group averages gives ${vo2.toFixed(2)}: ` +
        `an average of products is not the product of averages. The pump itself was ${p.hrMax} beats &times; ${p.sv} mL a minute.`
      : 'Your own combination. Press a preset to compare with a measured value.';

    fig.setLabel(
      `A rectangle whose width is cardiac output, ${q.toFixed(1)} litres per minute, and whose height is oxygen extraction, ` +
      `${ext.toFixed(1)} millilitres per 100 millilitres. Its area is oxygen uptake, ${vo2.toFixed(2)} litres per minute` +
      (rel ? `, about ${(rel / MET_ML).toFixed(1)} METs for a ${kg} kilogram person.` : '.') +
      ` Contours mark 1 to 7 litres per minute and the 7.5 litre upper human limit.`);
    fig.setTable({
      caption: 'The Dallas men, from the abstract of McGuire et al. 2001',
      head: ['', ...FICK.presets.map((s) => s.label)],
      rows: [
        [`Cardiac output (${UNIT_ABS})`, ...FICK.presets.map((s) => s.q.toFixed(1))],
        [`Oxygen extracted (${UNIT_EXT})`, ...FICK.presets.map((s) => s.ext.toFixed(1))],
        ['Product of the two (computed)', ...FICK.presets.map((s) => ((s.q * s.ext) / 100).toFixed(2))],
        [`Measured VO2max (${UNIT_ABS})`, ...FICK.presets.map((s) => s.measuredAbs.toFixed(2))],
        [`Measured VO2max (${UNIT_REL})`, ...FICK.presets.map((s) => String(s.measuredRel))],
        ['Body mass (kg)', ...FICK.presets.map((s) => String(s.kg))],
        ['Maximum heart rate (beats per minute)', ...FICK.presets.map((s) => String(s.hrMax))],
        ['Maximum stroke volume (mL)', ...FICK.presets.map((s) => String(s.sv))],
      ],
      keyRow: 3,
    });
  }
}
