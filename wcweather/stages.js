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
    id: 'how-hot',
    type: 'mcq',
    title: 'How hot will it actually get on the pitch?',
    blurb: 'Pitch-side dry-bulb temperature during a noon kick-off at the hottest venue.',
    options: [
      { id: 'under-30', label: 'Under 30 °C' },
      { id: '30-35',    label: '30–35 °C' },
      { id: '35-40',    label: '35–40 °C' },
      { id: 'over-40',  label: 'Over 40 °C' }
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
