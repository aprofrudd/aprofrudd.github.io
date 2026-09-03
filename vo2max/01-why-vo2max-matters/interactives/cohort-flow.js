/*
 * cohort-flow.js — the study, as a picture.
 *
 * One dot stands for 25 men. Three stages: everyone who walked on the
 * treadmill, then the two groups they were sorted into, then the men who had
 * died by the end of follow-up. Seeing 1,256 dots turn over is a much better
 * sense of scale than reading the number.
 */

import { STUDY, PAPER } from '../data.js';
import { card, h } from '../../lib/figure.js';
import { svg, el, add, group, comma, prefersReducedMotion } from '../../lib/svg.js';
import { onFirstView } from '../../lib/reveal.js';

const PER_DOT = 25;
const W = 780, H = 200;
const R = 4;
const GAP = 11.5;

export function cohortFlow(mount) {
  let stage = 0;
  let timer = null;

  const box = card(
    'Who was in this study',
    'One dot = 25 men',
    'Press play to see how 6,213 men were sorted, and what had happened to them by the end.',
    true
  );

  const chart = h('div', { class: 'v-chart', role: 'img', 'aria-label': '' });
  const caption = h('p', { class: 'v-card-sub', style: 'margin:1rem 0 0;min-height:3.2em' });

  const play = h('button', { class: 'v-btn v-btn-primary', type: 'button', onclick: () => run() }, 'Play');
  const stepBtns = ['Everyone', 'Two groups', 'After 6.2 years'].map((label, i) =>
    h('button', { class: 'v-btn', type: 'button', onclick: () => { stop(); stage = i; render(); } }, label)
  );

  box.body.appendChild(chart);
  box.body.appendChild(h('p', { class: 'v-scroll-hint' }, 'Swipe the chart sideways to see all of it.'));
  box.body.appendChild(h('div', { class: 'v-controls' }, play, ...stepBtns));
  box.body.appendChild(caption);

  // The methods, beside the picture rather than buried in prose.
  box.body.appendChild(h('dl', { class: 'v-beats', style: 'margin-top:1.75rem' },
    h('dt', {}, 'Who'), h('dd', {}, `${comma(STUDY.total)} men, referred for a treadmill test because a doctor wanted one. Not volunteers, and not a random sample of the public.`),
    h('dt', {}, 'When'), h('dd', {}, `Tested from ${STUDY.dataFrom} onwards; who was still alive was checked in ${STUDY.vitalStatusTo}.`),
    h('dt', {}, 'What was done'), h('dd', {}, 'Each man walked on a treadmill that got progressively harder until he had to stop. Most tests lasted 8 to 12 minutes.'),
    h('dt', {}, 'What was measured'), h('dd', {}, 'Exercise capacity in METs — worked out from the speed and slope of the treadmill, not from measuring the oxygen he actually breathed.'),
    h('dt', {}, 'What was counted'), h('dd', {}, `Whether he had died of any cause. Not what he died of — that was not known.`),
    h('dt', {}, 'How long'), h('dd', {}, `${STUDY.followUpYears} years on average, give or take ${STUDY.followUpSD}.`)
  ));

  mount.appendChild(box);
  onFirstView(box, () => { render(); if (!prefersReducedMotion()) run(); });

  function stop() { if (timer) { clearInterval(timer); timer = null; } play.textContent = 'Play'; }

  function run() {
    stop();
    stage = 0;
    render();
    play.textContent = 'Playing…';
    timer = setInterval(() => {
      stage += 1;
      render();
      if (stage >= 2) { stop(); play.textContent = 'Replay'; }
    }, 1600);
  }

  /** Lay out `count` dots in a grid `cols` wide, offset to (ox, oy). */
  function grid(count, cols, ox, oy, colourFor) {
    const g = group(ox, oy);
    for (let i = 0; i < count; i++) {
      add(g, el('circle', {
        cx: (i % cols) * GAP + R,
        cy: Math.floor(i / cols) * GAP + R,
        r: R,
        fill: colourFor(i),
        style: prefersReducedMotion() ? null : 'transition: fill 500ms ease',
      }));
    }
    return g;
  }

  function render() {
    const nAll = Math.round(STUDY.total / PER_DOT);
    const nNormal = Math.round(STUDY.normal / PER_DOT);
    const nCvd = Math.round(STUDY.cvd / PER_DOT);
    const dNormal = Math.round(288 / PER_DOT);
    const dCvd = Math.round(968 / PER_DOT);

    const root = svg(W, H);

    if (stage === 0) {
      add(root, el('text', { x: W / 2, y: 22, 'text-anchor': 'middle', class: 'v-label-strong', style: 'font-size:15px' },
        `${comma(STUDY.total)} men walked on a treadmill`));
      add(root, grid(nAll, 26, (W - 26 * GAP) / 2, 46, () => 'var(--v-neutral)'));
      caption.innerHTML = `Every one of these dots is 25 men. All ${comma(STUDY.total)} of them were sent for a treadmill test by a doctor.`;
      chart.setAttribute('aria-label', `A grid of dots representing ${comma(STUDY.total)} men.`);
    } else {
      const colL = 14, colR = 18;
      const leftX = 60;
      const rightX = leftX + colL * GAP + 90;

      add(root,
        el('text', { x: leftX, y: 22, class: 'v-label-strong', style: 'font-size:14px' }, 'Healthy'),
        el('text', { x: leftX, y: 40, class: 'v-label-sm' }, `${comma(STUDY.normal)} men — normal test,`),
        el('text', { x: leftX, y: 54, class: 'v-label-sm' }, 'no history of heart disease'),
        el('text', { x: rightX, y: 22, class: 'v-label-strong', style: 'font-size:14px' }, 'Heart disease'),
        el('text', { x: rightX, y: 40, class: 'v-label-sm' }, `${comma(STUDY.cvd)} men — abnormal test`),
        el('text', { x: rightX, y: 54, class: 'v-label-sm' }, 'or a history of heart disease, or both')
      );

      const dead = stage >= 2;
      add(root, grid(nNormal, colL, leftX, 70, (i) => (dead && i < dNormal) ? 'var(--v-risk)' : 'var(--v-safe)'));
      add(root, grid(nCvd, colR, rightX, 70, (i) => (dead && i < dCvd) ? 'var(--v-risk)' : 'var(--v-neutral)'));

      if (dead) {
        caption.innerHTML =
          `After ${STUDY.followUpYears} years, <strong>${comma(STUDY.deaths)} of the ${comma(STUDY.total)} men had died</strong> ` +
          `&mdash; shown here in red. That is 288 of the healthy men and 968 of the men with heart disease, ` +
          `an average of ${STUDY.annualMortalityPct}% of the whole group every year. ` +
          `The question the paper asks is simple: what, measured on the day of the test, told you who these men would be?`;
        chart.setAttribute('aria-label',
          `The same dots, now split into ${comma(STUDY.normal)} healthy men and ${comma(STUDY.cvd)} men with heart disease. ` +
          `${comma(STUDY.deaths)} dots are marked red for the men who had died after ${STUDY.followUpYears} years.`);
      } else {
        caption.innerHTML =
          `They were sorted into two groups. <strong>${comma(STUDY.normal)}</strong> had a normal treadmill test and no ` +
          `history of heart disease. <strong>${comma(STUDY.cvd)}</strong> had either an abnormal test or a history of heart ` +
          `disease, or both &mdash; including ${STUDY.pulmonarySubset} men with mild lung disease.`;
        chart.setAttribute('aria-label',
          `The dots split into two groups: ${comma(STUDY.normal)} healthy men and ${comma(STUDY.cvd)} men with heart disease.`);
      }
    }

    chart.innerHTML = '';
    chart.appendChild(root);
    stepBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === stage)));
  }
}
