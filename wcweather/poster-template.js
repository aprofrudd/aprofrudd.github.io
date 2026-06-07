// Lesson-specific poster template for the World Cup 2026 heat lesson.
//
// poster.js (generic) reads each student's answers from localStorage, turns
// them into short prose fragments using the `phrases` maps below, assembles an
// answer object `a`, and feeds it to each section's `body(a)` function.
//
// Authoring rules (learned the hard way):
//   - Keep phrase fragments SHORT and lower-case so they read mid-sentence
//     ("a racing heart", not "Tachycardia (racing heart)").
//   - Every answer-derived value has a graceful fallback in poster.js, so a
//     student who skipped a stage still gets a coherent sentence.
//   - References are the VERIFIED citations already used in the lesson.
//     Never invent author lists, years, or page numbers.

window.POSTER = {
  defaultTitle: 'How hot will the 2026 FIFA World Cup be — and can players cope?',

  // Poster header kicker + byline suffix.
  kicker: 'FIFA World Cup 2026 · Heat & Player Health',

  // "Enter the competition" button + consent wording.
  competition: {
    bylineTag:   'CASES Outreach 2026',
    entryLabel:  '🏆 Enter the competition',
    enteredLabel:'Entered ✓ — good luck!',
    consent:     'Entering sends your name, school and poster text to your teacher for the CASES Outreach competition. Your answers are not shared with anyone else.'
  },

  // Per-stage maps: choice id -> mid-sentence prose fragment.
  // `a.<key>` in the sections is built by poster.js from these.
  answers: [
    // map stage: the chosen city's name is resolved from cities.js, so no
    // phrase map needed — poster.js handles `map` stages directly.
    { key: 'hotCity',      stage: 'hottest-city', type: 'cityName',
      fallback: 'one of the southern venues' },

    { key: 'timeOfDay',    stage: 'time-of-day',  type: 'single',
      fallback: 'the middle of the day',
      phrases: { '9am': '9 am', '12pm': 'midday', '6pm': '6 pm', '9pm': '9 pm' } },

    { key: 'seriousSigns', stage: 'most-serious', type: 'list',
      fallback: 'several warning signs',
      phrases: {
        dizziness:   'dizziness',
        headache:    'headache',
        nausea:      'nausea',
        weakness:    'unsteadiness and weakness',
        tachycardia: 'a racing heart',
        cramps:      'muscle cramps',
        fatigue:     'fatigue',
        cns:         'CNS dysfunction (confusion, collapse, seizure)',
        'high-tc':   'a core temperature above 40 °C'
      } },

    { key: 'fifaVerdict',  stage: 'fifa-break',   type: 'single',
      fallback: 'more needs to be done to keep players safe',
      phrases: {
        'yes-enough': 'a 3-minute cooling break per half is enough to keep players safe',
        'too-short':  'the 3-minute cooling break is too short to keep players safe',
        'too-few':    'players need more than one cooling break per half',
        'reschedule': 'afternoon kick-offs cannot be made safe by breaks alone and should be rescheduled'
      } }
  ],

  sections: [
    {
      heading: 'The Problem',
      body: a => `The 2026 FIFA World Cup will be played across the USA, Canada and Mexico in June and July — the hottest months of the year. Before seeing any data, I predicted that the hottest match would be played in ${a.hotCity}.`
    },
    {
      heading: 'The Evidence',
      figure: 'media/pacha-2025-wbgt-map.png',
      figureCaption: 'Average WBGT per host venue (Mullan et al., 2025).',
      body: a => `Research by Mullan et al. (2025) predicted average match-day temperatures above 32 °C at the three hottest venues — Dallas, Houston and Monterrey. Heat stress is measured using the Wet-Bulb Globe Temperature (WBGT), and the danger threshold is most often exceeded around ${a.timeOfDay}.`
    },
    {
      heading: 'Players at Risk',
      figure: 'media/heat-illness-infographic.jpeg',
      figureCaption: 'Heat illness can escalate to heat stroke (Esh et al., 2026).',
      body: a => `Focusing on Scotland v Brazil in Miami, I identified ${a.seriousSigns} as the most serious signs of heat illness. Left unchecked, exertional heat illness can escalate to exertional heat stroke — a medical emergency that can be fatal within minutes (Esh et al., 2026).`
    },
    {
      heading: 'My Conclusion',
      body: a => `FIFA currently mandates a 3-minute cooling break per half when the WBGT exceeds 32 °C. Having looked at the evidence, I concluded that ${a.fifaVerdict}. Protecting players in extreme heat is a growing challenge for global sport.`
    }
  ],

  references: [
    'Mullan, D., Barr, I., Brannigan, N. et al. (2025). Extreme heat risk and the potential implications for the scheduling of football matches at the 2026 FIFA World Cup. International Journal of Biometeorology, 69, 753–763.',
    'Esh, C.J., Carter, S., Bougault, V. et al. (2026). The 2026 Men’s FIFA Football World Cup: Evidence-Based Guidelines to Protect Player Health and Performance from Environmental Challenges. Sports Medicine.'
  ],

  footer: 'Created in Dr Alan Ruddock’s World Cup Heat lesson · Sheffield Hallam University'
};
