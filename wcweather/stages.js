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
      highlightTop: 3
    },
    quote: 'Three venues — Dallas, Houston, Monterrey — average above 32 °C. Monterrey is the only outdoor venue in that top three, and it also sits at 64% relative humidity.',
    citation: 'Pacha, Watanabe, Hosokawa &amp; Casa, 2025 — Int. J. Biometeorology',
    link: 'https://link.springer.com/article/10.1007/s00484-025-02852-4',
    sideFigure: 'media/pacha-2025-wbgt-map.png',
    sideFigureCaption: 'Average WBGT (wet-bulb globe temperature) per host venue, June–July match window. Circle size scales with WBGT. The same data the table summarises, but mapped geographically.'
  },

  {
    id: 'how-hot',
    type: 'mcq',
    title: 'How hot does it actually feel on the pitch?',
    blurb: 'Ambient temperature is one thing — on a sunny pitch in direct sun, the effective heat load (WBGT or "feels-like") can be considerably higher. What\'s your best guess for the gap?',
    options: [
      { id: 'same',       label: 'Roughly the same as ambient' },
      { id: 'plus-3-5',   label: '+3 to +5 °C above ambient' },
      { id: 'plus-5-10',  label: '+5 to +10 °C above ambient' },
      { id: 'plus-10',    label: 'More than +10 °C above ambient' }
    ]
  },

  {
    id: 'body-response',
    type: 'mcq',
    title: 'What happens to the body when it gets hot?',
    blurb: 'Pick the response you think dominates during 90 minutes of football in the heat.',
    options: [
      { id: 'skin-bf-up', label: 'Skin blood flow rises and core temperature rises' },
      { id: 'sweat-only', label: 'Sweat rate rises but core temperature stays flat' },
      { id: 'cv-drift',   label: 'Cardiovascular drift — heart rate climbs at the same workload' },
      { id: 'all-above',  label: 'All of the above' }
    ]
  },

  {
    id: 'performance',
    type: 'mcq',
    title: 'What happens to performance?',
    blurb: 'Compared to a 20 °C match, how do high-intensity actions change in 35+ °C?',
    options: [
      { id: 'no-change',  label: 'No meaningful change' },
      { id: 'sprint-down',label: 'Sprint distance falls but technical actions hold up' },
      { id: 'both-down',  label: 'Both running and technical actions fall' },
      { id: 'tactical',   label: 'Players just pace themselves — tempo drops' }
    ]
  },

  {
    id: 'heat-balance',
    type: 'media',
    title: 'The heat balance equation',
    blurb: 'S = M − (E ± R ± C ± K) − W',
    video: 'media/heat-balance.mp4',
    poster: 'media/heat-balance-poster.png'
  },

  {
    id: 'core-temp',
    type: 'media',
    title: 'Core temperature and sweat rate',
    blurb: 'What rising ambient temperature does to core temperature, sweat rate, and the cardiovascular response.',
    video: 'media/core-temp.mp4',
    poster: 'media/core-temp-poster.png'
  },

  {
    id: 'paper',
    type: 'content',
    title: 'The evidence — players at risk',
    figure: 'media/paper-figure.png',
    quote: 'Pull quote from the research paper / FIFPRO letter goes here. Replace with the exact wording you want to project.',
    citation: 'Author et al., Year'
  },

  {
    id: 'fifa-break',
    type: 'mcq',
    title: 'Is FIFA’s cooling break enough?',
    blurb: 'FIFA mandates a 3-minute cooling break per half when WBGT exceeds 32 °C. Based on what we’ve just seen — is that enough?',
    options: [
      { id: 'yes-enough',     label: 'Yes — 3 minutes per half is enough' },
      { id: 'too-short',      label: 'No — the break is too short' },
      { id: 'too-few',        label: 'No — need more breaks per half' },
      { id: 'reschedule',     label: 'Move the kick-off — afternoon games can’t be made safe by breaks' }
    ]
  }
];

window.STAGES = STAGES;
