/*
 * records-scale.js — how big it gets.
 *
 * One scale, from the men in the Myers clinic to the largest values ever
 * measured. Two views, because Haugen et al. give no body masses to convert
 * between them: per kilogram (mL·kg⁻¹·min⁻¹) and whole body (L·min⁻¹).
 * Tap a marker to read it off. A second panel — elite against sub-elite,
 * sport by sport — appears only once RECORDS.groups has been filled from
 * the full paper.
 */

import { RECORDS, GARMIN, SOURCES, UNIT_ABS, UNIT_REL } from '../data.js';
import { refLink, refLabel } from '../cite.js';
import { figure, toggle, card, readout, h } from '../../lib/figure.js';
import { svg, el, add, group, scaleLinear, axisBottom, ticks, fadeIn } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const W = 760, H = 290;
const M = { left: 40, right: 40, top: 190, bottom: 46 };   // top holds up to four rows of labels
const ROWS = 4, ROW_H = 38;
const CHAR_W = 6.6;   // rough width of a character at the chart's label size, for collision avoidance
const PW = W - M.left - M.right;
const TONE = { neutral: 'var(--v-neutral)', watch: 'var(--secondary-color)', elite: 'var(--v-safe)' };

const digits = (m) => (m.unit === 'abs' ? (m.approx || m.below ? 1 : 2) : (Number.isInteger(m.value) ? 0 : 1));
const fmt = (m) => (m.below ? 'just under ' : m.approx ? '≈ ' : '') + m.value.toFixed(digits(m));
const unitOf = (view) => (view === 'rel' ? UNIT_REL : UNIT_ABS);

export function recordsScale(mount) {
  let view = 'rel';
  let selected = 'haugenMen';

  const box = card('From a treadmill in a clinic to a cross-country skier', 'Tap a marker', null, true);

  const tog = toggle(
    [{ value: 'rel', label: 'Per kilogram' }, { value: 'abs', label: 'Whole body' }],
    view,
    (v) => { view = v; selected = v === 'rel' ? 'haugenMen' : 'haugenSkiers'; render(true); },
    'Choose the unit'
  );

  const fig = figure({
    label: '', wide: true,
    caption:
      `Upper limits from ${refLink('haugen2018')}. The Myers values are estimated METs &times; 3.5; the Dallas men are ` +
      `from ${refLink('mcguire2001')}; Coyle&rsquo;s men from ${refLink('coyle1984')}; the watch reading is the screen in section 03.`,
    onReplay: () => render(true),
    onReset: () => { view = 'rel'; tog.select('rel'); selected = 'haugenMen'; render(true); },
  });

  const out = readout([
    { value: '', label: 'Selected' },
    { value: '', label: 'Times the reference' },
    { value: '', label: 'Who, and how measured', small: true },
  ]);

  box.body.appendChild(h('div', { class: 'v-controls' }, tog));
  box.body.appendChild(fig.figure);
  box.body.appendChild(out);
  mount.appendChild(box);
  if (RECORDS.groups.length) groupsPanel(box.body);
  onFirstView(box, () => render(true));

  function render(animate) {
    const ms = RECORDS.markers.filter((m) => m.unit === view).slice().sort((a, b) => a.value - b.value);
    const max = view === 'rel' ? RECORDS.relMax : RECORDS.absMax;
    const x = scaleLinear(0, max, 0, PW);
    const root = svg(W, H);
    const g = group(M.left, M.top);

    add(g, axisBottom(x, 0, ticks(0, max, view === 'rel' ? 10 : 8)));
    add(g, el('text', { x: PW / 2, y: 42, 'text-anchor': 'middle', class: 'v-label-strong' }, unitOf(view)));

    // Labels stack into rows; each takes the lowest row where it will not
    // overlap the previous label in that row.
    const rowRight = new Array(ROWS).fill(-Infinity);
    ms.forEach((m, i) => {
      const px = x(m.value);
      const anchor = px < 70 ? 'start' : px > PW - 70 ? 'end' : 'middle';
      const width = Math.max(m.tag.length, fmt(m).length + (m.estimated ? 7 : 0)) * CHAR_W + 10;
      const left = anchor === 'start' ? px : anchor === 'end' ? px - width : px - width / 2;
      let row = rowRight.findIndex((r) => r <= left);
      if (row < 0) row = ROWS - 1;
      rowRight[row] = left + width;
      const ly = -20 - row * ROW_H;            // value label baseline
      const isSel = m.key === selected;
      const node = group(0, 0, {
        class: 'v-hit', tabindex: '0', role: 'button',
        'aria-pressed': String(isSel),
        'aria-label': `${m.label}: ${fmt(m)} ${unitOf(view)}${m.estimated ? ', estimated' : ''}. Press to select.`,
      });
      add(node,
        el('line', { x1: px, y1: ly + 5, x2: px, y2: 0, stroke: TONE[m.tone], 'stroke-width': isSel ? 2.5 : 1.25 }),
        el('circle', { cx: px, cy: 0, r: isSel ? 7 : 5, fill: TONE[m.tone], stroke: '#fff', 'stroke-width': 2 }),
        el('text', { x: px, y: ly - 13, 'text-anchor': anchor, class: 'v-label-sm', fill: TONE[m.tone] }, m.tag),
        el('text', { x: px, y: ly, 'text-anchor': anchor, class: 'v-label-strong', fill: TONE[m.tone], style: isSel ? 'font-size:13px' : null },
          `${fmt(m)}${m.estimated ? ' (est.)' : ''}`)
      );
      const pick = () => { selected = m.key; render(false); };
      node.addEventListener('click', pick);
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      add(g, node);
      if (animate) fadeIn(node, 300, i * 90);
    });

    add(root, g);
    fig.chart.innerHTML = '';
    fig.chart.appendChild(root);

    const sel = ms.find((m) => m.key === selected) || ms[ms.length - 1];
    const ref = RECORDS.markers.find((m) => m.key === (view === 'rel' ? RECORDS.referenceKey : RECORDS.referenceAbsKey));
    const ratio = sel.value / ref.value;
    const how = sel.estimated ? 'estimated' : sel.hypothetical ? 'a modelled runner, not a person' : sel.approx || sel.below ? 'as the paper gives it' : 'measured';
    out.setAll([`${fmt(sel)}`, `${ratio.toFixed(1)}× ${ref.tag}`, `${sel.label} — ${how}`]);

    fig.setLabel(
      `A scale from 0 to ${max} ${view === 'rel' ? 'millilitres per kilogram per minute' : 'litres per minute'} with ${ms.length} markers: ` +
      ms.map((m) => `${m.label} at ${fmt(m)}`).join('; ') + `. Selected: ${sel.label}, ${ratio.toFixed(1)} times ${ref.label}.`);
    fig.setTable({
      caption: `Every marker on the scale, ${view === 'rel' ? 'per kilogram' : 'whole body'}`,
      head: ['Marker', 'Value', 'Unit', 'Kind', 'Source'],
      rows: ms.map((m) => [
        m.label, fmt(m), unitOf(view),
        m.estimated ? 'estimated (treadmill speed and grade, or a watch)' : m.hypothetical ? 'modelled' : m.approx || m.below ? 'approximate, as the paper gives it' : 'measured',
        m.source === 'garmin' ? `Garmin screen, captured ${GARMIN.captured}` : refLabel(SOURCES[m.source]),
      ]),
      keyRow: ms.indexOf(sel),
    });
  }

  /* Elite against sub-elite, sport by sport — written when the full paper is in. */
  function groupsPanel(parent) {
    parent.appendChild(h('p', { class: 'v-caption' }, `${RECORDS.groups.length} elite-versus-sub-elite comparisons are waiting to be drawn.`));
  }
}
