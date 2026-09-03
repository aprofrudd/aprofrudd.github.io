/*
 * module-01.js — wires up the interactives on this page.
 *
 * ---------------------------------------------------------------------------
 * PARKED — built and verified, but not currently on the page.
 *
 * The files are still in interactives/ and still parse. Each comes back by
 * restoring one wire() call in boot() (and, where noted, a mount point in
 * index.html plus a nav entry):
 *
 *   hazard-ratio.js      hazardIntuition, hazardForest, hazardCompounding
 *                        — what a hazard ratio is; the full Table 3 as a
 *                          forest plot; why 12% per MET compounds
 *   risk-factors.js      riskFactors
 *                        — Figure 1, fitness inside each risk-factor group
 *   where-do-i-sit.js    whereDoISit
 *                        — enter your own METs and see where you'd land
 *   km-curves.js         kmDemo
 *                        — the ten-patient walkthrough of how a survival
 *                          curve is built (kmCurves is still live)
 *   ../lib/quiz.js       quiz(), plus the QUESTIONS array removed from here
 *   data.js FOLLOW_UPS   the replication-studies tiles
 *
 * Full history is in the commit "VO2max learning module: full build before
 * strip-back".
 * ---------------------------------------------------------------------------
 *
 * Copy is deliberately sparse: the page is narrated over. Section text lives
 * in index.html; anything here is a card, a figure, a quote or a source.
 */

import { initModulePage } from '../lib/reveal.js';
import { initSlides } from '../lib/slides.js';
import { watchNotation } from '../lib/notation.js';
import { h } from '../lib/figure.js';
import { LIMITATIONS, PAPER, STUDY, FIGURE2, TABLE2, FIRSTBEAT, GARMIN, VO2MAX } from './data.js';
import { PUBMED_SERIES, PUBMED_META } from './pubmed-data.js';

import { trendsChart } from './interactives/trends-chart.js';
import { pubmedChart } from './interactives/pubmed-chart.js';
import { watchVo2max } from './interactives/watch-vo2max.js';
import { cohortFlow } from './interactives/cohort-flow.js';
import { metExplorer } from './interactives/met-explorer.js';
import { table2Distributions } from './interactives/table2-distributions.js';
import { quintileRisk } from './interactives/quintile-risk.js';
import { kmCurves } from './interactives/km-curves.js';

const at = (id) => document.getElementById(id);

/* Section 01 — public attention. Section 02 — research attention. */
function focus(mount) { trendsChart(mount); }
function research(mount) { pubmedChart(mount); }

/* ---------------------------------------------------------------------------
   Section 03 — wearables. The Garmin screen, the small print that names
   Firstbeat, a link to their white paper, and the three-chart rebuild.
   ------------------------------------------------------------------------ */
function wearables(mount) {
  mount.appendChild(h('figure', { class: 'v-figure', style: 'max-width:280px;margin:0 auto 1.5rem' },
    h('img', {
      src: GARMIN.image, alt: GARMIN.imageAlt, loading: 'lazy',
      style: 'width:100%;display:block;border-radius:16px;box-shadow:var(--shadow)',
    }),
    h('figcaption', { class: 'v-caption', html: `A ${GARMIN.device} ${VO2MAX} screen, captured ${GARMIN.captured}.` })
  ));

  mount.appendChild(h('blockquote', { class: 'v-quote' },
    GARMIN.attribution,
    h('cite', { html: 'Garmin Connect, &ldquo;About VO2 Max Estimates&rdquo; support page' })
  ));

  mount.appendChild(h('div', { class: 'v-source', style: 'margin:0 auto 2rem' },
    h('div', { class: 'v-source-label' }, 'How it is calculated'),
    h('div', { class: 'v-source-title' }, FIRSTBEAT.title),
    h('div', { class: 'v-source-cite', html:
      `${FIRSTBEAT.publisher}, white paper, updated ${FIRSTBEAT.updated}. ` +
      `<a href="${FIRSTBEAT.url}" target="_blank" rel="noopener">Read the white paper</a>`
    })
  ));

  watchVo2max(mount);

  mount.appendChild(h('p', { class: 'v-card-sub', style: 'max-width:680px;margin:1.5rem auto 0;text-align:center', html:
    `Firstbeat claim <strong>${FIRSTBEAT.accuracyPct}% accuracy</strong> for running &mdash; about ` +
    `${FIRSTBEAT.errorPct}% error &mdash; against laboratory tests.`
  }));
}

/* ---------------------------------------------------------------------------
   Section 09 — limitations.
   ------------------------------------------------------------------------ */
function limits(mount) {
  mount.appendChild(h('div', { class: 'v-grid' },
    LIMITATIONS.map((l) => h('div', { class: 'v-tile' }, h('h3', {}, l.head), h('p', {}, l.body)))
  ));
  mount.appendChild(h('blockquote', { class: 'v-quote', style: 'margin-top:2.5rem' },
    STUDY.limitationCausal,
    h('cite', {}, 'The authors, in the paper itself')
  ));
}

/* ---------------------------------------------------------------------------
   Section 10 — takeaways.
   ------------------------------------------------------------------------ */
function takeaways(mount) {
  const n = TABLE2.normal, c = TABLE2.cvd;
  const peakRow = PUBMED_SERIES.reduce((a, b) => ((b.vo2 / b.total) > (a.vo2 / a.total) ? b : a));

  mount.appendChild(h('div', { class: 'v-grid' },
    [
      ['The evidence is not new',
       `Research on fitness and survival grew steadily from the 1970s and levelled off around ${peakRow.year}. The recent surge of interest is in the audience, not the science.`],
      ['Your watch estimates it',
       `A running watch reads heart rate against speed and extrapolates to an assumed maximum. It is a good estimate. It is not a measurement.`],
      ['A MET is a multiple of resting',
       'One MET is sitting still, about 3.5 mL of oxygen per kilogram per minute. Everything in this study is counted in those units, so 8 METs means eight times your resting rate.'],
      ['These METs were estimated',
       'Nobody wore a mask. Exercise capacity was worked out from the speed and slope of the treadmill, and the authors say directly that a measured value would have been better.'],
      ['The men who lived could do more',
       `Among the healthy men, survivors averaged ${n.survived.met} METs against ${n.died.met} for those who died. Among the men with heart disease, ${c.survived.met} against ${c.died.met}.`],
      ['But the groups overlap heavily',
       'That gap is real and it is small. Fitness shifts the odds across a whole population; it does not tell you what will happen to any one person.'],
      ['The gradient is the striking part',
       `Split into fifths, the least fit were ${FIGURE2.headline.normal}× more likely to die than the fittest among the healthy men, and ${FIGURE2.headline.cvd}× among those with heart disease.`],
      ['It is an association',
       'This study followed men, it did not assign them to train. It shows a very strong link. It does not, on its own, prove cause.'],
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
      `<a href="https://doi.org/${PAPER.doi}" target="_blank" rel="noopener">doi:${PAPER.doi}</a> &middot; PMID ${PAPER.pmid}`
    })
  ));

  mount.appendChild(h('p', { class: 'v-caption', style: 'margin-top:2rem' },
    'Every figure here was rebuilt from the numbers in the paper; none of the original artwork is reproduced. ' +
    'Where a value could only be read off a published chart rather than a printed table, it is labelled as approximate. ' +
    `Publication counts come from PubMed via the NCBI E-utilities API, fetched ${PUBMED_META.fetched}.`
  ));
}

/* ------------------------------------------------------------------------ */
function boot() {
  // Typeset V̇O₂max — dot over the V, "2max" subscript — here and in
  // everything the interactives build after this point. See lib/notation.js.
  watchNotation(document.body);

  // Each interactive is independent, so an error in one must not stop the
  // rest of the page building. Log it and carry on.
  const wire = (id, fn) => {
    const m = at(id);
    if (!m) return;
    try { fn(m); } catch (err) {
      console.error(`[vo2max] ${id} failed to build:`, err);
      m.appendChild(h('p', { class: 'v-caption' }, 'This interactive could not be loaded. The rest of the page still works.'));
    }
  };

  wire('mount-focus', focus);
  wire('mount-research', research);
  wire('mount-wearables', wearables);
  wire('mount-cohort', cohortFlow);
  wire('mount-met', metExplorer);
  wire('mount-table2', table2Distributions);
  wire('mount-quintiles', quintileRisk);
  wire('mount-km', kmCurves);
  wire('mount-limits', limits);
  wire('mount-takeaways', takeaways);

  // One section at a time by default — it is narrated over. ?view=scroll
  // gives the whole page back as one long scroll.
  const scroll = new URLSearchParams(location.search).get('view') === 'scroll';
  if (scroll || !initSlides()) initModulePage();
}

boot();
