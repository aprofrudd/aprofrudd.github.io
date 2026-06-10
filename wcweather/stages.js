// Lesson stages, in order. The teacher advances stage-by-stage from the
// projector. Phones subscribe to the current stage index and render the right
// UI. Stage types:
//   map     - tap a city on the map
//   mcq     - multiple choice with 2-6 options
//   media   - play a video, no voting
//   content - show a figure + quote (research stage), no voting

const STAGES = [
  {
    id: 'hottest-city',
    type: 'map',
    title: 'Where will the hottest match be?',
    blurb: 'Pick the World Cup 2026 host city you think will see the highest pitch-side temperature during a match.',
    // options for map stages are the city ids — populated automatically from CITIES
  },

  {
    id: 'predicted-temps',
    type: 'content',
    title: 'What the science predicts',
    blurb: 'Average match-day ambient temperature (Ta) and relative humidity (RH) at each host venue. Top three hottest are highlighted.',
    table: {
      headers: ['Host city', 'Ambient °C', 'RH %', 'Indoor'],
      rows: [
        ['Dallas',        '32.7', '47', 'Yes'],
        ['Houston',       '32.0', '76', 'Yes'],
        ['Monterrey',     '32.0', '64', 'No'],
        ['Atlanta',       '29.7', '54', 'Yes'],
        ['Miami',         '29.3', '71', 'No'],
        ['Kansas City',   '28.9', '55', 'No'],
        ['Philadelphia',  '28.2', '61', 'No'],
        ['Guadalajara',   '27.4', '48', 'No'],
        ['Los Angeles',   '26.8', '43', 'Yes'],
        ['New York / NJ', '26.4', '68', 'No'],
        ['Boston',        '25.5', '69', 'No'],
        ['San Francisco', '24.5', '52', 'No'],
        ['Toronto',       '23.9', '68', 'No'],
        ['Seattle',       '20.6', '57', 'No'],
        ['Mexico City',   '19.4', '57', 'No'],
        ['Vancouver',     '19.1', '62', 'No']
      ],
      highlightTop: 5
    },
    quote: 'Three venues — Dallas, Houston, Monterrey — average above 32 °C. Monterrey is the only outdoor venue in that top three, and it also sits at 64% relative humidity.',
    citation: 'Mullan, Barr, Brannigan et al., 2025 — Int J Biometeorol 69, 753–763',
    link: 'https://doi.org/10.1007/s00484-025-02852-4',
    sideFigure: 'media/pacha-2025-wbgt-map.png',
    sideFigureCaption: 'Average WBGT (wet-bulb globe temperature) per host venue, June–July match window. Circle size scales with WBGT. The same data the table summarises, but mapped geographically.'
  },

  {
    id: 'time-of-day',
    type: 'mcq',
    title: 'In Monterrey and Miami, when is WBGT most likely to exceed 28 °C?',
    blurb: 'Look at the Monterrey (MON) and Miami (MIA) panels in the figure — when do the orange bars (WBGT &gt; 28 °C) peak?',
    figure: 'media/pacha-2025-figure-3.png',
    figureCaption: 'Percentage of days during the match window in which average WBGT exceeded 26 °C (yellow), 28 °C (orange) or 32 °C (red), by hour of day, at each host venue. From Mullan et al., 2025.',
    options: [
      { id: '9am',  label: '9 am' },
      { id: '12pm', label: '12 pm' },
      { id: '6pm',  label: '6 pm' },
      { id: '9pm',  label: '9 pm' }
    ]
  },

  {
    id: 'fixtures',
    type: 'mcq',
    title: 'Look at the games scheduled in Monterrey and Miami. Based on local kickoff time, which three fixtures do you think will be played in the hottest conditions?',
    blurb: 'Pick up to three. All kickoffs are in the evening — but look at Figure 3 from the last question: Miami\'s WBGT exceedance bars are still elevated at 18:00.',
    maxSelect: 3,
    options: [
      { id: 'sa-uru-mia-1800',  label: '🇸🇦 Saudi Arabia v Uruguay 🇺🇾',     sublabel: 'Miami · 18:00' },
      { id: 'swe-tun-mty-2000', label: '🇸🇪 Sweden v Tunisia 🇹🇳',           sublabel: 'Monterrey · 20:00' },
      { id: 'tun-jpn-mty-2200', label: '🇹🇳 Tunisia v Japan 🇯🇵',            sublabel: 'Monterrey · 22:00' },
      { id: 'uru-cpv-mia-1800', label: '🇺🇾 Uruguay v Cape Verde 🇨🇻',       sublabel: 'Miami · 18:00' },
      { id: 'sco-bra-mia-1800', label: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland v Brazil 🇧🇷',          sublabel: 'Miami · 18:00' },
      { id: 'rsa-kor-mty-1900', label: '🇿🇦 South Africa v South Korea 🇰🇷', sublabel: 'Monterrey · 19:00' },
      { id: 'col-prt-mia-1930', label: '🇨🇴 Colombia v Portugal 🇵🇹',        sublabel: 'Miami · 19:30' }
    ]
  },

  {
    id: 'heat-illness-infographic',
    type: 'content',
    title: 'Scotland v Brazil, Miami — when a player overheats',
    blurb: 'Two escalating syndromes. Exertional heat illness (amber) is the warning stage. Exertional heat stroke (red) is a medical emergency.',
    figure: 'media/heat-illness-infographic.jpeg',
    citation: 'Signs from Esh, Carter, Bougault et al., 2026 — Sports Medicine, Table 1',
    link: 'https://doi.org/10.1007/s40279-026-02398-4'
  },

  {
    id: 'most-serious',
    type: 'mcq',
    title: 'Which THREE of these signs do you think are the most serious?',
    blurb: 'Pick up to three. We’ll compare your picks with what the medicine treats as genuinely life-threatening.',
    maxSelect: 3,
    figure: 'media/heat-illness-infographic.jpeg',
    figureCaption: 'Exertional heat illness (amber) vs exertional heat stroke (red). From Esh et al., 2026.',
    options: [
      { id: 'dizziness',   label: 'Dizziness' },
      { id: 'headache',    label: 'Headache' },
      { id: 'nausea',      label: 'Nausea' },
      { id: 'tachycardia', label: 'Tachycardia (racing heart)' },
      { id: 'cramps',      label: 'Muscle cramps' },
      { id: 'cns',         label: 'Confusion, collapse, seizure' }
    ]
  },

  {
    id: 'fifa-measures',
    type: 'content',
    title: 'So what is FIFA doing about it?',
    blurb: 'Football’s governing body has brought in measures to protect players in the heat. Three of the main ones:',
    table: {
      headers: ['Measure', 'What it does'],
      rows: [
        ['Cooling breaks', '~3-minute breaks in each half when it’s hot, so players can drink and lower their body temperature'],
        ['WBGT monitoring', 'Heat stress (Wet-Bulb Globe Temperature) is measured pitch-side to decide when cooling breaks apply'],
        ['Climate-controlled benches', 'Air-cooled substitute and bench areas that limit heat gain when players are off the pitch']
      ]
    }
  },

  {
    id: 'fifa-break',
    type: 'mcq',
    title: 'Are these measures enough?',
    blurb: 'You’ve seen what FIFA does — cooling breaks, WBGT monitoring, climate-controlled benches. Based on everything today, is it enough to keep players safe?',
    options: [
      { id: 'yes-enough',     label: 'Yes — these measures are enough' },
      { id: 'too-short',      label: 'No — the cooling breaks are too short' },
      { id: 'too-few',        label: 'No — players need more breaks per half' },
      { id: 'reschedule',     label: 'No — afternoon games can’t be made safe by breaks alone' }
    ]
  },

  {
    id: 'recommendations',
    type: 'mcq',
    title: 'You’re advising FIFA — what would you bring in? (pick 3)',
    blurb: 'Pick the three changes you think would best protect players in extreme heat.',
    maxSelect: 3,
    options: [
      { id: 'longer-breaks', label: 'Longer or more frequent cooling breaks' },
      { id: 'reschedule',    label: 'Move kick-offs to the evening or night' },
      { id: 'longer-half',   label: 'Extend half-time in extreme heat' },
      { id: 'indoor',        label: 'Play at indoor / air-conditioned venues' },
      { id: 'acclimatise',   label: 'Heat-acclimatisation training beforehand' },
      { id: 'hydration',     label: 'Aggressive hydration & ice strategies' },
      { id: 'postpone',      label: 'Postpone matches above a heat limit' }
    ]
  },

  {
    id: 'poster',
    type: 'poster',
    title: 'Build your research poster',
    blurb: 'Turn your answers into an academic poster for the CASES Outreach competition.',
    href: 'poster.html'
  }
];

window.STAGES = STAGES;
