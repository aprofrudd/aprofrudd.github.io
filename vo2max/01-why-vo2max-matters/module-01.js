/*
 * module-01.js — wires up every interactive on the page.
 *
 * Each interactive is self-contained: it takes a mount point and builds its
 * own card. Nothing here holds state. The closing sections (what happened
 * next, limitations, the quiz and the takeaways) are built here because they
 * are plain content rather than interactive charts.
 */

import { initModulePage } from '../lib/reveal.js';
import { quiz } from '../lib/quiz.js';
import { h } from '../lib/figure.js';
import { FOLLOW_UPS, LIMITATIONS, PAPER, STUDY, PER_MET, TABLE3, FIGURE2 } from './data.js';

import { cohortFlow } from './interactives/cohort-flow.js';
import { metExplorer } from './interactives/met-explorer.js';
import { table2Distributions } from './interactives/table2-distributions.js';
import { hazardIntuition, hazardForest, hazardCompounding } from './interactives/hazard-ratio.js';
import { riskFactors } from './interactives/risk-factors.js';
import { quintileRisk } from './interactives/quintile-risk.js';
import { kmDemo, kmCurves } from './interactives/km-curves.js';
import { whereDoISit } from './interactives/where-do-i-sit.js';

const at = (id) => document.getElementById(id);

/* ---------------------------------------------------------------------------
   Section 09 — what happened next, and what this study cannot tell you.
   ------------------------------------------------------------------------ */
function soWhat(mount) {
  mount.appendChild(h('div', { class: 'v-prose' },
    h('p', { html:
      'This paper landed in 2002 and has been cited more than four thousand times since. Its most ' +
      'lasting effect was to turn fitness from something sports scientists measured into something ' +
      'cardiologists argue about. In 2016 the American Heart Association went further and said ' +
      'fitness should be treated as a <strong>clinical vital sign</strong>, measured as routinely as blood ' +
      'pressure. Jonathan Myers, the first author here, was one of the authors of that statement too.'
    }),
    h('p', { html:
      'The obvious worry with any single study is that it got lucky. This one did not: bigger studies ' +
      'since have kept finding the same number.'
    })
  ));

  mount.appendChild(h('div', { class: 'v-grid' },
    FOLLOW_UPS.map((f) => h('div', { class: 'v-tile' },
      h('h3', {}, f.n),
      h('p', {}, f.finding),
      h('a', { class: 'v-tile-cite', href: f.url, target: '_blank', rel: 'noopener' }, f.cite)
    ))
  ));

  const sit = h('div', { style: 'margin-top:3rem' });
  mount.appendChild(sit);
  whereDoISit(sit);

  mount.appendChild(h('div', { class: 'v-section-head', style: 'margin-top:3.5rem;margin-bottom:1.5rem' },
    h('h2', { style: 'font-size:1.5rem' }, 'What this study cannot tell you'),
    h('p', {}, 'A learning module that skipped this part would be teaching the wrong lesson.')
  ));

  mount.appendChild(h('div', { class: 'v-grid' },
    LIMITATIONS.map((l) => h('div', { class: 'v-tile' },
      h('h3', {}, l.head),
      h('p', {}, l.body)
    ))
  ));

  mount.appendChild(h('blockquote', { class: 'v-quote', style: 'margin-top:2.5rem' },
    STUDY.limitationCausal,
    h('cite', {}, 'The authors, in the paper itself')
  ));
}

/* ---------------------------------------------------------------------------
   Section 10 — the quiz.
   ------------------------------------------------------------------------ */
const QUESTIONS = [
  {
    stem: 'One MET is defined as the energy you use sitting quietly. Roughly how much oxygen is that?',
    options: [
      '3.5 mL per kilogram of body weight per minute',
      '35 mL per kilogram of body weight per minute',
      '3.5 litres per minute, whatever you weigh',
      'It depends entirely on how fit you are',
    ],
    answer: 0,
    explain:
      '1 MET is about <strong>3.5 mL of oxygen per kilogram of body weight per minute</strong>. Because it is ' +
      'per kilogram, it already accounts for body size, which is why the same MET value means the ' +
      'same effort in a large person and a small one. To convert, multiply METs by 3.5.',
  },
  {
    stem: 'Each extra MET was linked to a 12% improvement in survival. Someone improves by 3 METs. How much lower is their risk?',
    options: [
      'About 32% lower',
      'Exactly 36% lower',
      'About 12% lower, however many METs they gain',
      'About 4% lower',
    ],
    answer: 0,
    explain:
      'This is the trap. The 12% <strong>multiplies</strong> rather than adds. Three METs means 0.88 × 0.88 × 0.88 = ' +
      '0.68, so the risk falls by about <strong>32%</strong>, not 36%. The gap between the two answers grows fast: ' +
      'at 10 METs the correct figure is about 72%, while simply adding would give an impossible 120%.',
  },
  {
    stem: 'In the healthy men, having diabetes carried a hazard ratio of 1.30, with a confidence interval of 0.84 to 2.00. What does that tell you?',
    options: [
      'This study could not show a clear effect — the interval includes 1',
      'Diabetes raised the risk of dying by exactly 30%',
      'Diabetes has been proven to have no effect on dying',
      'The study made a mistake, because the interval is so wide',
    ],
    answer: 0,
    explain:
      'The interval runs from 0.84 to 2.00, so it <strong>includes 1</strong> — no effect. The data are compatible with ' +
      'anything from a small benefit to a doubling of risk, which means this study simply could not settle ' +
      'the question. That is very different from showing there is no effect. A wide interval means ' +
      '<em>uninformative</em>, not <em>harmless</em>.',
  },
  {
    stem: 'In Figure 2, the least fit fifth of the healthy men had a relative risk of 4.5. Compared with whom?',
    options: [
      'The fittest fifth, who were set to 1',
      'The average man in the whole study',
      'Men of the same age in the general population',
      'The men who died',
    ],
    answer: 0,
    explain:
      'Relative risk is always relative to a chosen group, and here the paper chose the ' +
      '<strong>fittest fifth</strong> and set them to 1. Change the comparison group and every number changes ' +
      'while the underlying picture stays identical — which is exactly what the chart in section 07 ' +
      'lets you do. A relative risk quoted without saying what it is relative to is not a fact, it is half a fact.',
  },
  {
    stem: 'Does this study show that getting fitter will make you live longer?',
    options: [
      'No — it shows an association, not that one causes the other',
      'Yes, that is precisely what it proves',
      'Yes, because it followed people over time rather than asking them questions',
      'No, because the sample was too small to prove anything',
    ],
    answer: 0,
    explain:
      'It shows that fitter men were less likely to die, which is an <strong>association</strong>. Nobody was ' +
      'assigned to become fitter, so the fitter men might differ in other ways the study did not capture. ' +
      'The authors say this themselves: &ldquo;' + STUDY.limitationCausal + '&rdquo; Other work since — ' +
      'including trials where people did train — supports the causal reading, but this study on its own cannot.',
  },
];

/* ---------------------------------------------------------------------------
   Section 11 — what to take away.
   ------------------------------------------------------------------------ */
function takeaways(mount) {
  const fit = TABLE3.normal.rows[0];
  mount.appendChild(h('div', { class: 'v-grid' },
    [
      ['Fitness beat everything else', `Among the healthy men, exercise capacity had a hazard ratio of ${fit.hr} per MET (${fit.lo} to ${fit.hi}). Nothing else in the model came close, and most of it could not be separated from no effect at all.`],
      ['The size of the effect', `Every extra MET was worth about a ${PER_MET.improvementPct}% improvement in survival — and it compounds, so a few METs go a long way.`],
      ['It was not just healthy people', `The pattern held in the ${FIGURE2.cvd.label.toLowerCase()} too, where the fall in risk across the five fitness groups was close to a straight line.`],
      ['You cannot explain it away', 'Within every risk group — diabetic, smoker, obese, hypertensive — being under 5 METs still roughly doubled the risk.'],
      ['Under 5 METs is the number to remember', 'Below about 5 METs means struggling to sustain a brisk walk. Above 8 METs means being able to jog. Most of the difference in this study sits between those two.'],
      ['It is an association', 'This study followed men, it did not assign them to train. It shows a very strong link. It does not, on its own, prove cause.'],
    ].map(([head, body]) => h('div', { class: 'v-tile' }, h('h3', {}, head), h('p', {}, body)))
  ));

  mount.appendChild(h('blockquote', { class: 'v-quote', style: 'margin-top:2.5rem' },
    STUDY.callToAction,
    h('cite', {}, 'The closing argument of the paper')
  ));

  mount.appendChild(h('div', { class: 'v-source', style: 'margin-top:2.5rem' },
    h('div', { class: 'v-source-label' }, 'Read the original'),
    h('div', { class: 'v-source-title' }, PAPER.title),
    h('div', { class: 'v-source-cite', html:
      `${PAPER.authors}. <em>${PAPER.journal}</em> ${PAPER.citation}. ` +
      `<a href="https://doi.org/${PAPER.doi}" target="_blank" rel="noopener">doi:${PAPER.doi}</a> &middot; ` +
      `PMID ${PAPER.pmid}`
    })
  ));

  mount.appendChild(h('p', { class: 'v-caption', style: 'margin-top:2rem' },
    'Every figure in this module was rebuilt from the numbers in the paper. None of the original ' +
    'artwork is reproduced here. Where a value could only be read off a published chart rather than ' +
    'a printed table, it is labelled as approximate.'
  ));
}

/* ------------------------------------------------------------------------ */
function boot() {
  // Each interactive is independent, so an error in one must not stop the
  // rest of the page building. Log it and carry on.
  const wire = (id, fn) => {
    const m = at(id);
    if (!m) return;
    try {
      fn(m);
    } catch (err) {
      console.error(`[vo2max] ${id} failed to build:`, err);
      m.appendChild(h('p', { class: 'v-caption' },
        'This interactive could not be loaded. The rest of the page still works.'));
    }
  };

  wire('mount-cohort', cohortFlow);
  wire('mount-met', metExplorer);
  wire('mount-table2', table2Distributions);
  wire('mount-hazard', (m) => { hazardIntuition(m); hazardForest(m); hazardCompounding(m); });
  wire('mount-riskfactors', riskFactors);
  wire('mount-quintiles', quintileRisk);
  wire('mount-km', (m) => { kmDemo(m); kmCurves(m); });
  wire('mount-sowhat', soWhat);
  wire('mount-quiz', (m) => quiz(m, QUESTIONS));
  wire('mount-takeaways', takeaways);

  initModulePage();
}

boot();
