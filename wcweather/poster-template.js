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
  defaultTitle: 'How hot will the 2026 FIFA World Cup be - and can players cope?',

  // Poster header kicker + byline suffix.
  kicker: 'FIFA World Cup 2026 · Heat & Player Health',

  // Small logos shown in the poster's top-right corner (and captured into the
  // downloaded PNG). Order = left→right.
  logos: ['media/school-logo.png', 'media/cases-logo.png'],

  // "Enter the competition" button + consent wording.
  competition: {
    bylineTag:   'CASES Outreach 2026',
    entryLabel:  '🏆 Enter the competition',
    enteredLabel:'Entered ✓ - good luck!',
    consent:     'Entering sends your name, school and poster text to your teacher for the CASES Outreach competition. Your answers are not shared with anyone else.'
  },

  // Per-stage maps: choice id -> mid-sentence prose fragment.
  // `a.<key>` in the sections is built by poster.js from these.
  answers: [
    // map stage: the chosen city's name is resolved from cities.js, so no
    // phrase map needed - poster.js handles `map` stages directly.
    { key: 'hotCity',      stage: 'hottest-city', type: 'cityName',
      fallback: 'one of the southern venues' },

    { key: 'timeOfDay',    stage: 'time-of-day',  type: 'single',
      fallback: 'the middle of the day',
      phrases: { '9am': '9 am', '12pm': 'midday', '6pm': '6 pm', '9pm': '9 pm' } },

    { key: 'hotFixtures',  stage: 'fixtures',     type: 'list',
      fallback: 'the evening kick-offs in Miami and Monterrey',
      phrases: {
        'sa-uru-mia-1800':  'Saudi Arabia v Uruguay in Miami',
        'swe-tun-mty-2000': 'Sweden v Tunisia in Monterrey',
        'tun-jpn-mty-2200': 'Tunisia v Japan in Monterrey',
        'uru-cpv-mia-1800': 'Uruguay v Cape Verde in Miami',
        'sco-bra-mia-1800': 'Scotland v Brazil in Miami',
        'rsa-kor-mty-1900': 'South Africa v South Korea in Monterrey',
        'col-prt-mia-1930': 'Colombia v Portugal in Miami'
      } },

    { key: 'seriousSigns', stage: 'most-serious', type: 'list',
      fallback: 'several warning signs',
      phrases: {
        dizziness:   'dizziness',
        headache:    'headache',
        nausea:      'nausea',
        tachycardia: 'a racing heart',
        cramps:      'muscle cramps',
        cns:         'confusion, collapse or seizure'
      } },

    { key: 'performance',  stage: 'performance-effect', type: 'single',
      fallback: 'changes how hard players are able to run',
      phrases: {
        'less-highint': 'cuts the high-intensity running and sprinting that decide matches',
        'less-total':   'reduces the total distance players can cover',
        'no-change':    'has little measurable effect on how players move',
        'more-sprint':  'pushes players to sprint even more to finish games quickly'
      } },

    { key: 'fifaVerdict',  stage: 'fifa-break',   type: 'single',
      fallback: 'more needs to be done to keep players safe',
      phrases: {
        'yes-enough': 'these measures are enough to keep players safe',
        'too-short':  'the cooling breaks are too short to keep players safe',
        'too-few':    'players need more cooling breaks per half',
        'reschedule': 'afternoon kick-offs cannot be made safe by breaks alone'
      } },

    { key: 'recommendations', stage: 'recommendations', type: 'list',
      fallback: 'longer cooling breaks and rescheduling games to cooler times of day',
      phrases: {
        'longer-breaks': 'longer or more frequent cooling breaks',
        'reschedule':    'moving kick-offs to the evening or night',
        'longer-half':   'extending half-time in extreme heat',
        'indoor':        'playing at indoor or air-conditioned venues',
        'acclimatise':   'heat-acclimatisation training beforehand',
        'hydration':     'aggressive hydration and ice strategies',
        'postpone':      'postponing matches above a heat limit'
      } }
  ],

  sections: [
    {
      heading: 'The Problem',
      wide: true,
      body: a => `The 2026 FIFA World Cup will be played across the USA, Canada and Mexico in June and July - the hottest months of the year. Before seeing any data, I predicted that the hottest match would be played in ${a.hotCity}. From the fixture list, the games I judged most exposed to heat were ${a.hotFixtures}.`
    },
    {
      heading: 'The Evidence',
      figure: 'media/pacha-2025-wbgt-map.png',
      figureCaption: 'Average WBGT per host venue (Mullan et al., 2025).',
      body: a => `Research by Mullan et al. (2025) predicted average match-day temperatures above 32°C at the three hottest venues - Dallas, Houston and Monterrey. Heat stress is measured using the Wet-Bulb Globe Temperature (WBGT), and the danger threshold is most often exceeded around ${a.timeOfDay}.`
    },
    {
      heading: 'Players at Risk',
      figure: 'media/heat-illness-infographic.jpeg',
      figureCaption: 'Heat illness can escalate to heat stroke (Esh et al., 2026).',
      body: a => `Focusing on Scotland v Brazil in Miami, I identified ${a.seriousSigns} as the most serious signs of heat illness. Left unchecked, exertional heat illness can escalate to exertional heat stroke - a medical emergency that can be fatal within minutes (Esh et al., 2026). Heat does not only threaten health: looking at performance data from the 2014 World Cup (Nassis et al., 2015), I concluded that heat ${a.performance}.`
    },
    {
      heading: 'My Conclusion',
      wide: true,
      body: a => `FIFA’s measures to protect players include cooling breaks, WBGT monitoring and climate-controlled benches. Having looked at the evidence, I concluded that ${a.fifaVerdict}. To better protect players I would recommend ${a.recommendations}. Protecting players in extreme heat is a growing challenge for global sport.`
    }
  ],

  references: [
    'Mullan, D., Barr, I., Brannigan, N. et al. (2025). Extreme heat risk and the potential implications for the scheduling of football matches at the 2026 FIFA World Cup. International Journal of Biometeorology, 69, 753-763.',
    'Esh, C.J., Carter, S., Bougault, V. et al. (2026). The 2026 Men’s FIFA Football World Cup: Evidence-Based Guidelines to Protect Player Health and Performance from Environmental Challenges. Sports Medicine.',
    'Nassis, G.P., Brito, J., Dvorak, J. et al. (2015). The association of environmental heat stress with performance: analysis of the 2014 FIFA World Cup Brazil. British Journal of Sports Medicine, 49(9), 609-613.'
  ],

  footer: 'Created in Dr Alan Ruddock’s World Cup Heat lesson · Sheffield Hallam University'
};
