/*
 * data.js — every number used in Module 1, in one place.
 *
 * SOURCE: Myers J, Prakash M, Froelicher V, Do D, Partington S, Atwood JE.
 * "Exercise Capacity and Mortality among Men Referred for Exercise Testing."
 * N Engl J Med 2002;346(11):793-801. DOI 10.1056/NEJMoa011858. PMID 11893790.
 *
 * Every value below was read directly from the published article: the full
 * text for prose figures, and the published table/figure artwork for
 * tabulated values. Values that are PRINTED in the paper carry no flag.
 * Values READ OFF a bar height (because the paper prints only the confidence
 * interval, not the point estimate) are marked `approx: true`, and the UI
 * labels them as approximate. Nothing here is inferred or borrowed from a
 * secondary source.
 *
 * Sections 10-13 draw on other papers, enumerated in SOURCES below; every
 * block names the source it draws on. `derived: true` is arithmetic on
 * printed numbers (the arithmetic is in the comment); `approx: true` is read
 * off a figure or given as "~" by the source; `estimated: true` was an
 * estimate in the source itself; `null` means the paper that holds the number
 * has not yet been read, and the UI degrades as described where it is used.
 *
 * No chart may hardcode a number. If it is on screen, it comes from here.
 */

export const PAPER = {
  authors: 'Myers J, Prakash M, Froelicher V, Do D, Partington S, Atwood JE',
  title: 'Exercise Capacity and Mortality among Men Referred for Exercise Testing',
  journal: 'New England Journal of Medicine',
  year: 2002,
  citation: 'N Engl J Med 2002;346:793-801',
  doi: '10.1056/NEJMoa011858',
  url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa011858',
  pmid: '11893790',
  // Citation count. SOURCE: Google Scholar search for the title, "Cited by
  // 6012", checked 4 September 2026. Rendered as "more than 6,000".
  scholar: {
    citedBy: 6012,
    source: 'Google Scholar',
    asOf: 'September 2026',
    url: 'https://scholar.google.com/scholar?q=%22Exercise+capacity+and+mortality+among+men+referred+for+exercise+testing%22',
  },
};

/* ---------------------------------------------------------------------------
 * Notation. A dot over the V — it is a rate, per unit time — and the whole
 * of "2max" as a subscript. Used for every visible mention on the page.
 *
 * The string here carries U+0307 COMBINING DOT ABOVE and U+2082 SUBSCRIPT
 * TWO. No font in the site's stack anchors that mark to a capital V, and
 * there is no subscript "max" in Unicode at all, so lib/notation.js
 * rewrites the string once it is in the page: it draws the dot and sets
 * "2max" as a true subscript. The mark is also the sentinel that tells it
 * which strings to touch.
 *
 * Machine-facing text (the <title>, meta tags, JSON-LD, llms.txt) keeps plain
 * "VO2max" so searches still match, and verbatim quotes — Garmin's screen
 * attribution, Firstbeat's own words — stay exactly as their sources wrote
 * them.
 * ------------------------------------------------------------------------ */
export const VO2MAX = 'V\u0307O\u2082max';
export const VO2 = 'V\u0307O\u2082';                            // the rate itself, no "max"
export const UNIT_ABS = 'L\u00b7min\u207b\u00b9';                  // L·min⁻¹
export const UNIT_REL = 'mL\u00b7kg\u207b\u00b9\u00b7min\u207b\u00b9';  // mL·kg⁻¹·min⁻¹
export const UNIT_KCAL = 'kcal\u00b7min\u207b\u00b9';               // kcal·min⁻¹
export const UNIT_EXT = 'mL per 100 mL';                          // arteriovenous O₂ difference (McGuire prints "vol%")

/* ---------------------------------------------------------------------------
 * The study. All from the Abstract and Methods.
 * ------------------------------------------------------------------------ */
export const STUDY = {
  total: 6213,
  normal: 2534,          // normal exercise test AND no history of cardiovascular disease
  cvd: 3679,             // abnormal test OR history of cardiovascular disease, or both
  pulmonarySubset: 435,  // 7% of the population, mild pulmonary disease, counted in the CVD group
  deaths: 1256,
  annualMortalityPct: 2.6,
  followUpYears: 6.2,
  followUpSD: 3.7,
  dataFrom: 1987,
  vitalStatusTo: 'July 2000',
  // Methods, verbatim:
  metDefinition:
    'One MET is defined as the energy expended in sitting quietly, which is ' +
    'equivalent to a body oxygen consumption of approximately 3.5 ml per ' +
    'kilogram of body weight per minute for an average adult.',
  metEstimation:
    'Exercise capacity (in MET) was estimated on the basis of the speed and ' +
    'grade of the treadmill.',
  // Discussion, limitations, verbatim:
  limitationMeasured:
    'directly measured exercise capacity (peak oxygen consumption) is known to ' +
    'be a more accurate and reproducible measure of exercise tolerance, as well ' +
    'as a more robust predictor of outcomes.',
  callToAction:
    'In terms of reducing mortality from any cause, improving exercise tolerance ' +
    'warrants at least as much attention as other major risk factors from ' +
    'physicians who treat patients with or at high risk for cardiovascular disease.',
  // Statistical analysis, verbatim — the hook for teaching censoring:
  censoringNote:
    'Censoring was not performed, since data on interventions were not available ' +
    'for all subjects.',
};

/* ---------------------------------------------------------------------------
 * TABLE 2 — Age-Adjusted Characteristics and Exercise-Test Responses among
 * Subjects Who Died and Subjects Who Survived.
 * Values are mean +/- SD. P values compare survived vs died within each group.
 * ------------------------------------------------------------------------ */
export const TABLE2 = {
  normal: {
    label: 'Healthy men',
    sublabel: 'normal treadmill test, no history of heart disease',
    n: 2534,
    survived: { n: 2246, met: 9.7, sd: 3.7 },
    died:     { n: 288,  met: 8.4, sd: 3.5 },
    total:    { n: 2534, met: 9.5, sd: 3.8 },
    p: '<0.001',
  },
  cvd: {
    label: 'Men with heart disease',
    sublabel: 'abnormal treadmill test or a history of heart disease, or both',
    n: 3679,
    survived: { n: 2711, met: 7.4, sd: 3.3 },
    died:     { n: 968,  met: 6.5, sd: 2.8 },
    total:    { n: 3679, met: 7.2, sd: 3.3 },
    p: '<0.001',
  },
};

// The rest of Table 2, for the "view as a table" panel.
export const TABLE2_FULL = [
  { row: 'Age (years)',                    nTot:'55 ± 12',       nSur:'55 ± 12',       nDied:'62 ± 10',      nP:'<0.001', cTot:'61 ± 10',       cSur:'60 ± 10',       cDied:'65 ± 9',       cP:'<0.001' },
  { row: 'Height (in.)',                   nTot:'69.4 ± 3.4',    nSur:'69.4 ± 3.1',    nDied:'69.7 ± 4.9',   nP:'0.08',   cTot:'69.2 ± 3.7',    cSur:'69.2 ± 3.5',    cDied:'69.3 ± 4.2',   cP:'0.34' },
  { row: 'Weight (lb)',                    nTot:'193.7 ± 37.5',  nSur:'194.1 ± 37.1',  nDied:'191.0 ± 40.1', nP:'0.19',   cTot:'188.8 ± 36.1',  cSur:'190.7 ± 36.3',  cDied:'183.7 ± 34.4', cP:'<0.001' },
  { row: 'Body-mass index',                nTot:'28.3 ± 5.1',    nSur:'28.4 ± 5.1',    nDied:'27.5 ± 5.0',   nP:'0.005',  cTot:'27.8 ± 5.0',    cSur:'28.1 ± 5.0',    cDied:'26.9 ± 4.7',   cP:'<0.001' },
  { row: 'Resting heart rate (beats/min)', nTot:'78 ± 16',       nSur:'78 ± 16',       nDied:'83 ± 16',      nP:'<0.001', cTot:'78 ± 26',       cSur:'77 ± 29',       cDied:'79 ± 16',      cP:'0.24' },
  { row: 'Resting diastolic BP (mm Hg)',   nTot:'84 ± 12',       nSur:'84 ± 12',       nDied:'83 ± 13',      nP:'0.16',   cTot:'82 ± 18',       cSur:'82 ± 19',       cDied:'80 ± 12',      cP:'<0.001' },
  { row: 'Resting systolic BP (mm Hg)',    nTot:'132 ± 20',      nSur:'133 ± 20',      nDied:'131 ± 21',     nP:'0.13',   cTot:'134 ± 23',      cSur:'135 ± 23',      cDied:'132 ± 24',     cP:'<0.001' },
  { row: 'Maximal heart rate (beats/min)', nTot:'145 ± 24',      nSur:'145 ± 23',      nDied:'140 ± 25',     nP:'<0.001', cTot:'132 ± 29',      cSur:'133 ± 28',      cDied:'127 ± 32',     cP:'<0.001' },
  { row: 'Maximal diastolic BP (mm Hg)',   nTot:'86 ± 16',       nSur:'86 ± 15',       nDied:'85 ± 16',      nP:'0.37',   cTot:'86 ± 23',       cSur:'86 ± 20',       cDied:'85 ± 30',      cP:'0.53' },
  { row: 'Maximal systolic BP (mm Hg)',    nTot:'184 ± 28',      nSur:'184 ± 27',      nDied:'178 ± 32',     nP:'<0.001', cTot:'174 ± 31',      cSur:'176 ± 31',      cDied:'168 ± 32',     cP:'<0.001' },
  { row: 'Exercise capacity (MET)',        nTot:'9.5 ± 3.8',     nSur:'9.7 ± 3.7',     nDied:'8.4 ± 3.5',    nP:'<0.001', cTot:'7.2 ± 3.3',     cSur:'7.4 ± 3.3',     cDied:'6.5 ± 2.8',    cP:'<0.001', highlight: true },
];

/* ---------------------------------------------------------------------------
 * TABLE 3 — Age-Adjusted Risk of Death, According to Clinical and
 * Exercise-Test Variables. Cox proportional-hazards model.
 * `hr` is the hazard ratio; `lo`/`hi` are the 95% confidence interval.
 * `plain` is the everyday-language gloss shown when a row is selected.
 * ------------------------------------------------------------------------ */
export const TABLE3 = {
  normal: {
    label: 'Healthy men',
    rows: [
      { name: 'Fitness', detail: 'per extra 1 MET of exercise capacity', hr: 0.84, lo: 0.79, hi: 0.89, p: '<0.001', star: true,
        plain: 'Each extra MET was linked to a 16% lower risk of dying. This is the strongest effect in the whole table, and the confidence interval sits well clear of 1.' },
      { name: 'Smoking', detail: 'per extra 10 pack-years', hr: 1.09, lo: 1.03, hi: 1.14, p: '<0.001',
        plain: 'More smoking, higher risk. Real, and clearly separated from 1 — but a much smaller effect than fitness.' },
      { name: 'High blood pressure', detail: 'history of hypertension', hr: 0.75, lo: 0.56, hi: 1.02, p: '0.07',
        plain: 'The interval crosses 1, so this study could not show a clear effect in healthy men. Note it even points the "wrong" way — that is what an uncertain estimate looks like.' },
      { name: 'Diabetes', detail: '', hr: 1.30, lo: 0.84, hi: 2.00, p: '0.24',
        plain: 'Crosses 1. The data are compatible with anything from a modest benefit to a doubling of risk — that is uninformative, not proof of no effect.' },
      { name: 'High cholesterol', detail: 'total cholesterol above 220 mg/dl', hr: 1.21, lo: 0.88, hi: 1.64, p: '0.25',
        plain: 'Crosses 1. In these healthy men, cholesterol did not predict dying nearly as sharply as fitness did.' },
      { name: 'Enlarged heart muscle', detail: 'left ventricular hypertrophy on ECG', hr: 1.22, lo: 0.57, hi: 2.63, p: '0.61',
        plain: 'A very wide interval crossing 1 — too few cases among the healthy men to say anything useful.' },
      { name: 'Irregular heartbeat on the test', detail: 'exercise-induced ventricular arrhythmia', hr: 1.14, lo: 0.64, hi: 2.01, p: '0.66',
        plain: 'Crosses 1. Alarming to see during a test, but on its own it did not predict death here.' },
      { name: 'Peak heart rate', detail: 'per extra 10 beats/min', hr: 1.00, lo: 0.92, hi: 1.08, p: '0.93',
        plain: 'Sits exactly on 1. No signal at all.' },
    ],
  },
  cvd: {
    label: 'Men with heart disease',
    rows: [
      { name: 'Fitness', detail: 'per extra 1 MET of exercise capacity', hr: 0.91, lo: 0.88, hi: 0.94, p: '<0.001', star: true,
        plain: 'Each extra MET was linked to a 9% lower risk of dying. A tighter interval than any other row here — the single best predictor in the model.' },
      { name: 'Heart failure', detail: 'history of congestive heart failure', hr: 1.67, lo: 1.37, hi: 2.04, p: '<0.001',
        plain: 'The largest increase in risk in the table, and clearly real.' },
      { name: 'Previous heart attack', detail: 'history of myocardial infarction', hr: 1.60, lo: 1.35, hi: 1.90, p: '<0.001',
        plain: 'A clear, substantial increase in risk.' },
      { name: 'Smoking', detail: 'per extra 10 pack-years', hr: 1.05, lo: 1.02, hi: 1.08, p: '0.001',
        plain: 'Small per 10 pack-years, but consistent — the interval clears 1.' },
      { name: 'Enlarged heart muscle', detail: 'left ventricular hypertrophy on ECG', hr: 1.50, lo: 1.13, hi: 1.99, p: '0.005',
        plain: 'A real increase in risk among men who already have heart disease.' },
      { name: 'Lung disease', detail: 'history of pulmonary disease', hr: 1.34, lo: 1.06, hi: 1.68, p: '0.01',
        plain: 'A real, moderate increase in risk.' },
      { name: 'ST-segment depression', detail: 'an abnormal ECG change during exercise', hr: 1.22, lo: 1.03, hi: 1.44, p: '0.02',
        plain: 'The classic "positive stress test" sign. Real, but a weaker predictor than how far the man could walk.' },
      { name: 'High cholesterol', detail: 'total cholesterol above 220 mg/dl', hr: 0.88, lo: 0.74, hi: 1.04, p: '0.14',
        plain: 'Crosses 1 — no clear effect in this group.' },
      { name: 'Peak heart rate', detail: 'per extra 10 beats/min', hr: 0.97, lo: 0.93, hi: 1.01, p: '0.17',
        plain: 'Crosses 1, just barely.' },
      { name: 'Irregular heartbeat on the test', detail: 'exercise-induced ventricular arrhythmia', hr: 1.19, lo: 0.92, hi: 1.53, p: '0.18',
        plain: 'Crosses 1 — not a clear predictor.' },
      { name: 'Diabetes', detail: '', hr: 0.90, lo: 0.69, hi: 1.16, p: '0.41',
        plain: 'Crosses 1. Surprising, but this is a group already selected for heart disease.' },
      { name: 'High blood pressure', detail: 'history of hypertension', hr: 1.07, lo: 0.90, hi: 1.25, p: '0.47',
        plain: 'Crosses 1 — no clear effect once everything else is accounted for.' },
    ],
  },
};

/* The famous "12% per MET". Handle honestly — see NOTE. */
export const PER_MET = {
  improvementPct: 12,
  impliedHR: 0.88,
  quote: 'every 1-MET increase in exercise capacity conferred a 12 percent improvement in survival',
  NOTE:
    'The paper states this in prose, from a separate model fitted to the TOTAL ' +
    'group, and publishes no confidence interval for it. The value 0.88 is simply ' +
    '1 minus 12%. The hazard ratios that ARE printed in Table 3 are 0.84 for the ' +
    'healthy men and 0.91 for the men with heart disease.',
};

/* ---------------------------------------------------------------------------
 * FIGURE 1 — Relative risks of death within each risk-factor group, by
 * fitness band. Reference is >8 MET.
 * The paper prints the 95% CI above each bar but NOT the point estimate,
 * so every `rr` here is read off the bar height and flagged approximate.
 * ------------------------------------------------------------------------ */
export const FIGURE1 = {
  reference: { label: 'More than 8 METs', n: 2743 },
  bands: [
    { key: 'mid', label: '5 to 8 METs', n: 1885 },
    { key: 'low', label: 'Less than 5 METs', n: 1585 },
  ],
  approx: true,
  rows: [
    { name: 'High blood pressure', mid: { rr: 1.30, lo: 1.2, hi: 1.6 }, low: { rr: 1.95, lo: 1.7, hi: 2.3 } },
    { name: 'Lung disease (COPD)',  mid: { rr: 1.30, lo: 0.8, hi: 2.1 }, low: { rr: 1.65, lo: 1.0, hi: 2.7 } },
    { name: 'Diabetes',             mid: { rr: 1.32, lo: 0.9, hi: 1.9 }, low: { rr: 2.30, lo: 1.5, hi: 3.5 } },
    { name: 'Smoking',              mid: { rr: 1.35, lo: 1.1, hi: 1.6 }, low: { rr: 1.95, lo: 1.6, hi: 2.3 } },
    { name: 'Obesity (BMI 30+)',    mid: { rr: 1.58, lo: 1.2, hi: 2.0 }, low: { rr: 2.30, lo: 1.8, hi: 3.0 } },
    { name: 'High cholesterol',     mid: { rr: 1.47, lo: 1.2, hi: 1.8 }, low: { rr: 1.88, lo: 1.6, hi: 2.3 } },
  ],
  quote:
    'In all subgroups defined according to risk factors, the risk of death from ' +
    'any cause in subjects whose exercise capacity was less than 5 MET was ' +
    'roughly double that of subjects whose exercise capacity was more than 8 MET.',
};

/* ---------------------------------------------------------------------------
 * FIGURE 2 — Age-adjusted relative risk of death by quintile of exercise
 * capacity. Quintile 5 (the fittest) is the reference in the published figure.
 * MET ranges and 95% CIs are PRINTED on the bars. Point estimates for
 * quintiles 2-4 are not printed and are read off the bar height.
 * ------------------------------------------------------------------------ */
export const FIGURE2 = {
  normal: {
    label: 'Healthy men',
    quintiles: [
      { q: 1, range: '1.0-5.9 METs',   lo3: 1.0,  hi3: 5.9,  rr: 4.50, lo: 3.0, hi: 6.8, printed: true },
      { q: 2, range: '6.0-7.9 METs',   lo3: 6.0,  hi3: 7.9,  rr: 2.42, lo: 1.5, hi: 3.8, printed: false },
      { q: 3, range: '8.0-9.9 METs',   lo3: 8.0,  hi3: 9.9,  rr: 1.75, lo: 1.1, hi: 2.8, printed: false },
      { q: 4, range: '10.0-12.9 METs', lo3: 10.0, hi3: 12.9, rr: 1.22, lo: 0.7, hi: 2.2, printed: false },
      { q: 5, range: '13.0+ METs',     lo3: 13.0, hi3: null, rr: 1.00, lo: null, hi: null, printed: true, reference: true },
    ],
  },
  cvd: {
    label: 'Men with heart disease',
    quintiles: [
      { q: 1, range: '1.0-4.9 METs',   lo3: 1.0,  hi3: 4.9,  rr: 4.10, lo: 3.3, hi: 5.2, printed: true },
      { q: 2, range: '5.0-6.4 METs',   lo3: 5.0,  hi3: 6.4,  rr: 3.00, lo: 2.4, hi: 3.7, printed: false },
      { q: 3, range: '6.5-8.2 METs',   lo3: 6.5,  hi3: 8.2,  rr: 2.18, lo: 1.7, hi: 2.8, printed: false },
      { q: 4, range: '8.3-10.6 METs',  lo3: 8.3,  hi3: 10.6, rr: 1.73, lo: 1.4, hi: 2.2, printed: false },
      { q: 5, range: '10.7+ METs',     lo3: 10.7, hi3: null, rr: 1.00, lo: null, hi: null, printed: true, reference: true },
    ],
  },
  headline: {
    normal: 4.5,
    cvd: 4.1,
    quote:
      'The relative risk for the subjects in the lowest quintile of exercise ' +
      'capacity, as compared with those in the highest quintile, was 4.5 among ' +
      'the normal subjects and 4.1 among those with a history of cardiovascular ' +
      'or pulmonary disease, abnormal results on exercise testing, or both.',
  },
};

/* ---------------------------------------------------------------------------
 * FIGURE 3 — Kaplan-Meier survival curves, panels A and C (by peak MET).
 * The paper plots 0-14 years. Survival percentages are read off the published
 * curves at the points below, so they are approximate by construction.
 * `pts` are [year, percentSurviving] control points for redrawing the curve.
 * ------------------------------------------------------------------------ */
export const FIGURE3 = {
  xMax: 14,
  approx: true,
  p: '<0.001',
  pNote:
    'The paper reports P<0.001 for the difference between the curves. It does ' +
    'not name the statistical test used, so we do not either.',
  normal: {
    label: 'Healthy men',
    strata: [
      { key: 'high', label: 'More than 8 METs', pts: [[0,100],[2,99],[4,97],[6,94],[8,90],[10,86],[12,81],[13,78]] },
      { key: 'mid',  label: '5 to 8 METs',      pts: [[0,100],[2,97],[4,93],[6,87],[8,80],[10,73],[12,67],[13,65]] },
      { key: 'low',  label: 'Less than 5 METs', pts: [[0,100],[2,95],[4,88],[6,79],[8,70],[10,60],[11,50],[13,47]] },
    ],
  },
  cvd: {
    label: 'Men with heart disease',
    strata: [
      { key: 'high', label: 'More than 8 METs', pts: [[0,100],[2,98],[4,95],[6,90],[8,85],[10,79],[12,74],[13,72]] },
      { key: 'mid',  label: '5 to 8 METs',      pts: [[0,100],[2,95],[4,88],[6,80],[8,71],[10,62],[12,54],[13,50]] },
      { key: 'low',  label: 'Less than 5 METs', pts: [[0,100],[2,92],[4,83],[6,72],[8,61],[10,50],[12,41],[13,37]] },
    ],
  },
};

/* ---------------------------------------------------------------------------
 * The three fitness bands the paper uses as clinical cut-points.
 * Methods, verbatim: "subjects with an exercise capacity of less than 5 MET
 * were considered to have a high risk of death, and those with an energy
 * expenditure of more than 8 MET were considered to have a low risk."
 * ------------------------------------------------------------------------ */
export const BANDS = [
  { key: 'low',  min: 0, max: 5,    label: 'Less than 5 METs', risk: 'Higher risk' },
  { key: 'mid',  min: 5, max: 8,    label: '5 to 8 METs',      risk: 'Middle' },
  { key: 'high', min: 8, max: 22,   label: 'More than 8 METs', risk: 'Lower risk' },
];

/* ---------------------------------------------------------------------------
 * MET reference values for everyday activities.
 * SOURCE: 2024 Adult Compendium of Physical Activities (pacompendium.com),
 * the current successor to Ainsworth et al. Values differ slightly from the
 * 2011 Compendium; we cite the version we used. The Compendium lists speeds
 * in mph; they are shown here in km/h, rounded to 0.1, with running paces
 * given per kilometre.
 * ------------------------------------------------------------------------ */
export const ACTIVITIES = [
  { met: 1.0,  name: 'Sitting quietly',              note: 'This is the definition of 1 MET' },
  { met: 1.3,  name: 'Standing still',               note: 'Barely above resting' },
  { met: 2.0,  name: 'Washing up, standing',         note: 'Light housework' },
  { met: 2.3,  name: 'Strolling, under 3.2 km/h',    note: 'A very slow walk' },
  { met: 3.0,  name: 'Walking 4 km/h',               note: 'An easy walk on the flat' },
  { met: 3.8,  name: 'Walking 4.8 km/h',             note: 'A normal walking pace' },
  { met: 4.8,  name: 'Walking briskly, 5.6 km/h',    note: 'Walking with purpose' },
  { met: 5.5,  name: 'Walking very briskly, 6.4 km/h', note: 'About as fast as walking gets' },
  { met: 6.8,  name: 'Climbing stairs',              note: 'A normal flight of stairs' },
  { met: 7.5,  name: 'Jogging',                      note: 'An easy jog' },
  { met: 8.5,  name: 'Running 8 km/h',               note: 'About 7½ minutes per kilometre' },
  { met: 9.3,  name: 'Running 9.7 km/h',             note: 'About 6 minutes per kilometre' },
  { met: 11.0, name: 'Running 11.3 km/h',            note: 'About 5¼ minutes per kilometre' },
  { met: 11.8, name: 'Running 12.9 km/h',            note: 'About 4¾ minutes per kilometre' },
  { met: 14.0, name: 'Running 15.3 km/h',            note: 'Club runner pace' },
  { met: 17.0, name: 'Running 18.5 km/h',            note: 'National-standard distance runner' },
  { met: 20.0, name: 'Elite endurance athlete',      note: 'Around the highest ever measured' },
];

export const MET_ML = 3.5; // 1 MET = 3.5 mL of oxygen per kg of body weight per minute

/* ---------------------------------------------------------------------------
 * SOURCES — every paper cited in sections 10-13. `checked` is the date the
 * abstract was read on PubMed (NCBI E-utilities); `abstractOnly: true` means
 * the full text has NOT been consulted and only abstract numbers appear on
 * the page. Linked by DOI where there is one, otherwise PubMed.
 * ------------------------------------------------------------------------ */
export const SOURCES = {
  myers: PAPER,
  haugen2018: {
    authors: 'Haugen T, Paulsen G, Seiler S, Sandbakk Ø',
    title: 'New Records in Human Power',
    journal: 'International Journal of Sports Physiology and Performance',
    year: 2018, citation: 'Int J Sports Physiol Perform 2018;13(6):678-686',
    doi: '10.1123/ijspp.2017-0441', pmid: '28872385',
    checked: '2026-09-05', abstractOnly: true,
  },
  bouchard1999: {
    authors: 'Bouchard C, An P, Rice T, Skinner JS, Wilmore JH, Gagnon J, Pérusse L, Leon AS, Rao DC',
    title: 'Familial aggregation of VO2max response to exercise training: results from the HERITAGE Family Study',
    journal: 'Journal of Applied Physiology',
    year: 1999, citation: 'J Appl Physiol 1999;87(3):1003-1008',
    doi: '10.1152/jappl.1999.87.3.1003', pmid: '10484570',
    checked: '2026-09-05', abstractOnly: true,
  },
  coyle1984: {
    authors: 'Coyle EF, Martin WH 3rd, Sinacore DR, Joyner MJ, Hagberg JM, Holloszy JO',
    title: 'Time course of loss of adaptations after stopping prolonged intense endurance training',
    journal: 'Journal of Applied Physiology',
    year: 1984, citation: 'J Appl Physiol 1984;57(6):1857-1864',
    doi: '10.1152/jappl.1984.57.6.1857', pmid: '6511559',
    checked: '2026-09-05', abstractOnly: true,
  },
  mcguire2001: {
    authors: 'McGuire DK, Levine BD, Williamson JW, Snell PG, Blomqvist CG, Saltin B, Mitchell JH',
    title: 'A 30-year follow-up of the Dallas Bedrest and Training Study: I. Effect of age on the cardiovascular response to exercise',
    journal: 'Circulation',
    year: 2001, citation: 'Circulation 2001;104(12):1350-1357',
    doi: '10.1161/hc3701.096099', pmid: '11560849',   // DOI from Crossref, 5 Sep 2026
    checked: '2026-09-05', abstractOnly: true,
  },
  saltin1968: {
    authors: 'Saltin B, Blomqvist G, Mitchell JH, Johnson RL Jr, Wildenthal K, Chapman CB',
    title: 'Response to exercise after bed rest and after training',
    journal: 'Circulation',
    year: 1968, citation: 'Circulation 1968;38(5 Suppl):VII1-78',
    doi: null, pmid: '5696236',
    checked: '2026-09-05', abstractOnly: true,   // and the record carries no abstract at all
  },
  joyner1991: {
    authors: 'Joyner MJ',
    title: 'Modeling: optimal marathon performance on the basis of physiological factors',
    journal: 'Journal of Applied Physiology',
    year: 1991, citation: 'J Appl Physiol 1991;70(2):683-687',
    doi: '10.1152/jappl.1991.70.2.683', pmid: '2022559',
    checked: '2026-09-05', abstractOnly: true,
  },
  bassett2000: {
    authors: 'Bassett DR Jr, Howley ET',
    title: 'Limiting factors for maximum oxygen uptake and determinants of endurance performance',
    journal: 'Medicine & Science in Sports & Exercise',
    year: 2000, citation: 'Med Sci Sports Exerc 2000;32(1):70-84',
    doi: '10.1097/00005768-200001000-00012', pmid: '10647532',
    checked: '2026-09-05', abstractOnly: true,
  },
  millet2023: {
    authors: 'Millet GP, Burtscher J, Bourdillon N, Manferdelli G, Burtscher M, Sandbakk Ø',
    title: 'The V̇O2max Legacy of Hill and Lupton (1923)—100 Years On',
    journal: 'International Journal of Sports Physiology and Performance',
    year: 2023, citation: 'Int J Sports Physiol Perform 2023;18(11):1362-1365',
    doi: '10.1123/ijspp.2023-0229', pmid: '37770066',
    checked: '2026-09-05', abstractOnly: true,
  },
};

/* ---------------------------------------------------------------------------
 * Section 10 — Fick: oxygen uptake = cardiac output × arteriovenous O₂
 * difference. Every number is from the McGuire 2001 abstract: five men first
 * studied in 1966 at age 20, and again 30 years later.
 * ------------------------------------------------------------------------ */
export const FICK = {
  // Axis extents (UI, not data): they hold both presets and put the 7.5
  // contour inside the plot.
  qMax: 45,      // cardiac output, L·min⁻¹
  extMax: 22,    // arteriovenous O₂ difference, mL per 100 mL
  contours: [1, 2, 3, 4, 5, 6, 7],   // arithmetic gridlines, L·min⁻¹
  labelledContours: [2, 4, 6],
  ceilingAbs: 7.5,   // SOURCE haugen2018: "∼7.5 … L·min-1 in male XC skiers". Drawn as a
                     // contour — every pump × extraction that reaches it — so no split is asserted.
  presets: [
    { key: 'y20', label: 'Dallas men at 20 (1966)',
      q: 20.0,             // maximal cardiac output, L/min — "20.0 versus 21.4 L/min"
      ext: 16.2,           // maximal AV oxygen difference, vol% — "16.2 versus 13.8 vol%"
      kg: 77,              // "body weight increased 25% (77 versus 100 kg)"
      hrMax: 193, sv: 104, // "193 versus 181 bpm"; "104 versus 121 mL"
      measuredAbs: 3.30,   // "VO2max decreased 11% (3.30 versus 2.90 L/min)"
      measuredRel: 43,     // "(43 versus 31 mL·kg-1·min-1)"
      age: 20, year: 1966 },
    { key: 'y50', label: 'The same men, 30 years on',
      q: 21.4, ext: 13.8, kg: 100, hrMax: 181, sv: 121,
      measuredAbs: 2.90, measuredRel: 31,
      age: 50, derived: true },   // age is 20 + "a 30-year interval"
  ],
  n: 5,
  fallPct: 11,   // printed. (2.90−3.30)/3.30 = −12.1%: the paper's 11% is the mean of the
                 // individual changes, which is not the change in the means. Show 11.
  // Verbatim, on the arteriovenous O₂ difference:
  entireDecreaseQuote: 'accounted for the entire decrease',
  source: 'mcguire2001',
};

/* ---------------------------------------------------------------------------
 * Section 11 — how big it gets. Markers on one scale. `unit` is 'rel'
 * (mL·kg⁻¹·min⁻¹) or 'abs' (L·min⁻¹); the two views hold different markers
 * because Haugen gives no body masses to convert between them.
 * ------------------------------------------------------------------------ */
export const RECORDS = {
  relMax: 100, absMax: 8,           // axis extents (UI)
  referenceKey: 'myersSurvived',    // the "× …" readout compares with this in the per-kg view
  referenceAbsKey: 'dallas20',      // and with this in the whole-body view
  markers: [
    // Myers 2002, Table 2 (healthy men): estimated METs × 3.5. 8.4 × 3.5 = 29.4 and
    // 9.7 × 3.5 = 33.95, rounded to whole numbers because the METs were estimates.
    { key: 'myersDied', unit: 'rel', value: Math.round(TABLE2.normal.died.met * MET_ML),
      tag: 'Myers, died', label: 'Myers: healthy men who died', estimated: true, derived: true, source: 'myers', tone: 'neutral' },
    { key: 'myersSurvived', unit: 'rel', value: Math.round(TABLE2.normal.survived.met * MET_ML),
      tag: 'Myers, survived', label: 'Myers: healthy men who survived', estimated: true, derived: true, source: 'myers', tone: 'neutral' },
    // McGuire 2001: "(43 versus 31 mL·kg-1·min-1)"
    { key: 'dallas50rel', unit: 'rel', value: 31, tag: 'Dallas men at 50', label: 'The Dallas men at 50', source: 'mcguire2001', tone: 'neutral' },
    { key: 'dallas20rel', unit: 'rel', value: 43, tag: 'Dallas men at 20', label: 'The Dallas men at 20', source: 'mcguire2001', tone: 'neutral' },
    // Coyle 1984: "(50.8 vs. 43.3 ml·kg-1·min-1)"
    { key: 'coyleNever', unit: 'rel', value: 43.3, tag: 'never trained', label: 'Coyle: men who never trained', source: 'coyle1984', tone: 'neutral' },
    { key: 'coyle84', unit: 'rel', value: 50.8, tag: '84 days off', label: 'Coyle: trained men, 84 days after stopping', source: 'coyle1984', tone: 'neutral' },
    // The Garmin screen in section 03 (garmin-vo2max-gauge.png)
    { key: 'garmin', unit: 'rel', value: 48, tag: 'the watch', label: 'The watch screen in section 03 ("Superior")', estimated: true, source: 'garmin', tone: 'watch' },
    // Joyner 1991: "a VO2max of 84 ml·kg-1·min-1"
    { key: 'joyner', unit: 'rel', value: 84, tag: "Joyner's runner", label: "Joyner's hypothetical marathoner", hypothetical: true, source: 'joyner1991', tone: 'elite' },
    // Haugen 2018: "∼80 mL·kg-1·min-1 in XC skiers and runners" (women); "∼90 … in XC skiers, cyclists, and runners" (men)
    { key: 'haugenWomen', unit: 'rel', value: 80, approx: true, tag: 'women', label: 'Upper limit, women (XC skiers, runners)', source: 'haugen2018', tone: 'elite' },
    { key: 'haugenMen', unit: 'rel', value: 90, approx: true, tag: 'men', label: 'Upper limit, men (XC skiers, cyclists, runners)', source: 'haugen2018', tone: 'elite' },
    // Whole-body view
    { key: 'dallas50', unit: 'abs', value: 2.90, tag: 'Dallas men at 50', label: 'The Dallas men at 50', source: 'mcguire2001', tone: 'neutral' },
    { key: 'dallas20', unit: 'abs', value: 3.30, tag: 'Dallas men at 20', label: 'The Dallas men at 20', source: 'mcguire2001', tone: 'neutral' },
    // "slightly below 5.0 L·min-1 in rowers and XC skiers" (women)
    { key: 'haugenWomenAbs', unit: 'abs', value: 5.0, below: true, tag: 'women', label: 'Upper limit, women (rowers, XC skiers)', source: 'haugen2018', tone: 'elite' },
    { key: 'haugenRowers', unit: 'abs', value: 7.0, approx: true, tag: 'male rowers', label: 'Upper limit, male rowers', source: 'haugen2018', tone: 'elite' },
    { key: 'haugenSkiers', unit: 'abs', value: 7.5, approx: true, tag: 'male XC skiers', label: 'Upper limit, male cross-country skiers', source: 'haugen2018', tone: 'elite' },
  ],
  // Elite vs sub-elite pairs, from the full Haugen paper. EMPTY until the PDF
  // has been read; the second panel renders only when this has entries.
  // Shape: { sport, sex: 'M'|'F', unit: 'rel'|'abs', elite: number, subElite: number, approx?: true, source: 'haugen2018' }
  groups: [],
  // Verbatim, Haugen 2018 abstract:
  limitsQuote:
    'V̇O₂max values of ∼7.5 and 7.0 L·min-1 in male XC skiers and rowers, respectively, and/or ' +
    '∼90 mL·kg-1·min-1 in XC skiers, cyclists, and runners can be described as upper human limits ' +
    'for aerobic power. Corresponding values for women are slightly below 5.0 L·min-1 in rowers ' +
    'and XC skiers and ∼80 mL·kg-1·min-1 in XC skiers and runners.',
  proceduresQuote:
    'calibrated apparatus and strict procedures are required to ensure high measurement validity and reliability',
  dopingQuote: 'Doping is also a potential confounding factor when interpreting the human upper limits',
};

/* ---------------------------------------------------------------------------
 * Section 12 — Joyner's model and the limiting-factor debate.
 * ------------------------------------------------------------------------ */
export const JOYNER = {
  vo2max: 84,             // "a VO2max of 84 ml·kg-1·min-1"
  ltFraction: 0.85,       // "a lactate threshold of 85% of VO2max"
  economy: null,          // "exceptional running economy" — no figure in the abstract; full paper not yet read
  predicted: '1:57:58',   // "The fastest time for the marathon predicted by this model is 1:57:58"
  recordThen: '2:06:50',  // "the current world record (2:06:50)"
  sliders: { vo2: [60, 90], lt: [70, 90] },   // UI extents, containing the anchors
  quote:
    'The fastest time for the marathon predicted by this model is 1:57:58 in a hypothetical ' +
    'subject with a VO2max of 84 ml.kg-1.min-1, a lactate threshold of 85% of VO2max, and ' +
    'exceptional running economy.',
  source: 'joyner1991',
};

export const LIMITING = {
  // Bassett & Howley 2000, verbatim:
  delivery:
    'In the exercising human, maximal oxygen uptake (VO2max) is limited by the ability of the ' +
    'cardiorespiratory system to deliver oxygen to the exercising muscles.',
  ceiling:
    'VO2max is an important variable that sets the upper limit for endurance performance (an athlete ' +
    'cannot operate above 100% VO2max, for extended periods). Running economy and fractional ' +
    'utilization of VO2max also affect endurance performance. The speed at lactate threshold (LT) ' +
    'integrates all three of these variables and is the best physiological predictor of distance ' +
    'running performance.',
  // Millet et al. 2023, verbatim:
  hillLupton:
    'One hundred years ago, Hill and Lupton introduced the concept of maximal oxygen uptake ' +
    '(V˙O2max), which is regarded as "the principal progenitor of sports physiology."',
  debate:
    'current debates on limiting factors for V˙O2max and the associated role of convective and ' +
    'diffusive components',
  hillLuptonYear: 1923,   // in Millet's title
};

/* ---------------------------------------------------------------------------
 * Section 13 — gain and loss. One block per scenario for gain-loss.js, each
 * in the unit its paper reports.
 * ------------------------------------------------------------------------ */
export const HERITAGE = {
  key: 'train', label: 'Train for 20 weeks', unit: 'abs',
  n: 481, families: 98, weeks: 20,   // "481 sedentary adult Caucasians from 98 two-generation families … trained for 20 wk"
  meanGainL: 0.4,                    // "approximately 400 ml/min"
  lowGainL: 0,                       // "some individuals experiencing little or no gain"
  highGainL: 1.0,                    // "others gained >1.0 l/min" — a floor, not a maximum
  heritabilityPct: 47,               // "maximal heritability estimate of 47%"
  axis: [-0.2, 1.2],                 // UI extent, L·min⁻¹
  quote:
    'The mean increase in VO(2max) reached approximately 400 ml/min, but there was considerable ' +
    'heterogeneity in responsiveness, with some individuals experiencing little or no gain, ' +
    'whereas others gained >1.0 l/min.',
  source: 'bouchard1999',
};

export const DETRAINING = {
  key: 'stop', label: 'Stop training', unit: 'pct',
  n: 7, controls: 8,        // "Seven endurance exercise-trained subjects"; "eight sedentary control subjects"
  days: [12, 21, 56, 84],   // "studied 12, 21, 56, and 84 days after cessation of training"
  // Per cent of the trained value. Derived from "declined 7% during the first 21
  // days" and "stabilized after 56 days at a level 16% below". No figure is given
  // for day 12, so it is not plotted.
  course: [[0, 100], [21, 93], [56, 84], [84, 84]], derived: true,
  fall21Pct: 7, fall56Pct: 16,
  after84Rel: 50.8, neverTrainedRel: 43.3,   // "(50.8 vs. 43.3 ml X kg-1 X min-1)"
  quote:
    'Maximal O2 uptake (VO2 max) declined 7% (P less than 0.05) during the first 21 days of ' +
    'inactivity and stabilized after 56 days at a level 16% (P less than 0.05) below the initial ' +
    'trained value.',
  source: 'coyle1984',
};

export const AGEING = {
  key: 'age', label: 'Thirty years older', unit: 'abs',
  n: 5, years: 30,
  before: 3.30, after: 2.90,   // "(3.30 versus 2.90 L/min)"
  beforeRel: 43, afterRel: 31, // "(43 versus 31 mL·kg-1·min-1)"
  fallPct: 11,                 // printed; see FICK.fallPct for why not 12
  axisMax: 4,                  // UI extent, L·min⁻¹
  quote: 'On average, VO(2)max decreased 11% (3.30 versus 2.90 L/min).',
  source: 'mcguire2001',
};

export const BEDREST = {
  key: 'bed', label: 'Three weeks in bed', unit: 'pct',
  n: 5, weeks: 3, year: 1966,
  fallPct: null,      // in Saltin 1968 (Circulation 38 Suppl VII) — the full paper has not yet been read
  exceedsPct: 11,     // derived from the McGuire sentence below: more than the 30-year fall
  quote:
    'Most notably, 3 weeks of bedrest in these same men at 20 years of age (1966) had a more ' +
    'profound impact on physical work capacity than did 3 decades of aging.',
  quoteSource: 'mcguire2001',
  source: 'saltin1968',
};

/* ---------------------------------------------------------------------------
 * Studies that came afterwards and found the same thing.
 *
 * PARKED: the tiles built from this were removed when the module was cut back
 * to "why the focus on VO2max". The data is kept because the section may come
 * back — see the parked list at the top of module-01.js.
 * ------------------------------------------------------------------------ */
export const FOLLOW_UPS = [
  {
    cite: 'Kokkinos et al., Circulation, 2008',
    n: '15,660 men',
    finding: 'A 13% lower risk of dying for each extra MET (hazard ratio 0.87, 95% CI 0.86-0.88) — and it held for Black and White men alike.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/18212278/',
  },
  {
    cite: 'Kodama et al., JAMA, 2009',
    n: 'meta-analysis of 33 studies',
    finding: 'Pooling everything published up to that point: 13% lower all-cause mortality per extra MET, in women as well as men.',
    url: 'https://jamanetwork.com/journals/jama/fullarticle/1108396',
  },
  {
    cite: 'Mandsager et al., JAMA Network Open, 2018',
    n: '122,007 patients',
    finding: 'The fittest had an 80% lower risk of dying than the least fit (hazard ratio 0.20). Crucially, they found no upper limit — fitter was better, all the way up.',
    url: 'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2707428',
  },
  {
    cite: 'Ross et al., AHA Scientific Statement, Circulation, 2016',
    n: 'consensus statement',
    finding: 'The American Heart Association argued fitness should be measured in clinics as routinely as blood pressure — "a clinical vital sign". Myers is one of its authors.',
    url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000461',
  },
];

/* ---------------------------------------------------------------------------
 * Limitations. Stated plainly, because a learning module that hides them
 * teaches the wrong lesson.
 * ------------------------------------------------------------------------ */
export const LIMITATIONS = [
  { head: 'Men only',              body: 'Every one of the 6,213 people in this study was a man. Exercise test results are known to differ between men and women, so none of these numbers can be read straight across to women.' },
  { head: 'Patients, not the public', body: 'These men were referred for a treadmill test for a clinical reason. They are not a random sample of the population, and more than half already had heart disease.' },
  { head: 'Fitness was estimated, not measured', body: 'METs were worked out from the speed and slope of the treadmill, not from assessing oxygen uptake. The authors say plainly that measuring it directly is more accurate.' },
  { head: 'Association, not proof',  body: 'This study shows that fitter men were less likely to die. It cannot show that fitness itself caused the lower death rate — only that the two went together. The authors say so in the paper.' },
  { head: 'Nobody was censored',     body: 'The usual survival-analysis practice of removing people from the count when they have an operation was not done here, because the data were not available.' },
  { head: 'Cause of death unknown',  body: 'Only whether each man had died was known, not what they died of.' },
];

/* ---------------------------------------------------------------------------
 * Wearables and the Firstbeat method.
 *
 * SOURCE: Firstbeat Technologies Ltd. "Automated Fitness Level (VO2max)
 * Estimation with Heart Rate and Speed Data." White paper, published
 * 07/11/2014, updated 30/06/2017.
 * https://www.firstbeat.com/wp-content/uploads/2017/06/white_paper_VO2max_30.6.2017.pdf
 * Read directly from the PDF; quotes below are verbatim (only the numbered
 * reference markers, e.g. "[6]", have been dropped).
 *
 * Firstbeat is the physiology engine behind Garmin's on-device VO2max
 * estimate — the Garmin Connect support page for the Forerunner VO2max
 * screen states this directly in its own small print (quoted below,
 * screenshot captured 2026-09-03).
 * ------------------------------------------------------------------------ */
export const FIRSTBEAT = {
  publisher: 'Firstbeat Technologies Ltd.',
  title: 'Automated Fitness Level (VO2max) Estimation with Heart Rate and Speed Data',
  updated: '30 June 2017',
  url: 'https://www.firstbeat.com/wp-content/uploads/2017/06/white_paper_VO2max_30.6.2017.pdf',
  // "Calculation steps", step 4, verbatim:
  calculationQuote:
    "The most reliable data segments are used for estimating the person's " +
    'aerobic fitness level (VO2max) by utilizing either linear or nonlinear ' +
    "dependency between the person's heart rate and speed data.",
  // "Validation of the Firstbeat model": "The accuracy of the method when
  // applied for running is 95% (Mean absolute percentage error, MAPE ~5%),
  // based on a database of 2690 freely performed runs from 79 runners".
  accuracyPct: 95,
  errorPct: 5,
};

export const GARMIN = {
  device: 'Garmin Forerunner',
  captured: '2026-09-03',
  // Verbatim, the line that names Firstbeat directly:
  attribution:
    'VO2 max. data is provided by Firstbeat Analytics™. VO2 max. ' +
    'analysis is provided with permission from The Cooper Institute®.',
  reading: 48, rating: 'Superior',   // read off the screen in the screenshot below
  image: 'garmin-vo2max-gauge.png',
  imageAlt: 'A Garmin watch screen showing a VO2 max estimate of 48, rated "Superior", on a coloured gauge running from red (poor) through to purple (superior).',
};

/* ---------------------------------------------------------------------------
 * An ILLUSTRATIVE example of the Firstbeat method — not real data from a
 * real runner.
 *
 * Seven (speed, heart rate) pairs stand in for a single freely performed
 * submaximal run, spanning an easy jog to a hard tempo effort — the kind of
 * everyday data the method uses, never a maximal test. Heart rate follows a
 * straight line against speed plus a little random scatter, which is the
 * well-established real-world pattern this whole method depends on.
 *
 * VO2 was never measured — nobody wears a mask on a training run. Each VO2
 * value was instead calculated from that same speed using the standard ACSM
 * equation for level running (the same kind of published equation Myers et
 * al. used to turn treadmill speed and grade into METs earlier in this
 * module), plus a little scatter of its own:
 *
 *   VO2 (mL/kg/min) = 0.2 x speed (m/min) + 3.5
 *
 * Source: American College of Sports Medicine, Guidelines for Exercise
 * Testing and Prescription (the running/horizontal equation). ACSM gives it
 * for running at roughly 8 km/h (134 m/min) and above; walking has a
 * different slope, so the example starts at 8 and the reference line on the
 * chart is not drawn below the data.
 * ------------------------------------------------------------------------ */
export const WATCH_RUN = {
  points: [
    { speed: 8,  hr: 128, vo2: 30.0 },
    { speed: 9,  hr: 138, vo2: 32.2 },
    { speed: 10, hr: 142, vo2: 35.6 },
    { speed: 11, hr: 153, vo2: 39.9 },
    { speed: 12, hr: 159, vo2: 44.5 },
    { speed: 13, hr: 165, vo2: 45.7 },
    { speed: 14, hr: 175, vo2: 49.3 },
  ],
  hrMaxMin: 178,      // kept above the highest heart rate in the data, so the
  hrMaxMax: 202,      // slider always extrapolates forward; 202 also keeps the
                      // extrapolated top speed inside the 18 km/h axis
  hrMaxDefault: 190,  // the naive 220-minus-age estimate for a 30-year-old
  massKg: 70,         // body mass of the imagined runner — turns the relative
                      // mL/kg/min the equation gives into absolute L/min
  acsmCoefficient: 0.2,  // mL O2 per kg per metre run (ACSM running equation)
  acsmIntercept: 3.5,    // resting VO2, mL/kg/min — 1 MET
};
