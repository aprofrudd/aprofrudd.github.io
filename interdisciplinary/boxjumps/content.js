// All session content lives here. Pages are lists of declarative blocks that app.js renders.
//
// Saved, team-level blocks
//   field     { id, label, hint, rows, tone }       textarea (keep these few and short)
//   short     { id, label, placeholder }            one-line input
//   rating    { id, label, max }                    1..max buttons
//   choice    { id, label, options }                one option for the team
//   chips     { id, label, hint, options }          tap to toggle several options
//   list      { id, label, hint, disc, when, also, placeholder }
//             each item is its own row, so teammates can add at the same time. disc: 'phys'|'bio'|'psy'|'oth'|'choose'
//   matrix    { id, lists }                         2x2 impact x changeable-today grid; top-right = priorities
//   sorter    { id, lists, label, cats, rings }     tap an item, then tap a category (rings = nested Bronfenbrenner layout)
//   web       { id, lists, label, verbs, example }  link items across disciplines with a verb
//   itemChoice{ attr, lists, label, options }       one choice per item (e.g. predicted effect)
//   claim     { id, label }                         "We think [strategy] will change [variable] because [mechanism]..."
//   rule      { id, label }                         "If [variable] [direction], then we will [action]"
//   varMethods{}                                    method for each chosen variable (needs chips 'var')
//   roles     {}                                    team roles assigned to members
//   athletePick { lists }                           athlete taps what they think matters most
//   prepost   { id, label }                         CMJ before/after for each athlete
//   compare   {}                                    estimated box vs the box the athlete *perceives* they can clear
//   calc      {}                                    plyobox height estimator
//   attempts  { phase }                             jump log ('box' | 'optojump')
//   spectrum  {}                                    sort examples into mono/multi/inter/trans
//   questions { items: [{ id, q, tag }] }           reflective question set
//
// Per-person blocks (every device votes; the whole team sees the spread)
//   vote      { id, label, options, scale }
//
// Read-only blocks
//   note { html } | columns { blocks } | lens { fw, text, q } | frameworkMap {} | starred { lists, label }
//   athleteView { lists } | timeline { list } | pull { list, label } | predictCompare {} | rotation {} | teamlink {}

export const DISC = {
  phys: { label: 'Physiology', short: 'Phys' },
  bio: { label: 'Biomechanics', short: 'Biomech' },
  psy: { label: 'Psychology', short: 'Psych' },
  oth: { label: 'Social / other', short: 'Social' },
};

export const BOXES = [
  { cm: 50.8, label: '51 cm' },
  { cm: 60.96, label: '61 cm' },
  { cm: 76.2, label: '76 cm' },
];

export const WHEN = [
  { id: 'warmup', label: 'Warm-up / preparation' },
  { id: 'before', label: 'Just before each attempt' },
  { id: 'during', label: 'During the jump (cue)' },
  { id: 'after', label: 'After each attempt (feedback)' },
  { id: 'between', label: 'Between attempts (rest)' },
];

export const PHASES = [
  { id: 'describe', label: 'Describe', q: 'What variables will you assess?' },
  { id: 'analyse', label: 'Analyse', q: 'What data will you obtain?' },
  { id: 'prescribe', label: 'Prescribe', q: 'What strategies will you use?' },
  { id: 'optimise', label: 'Optimise', q: 'How will you use the data to improve performance?' },
  { id: 'revise', label: 'Revise', q: 'How will you evaluate the process?' },
];

export const VARS = [
  { id: 'cmj', label: 'CMJ height', d: 'phys' },
  { id: 'rfd', label: 'Rate of force development', d: 'phys' },
  { id: 'peakforce', label: 'Peak force', d: 'phys' },
  { id: 'readiness', label: 'Fatigue / readiness', d: 'phys' },
  { id: 'trunk', label: 'Trunk angle', d: 'bio' },
  { id: 'knee', label: 'Knee angle at take-off', d: 'bio' },
  { id: 'cmdepth', label: 'Countermovement depth', d: 'bio' },
  { id: 'hip', label: 'Hip displacement / trajectory', d: 'bio' },
  { id: 'takeoff', label: 'Take-off angle', d: 'bio' },
  { id: 'arms', label: 'Arm swing', d: 'bio' },
  { id: 'conf', label: 'Confidence', d: 'psy' },
  { id: 'anxiety', label: 'Anxiety / fear', d: 'psy' },
  { id: 'focus', label: 'Attentional focus', d: 'psy' },
  { id: 'perceived', label: 'Perceived jumpable height', d: 'psy' },
  { id: 'audience', label: 'Audience / peer pressure', d: 'oth' },
  { id: 'recovery', label: 'Sleep / recovery', d: 'oth' },
  { id: 'fuel', label: 'Nutrition / hydration', d: 'oth' },
];

export const METHODS = ['Optojump', 'Force plate', 'Video analysis', 'Rating scale / questionnaire', 'Conversation / interview', 'Observation', 'Box outcome'];

export const EFFECT = [
  { id: '-1', label: 'Made it worse' },
  { id: '0', label: 'No effect' },
  { id: '1', label: 'Small gain' },
  { id: '2', label: 'Big gain' },
];

export const ROLES = [
  { id: 'lead', label: 'Leads with the athlete' },
  { id: 'recorder', label: 'Records the data' },
  { id: 'timer', label: 'Keeps time' },
  { id: 'critic', label: 'Critical friend (challenges ideas)' },
  { id: 'integrator', label: 'Integrator (checks the disciplines are connecting)' },
];

export const MODEL_URL = 'https://www.bases.org.uk/imgs/9729_bas_bases_tses_winter_2022_online___rw_pg20_21291.pdf';
export const EMAIL = 'a.ruddock@shu.ac.uk';
export const SLOT_MIN = 15;

export const LIM = ['lim_phys', 'lim_bio', 'lim_psy', 'lim_soc'];
export const SPECTRUM_OPTS = [
  { id: 'mono', label: 'Mono' }, { id: 'multi', label: 'Multi' }, { id: 'inter', label: 'Inter' }, { id: 'trans', label: 'Trans' },
];

const crossPsy = (id, hint) => ({ type: 'field', id, tone: 'psy', label: 'Don’t forget psychology…', hint, rows: 2 });
const crossBio = (id, hint) => ({ type: 'field', id, tone: 'bio', label: 'Don’t forget biomechanics…', hint, rows: 2 });
const crossPhys = (id, hint) => ({ type: 'field', id, tone: 'phys', label: 'Don’t forget physiology…', hint, rows: 2 });

export const PAGES = [
  // ================================================================ Start
  {
    id: 'home', group: 'Start', title: 'The challenge', short: 'The challenge',
    phases: [],
    blocks: [
      { type: 'teamcard' },
      { type: 'note', html: `
        <p class="lead">Help your athlete jump onto the highest plyometric box they can: <strong>51, 61 or 76&nbsp;cm</strong>.</p>
        <p>The box is both a <strong>constraint</strong> on performance and a <strong>barrier</strong> to it. Clearing it depends on physiology, technique and belief all at once, so no single discipline can solve it alone.</p>
        <p>Your team is a <strong>performance cell</strong>. Each of you brings a discipline, and the aim is to work <em>interdisciplinarily</em>: not experts side by side in silos, but one team whose ideas change each other.</p>` },
      { type: 'note', html: `
        <h3>How the day runs</h3>
        <ol class="flow">
          <li><span class="flow-tag">Start · 10 min</span><strong>Frameworks.</strong> Explore the interdisciplinary frameworks you’ll use as lenses all day.</li>
          <li><span class="flow-tag">Session 1 · 90 min</span><strong>Plan.</strong> Define the problem, understand your athlete, build a plan and a support process.</li>
          <li><span class="flow-tag">Session 2 · Part 1 · 90 min</span><strong>Stations.</strong> Rotate around six 15-minute stations to test strategies and collect data.</li>
          <li><span class="flow-tag">Session 2 · Part 2</span><strong>Box challenge.</strong> Put your best strategies together on the boxes, then on the Optojump.</li>
          <li><span class="flow-tag">Afterwards</span><strong>Screencast.</strong> A 5-minute team screencast of your support process and how well you worked together.</li>
        </ol>` },
      { type: 'note', html: `
        <h3>The scientific support model</h3>
        <p>Everything you do today maps onto the five phases of the <a href="${MODEL_URL}" target="_blank" rel="noopener">Ruddock model of scientific support</a>. The tags at the top of each page show which phase you’re in.</p>
        <div class="phase-strip">${PHASES.map((p, i) => `<div class="phase-cell"><span class="phase-n">${i + 1}</span><strong>${p.label}</strong><span>${p.q}</span></div>`).join('')}</div>` },
      { type: 'note', html: `
        <h3>Why this matters for your assessments</h3>
        <ul>
          <li><strong>Assessment 1 (critique):</strong> you’ll evaluate mono-, multi- and interdisciplinary definitions, critique frameworks, and draw a flow chart showing how data becomes information a support team can act on. Today you practise all three.</li>
          <li><strong>Assessment 2 (presentation):</strong> you’ll argue from one discipline’s frameworks, then show how other disciplines make your intervention more effective. That’s exactly what your cell does today.</li>
        </ul>` },
    ],
  },
  {
    id: 'frameworks', group: 'Start', title: 'Interdisciplinary frameworks', short: 'Frameworks', mins: 10,
    phases: [],
    blocks: [
      { type: 'note', html: `<p>Frameworks are <strong>lenses</strong>: each one makes you notice different things about the same problem. Tap a framework on the map to explore it. You’ll meet each one again as a <span class="lens-inline">lens</span> card on the pages where it’s most useful.</p>` },
      { type: 'frameworkMap' },
      { type: 'note', html: `<h2>Mono, multi, inter or trans?</h2><p>As a team, decide where each example sits. Then compare your answer with the explanation.</p>` },
      { type: 'spectrum' },
      { type: 'vote', id: 'spectrum_start', label: 'Before you start: where do you expect your team to sit today?', hint: 'Everyone votes on their own device. You’ll vote again at the end.', options: SPECTRUM_OPTS, scale: true },
    ],
  },

  // ================================================================ Session 1
  {
    id: 's1-1', group: 'Session 1 · Plan', title: 'Task 1 · Self-organise', short: '1 · Self-organise', mins: 5,
    phases: [],
    blocks: [
      { type: 'note', html: `<p>Form an interdisciplinary team of about <strong>5–7</strong>. Each of you identifies as a <strong>discipline specialist</strong>. Aim for every discipline to be represented.</p>` },
      { type: 'list', id: 'members', label: 'Who’s in the team?', hint: 'Each person adds themselves (first name or initials only) and picks the discipline they’re representing.', disc: 'choose', placeholder: 'First name or initials' },
      { type: 'lens', fw: ['systems'], text: 'Your team is a system, not a collection of individuals. What it produces depends on the connections between members as much as on what each person knows.', q: 'Which disciplines are missing or doubled up, and what does that mean for the connections?' },
    ],
  },
  {
    id: 's1-2', group: 'Session 1 · Plan', title: 'Task 2 · Your shared workspace', short: '2 · Workspace', mins: 5,
    phases: [],
    blocks: [
      { type: 'note', html: `<p><strong>This site is your team’s shared drive, slide deck and data sheet.</strong> Everyone should open it on their own phone or laptop and join the same team. Everything saves live.</p>` },
      { type: 'teamlink' },
      { type: 'roles' },
    ],
  },
  {
    id: 's1-3', group: 'Session 1 · Plan', title: 'Task 3 · Understand and define the challenge', short: '3 · Define the challenge', mins: 20,
    phases: ['describe'],
    blocks: [
      { type: 'note', html: `<p>Choose one or two of your group to be the <strong>athletes</strong>. Your challenge is to get them onto the highest box: <strong>50.8, 60.96 or 76.2&nbsp;cm</strong>.</p>` },
      { type: 'columns', blocks: [
        { type: 'short', id: 'athlete1', label: 'Athlete 1', placeholder: 'First name or initials' },
        { type: 'short', id: 'athlete2', label: 'Athlete 2 (optional)', placeholder: 'First name or initials' },
      ] },
      { type: 'note', html: `<h3>Step 1 · List every potential limiter</h3><p>Sort them by discipline. For example, <em>trunk angle will influence hip trajectory</em> is a biomechanical limiter.</p>` },
      { type: 'lens', fw: ['biopsychosocial'], text: 'Engel’s model says behaviour comes from biological, psychological and social factors interacting. Your cell covers bio and psycho, but who covers social?', q: 'Add at least one social or contextual limiter.' },
      { type: 'columns', blocks: [
        { type: 'list', id: 'lim_phys', label: 'Physiological', disc: 'phys', placeholder: 'Add a limiter' },
        { type: 'list', id: 'lim_bio', label: 'Biomechanical / technical', disc: 'bio', placeholder: 'Add a limiter' },
      ] },
      { type: 'columns', blocks: [
        { type: 'list', id: 'lim_psy', label: 'Psychological', disc: 'psy', placeholder: 'Add a limiter' },
        { type: 'list', id: 'lim_soc', label: 'Social / contextual', disc: 'oth', placeholder: 'e.g. Classmates watching' },
      ] },
      { type: 'note', html: `<h3>Step 2 · Prioritise</h3><p>Which factors will most influence performance, <em>and</em> can you change them in the short term (e.g. with immediate feedback)? Place each limiter on the grid. The top-right box becomes your priorities.</p>` },
      { type: 'matrix', id: 'q', lists: LIM },
      { type: 'note', html: `<h3>Step 3 · Find the interactions</h3><p>Interdisciplinary work happens <em>between</em> disciplines. Link limiters that affect each other, especially across disciplines.</p>` },
      { type: 'web', id: 'limweb', lists: LIM, label: 'Interaction web', example: 'e.g. Fear of catching shins → reduces → Hip height at take-off' },
      { type: 'lens', fw: ['ecodynamics'], text: 'Newell’s constraints model says movement emerges from individual, task and environmental constraints. The box itself is a task constraint.', q: 'Which limiters could you change by changing the task or environment rather than the athlete?' },
      { type: 'sorter', id: 'cons', lists: LIM, label: 'Sort your limiters by constraint type', cats: [
        { id: 'individual', label: 'Individual', hint: 'The athlete: body, skills, beliefs' },
        { id: 'task', label: 'Task', hint: 'The box, rules, instructions, equipment' },
        { id: 'environment', label: 'Environment', hint: 'The room, audience, time, culture' },
      ] },
      { type: 'short', id: 'determinant', label: 'In one sentence: what will determine performance today?', placeholder: 'Performance today will mostly depend on…' },
    ],
  },
  {
    id: 's1-4', group: 'Session 1 · Plan', title: 'Task 4 · Understand your athlete', short: '4 · Your athlete', mins: 20,
    phases: ['describe', 'analyse'],
    blocks: [
      { type: 'note', html: `<p>Talk to your athlete about what determines their performance. <strong>Do they share your view?</strong> In applied practice you need your athlete’s confidence in an intervention for it to work.</p>` },
      { type: 'lens', fw: ['transdisciplinary', 'intersectionality'], text: 'A transdisciplinary team treats the athlete’s lived experience as evidence alongside the data. Intersectionality reminds you that experience is shaped by who the athlete is, not just what they can do.', q: 'What does your athlete know that your data can’t tell you?' },
      { type: 'list', id: 'lim_athlete', label: 'Limiters your athlete raised that you hadn’t listed', disc: 'choose', placeholder: 'Add what the athlete said' },
      { type: 'athletePick', lists: [...LIM, 'lim_athlete'] },
      { type: 'athleteView', lists: LIM },
      { type: 'columns', blocks: [
        { type: 'rating', id: 'conf_base_1', label: 'Athlete 1: how confident they are of clearing 76 cm', max: 10 },
        { type: 'rating', id: 'conf_base_2', label: 'Athlete 2: how confident they are of clearing 76 cm', max: 10 },
      ] },
      { type: 'short', id: 'athlete_confidence', label: 'How will you build their belief in your plan?', placeholder: 'We’ll build belief by…' },
    ],
  },
  {
    id: 's1-5', group: 'Session 1 · Plan', title: 'Task 5 · Create a plan', short: '5 · Plan', mins: 20,
    phases: ['prescribe'],
    blocks: [
      { type: 'starred', lists: [...LIM, 'lim_athlete'], label: 'Your priorities (from Tasks 3 and 4)' },
      { type: 'list', id: 'strategies', label: 'Strategies you’ll target', hint: 'Give each strategy a lead discipline, say when it happens, and tick which <em>other</em> disciplines it also affects.', disc: 'choose', when: true, also: true, placeholder: 'e.g. Isometric squat holds before attempts' },
      { type: 'timeline', list: 'strategies' },
      { type: 'lens', fw: ['complexity'], text: 'In complex systems effects aren’t additive. Two strategies that each help might cancel each other out: a long potentiation protocol could cause fatigue, or a technical cue could increase overthinking.', q: 'Which of your strategies could interfere with each other?' },
      { type: 'web', id: 'stratweb', lists: ['strategies'], label: 'How do your strategies interact?', verbs: ['enhances', 'interferes with', 'depends on', 'must come before'], example: 'e.g. Isometric holds → must come before → Arm swing cue' },
      { type: 'itemChoice', attr: 'pred', lists: ['strategies'], label: 'Predict: what effect will each strategy have?', hint: 'You’ll compare these predictions with what actually happens in the box challenge.', options: EFFECT },
    ],
  },
  {
    id: 's1-6', group: 'Session 1 · Plan', title: 'Task 6 · Create a process', short: '6 · Support process', mins: 20,
    phases: ['describe', 'analyse', 'prescribe', 'optimise', 'revise'],
    blocks: [
      { type: 'note', html: `<p>Fit your strategies into the scientific support structure. This becomes the backbone of your screencast.</p>` },
      { type: 'lens', fw: ['pragmatism', 'systems'], text: 'Describe → Revise is a cycle of inquiry in Dewey’s sense: ideas are judged by their consequences. In systems terms, Optimise and Revise are feedback loops.', q: 'What would count as evidence that your plan worked?' },
      { type: 'chips', id: 'var', label: '1 · Describe: which variables will you assess?', hint: 'Tap all that apply. Aim for every discipline.', options: VARS, tone: 'phase' },
      { type: 'varMethods' },
      { type: 'claim', id: 'claim1', label: '3 · Prescribe: make your case' },
      { type: 'claim', id: 'claim2', label: 'And for a second strategy' },
      { type: 'rule', id: 'rule1', label: '4 · Optimise: decision rules' },
      { type: 'rule', id: 'rule2', label: 'And a second rule' },
      { type: 'chips', id: 'eval', label: '5 · Revise: how will you evaluate the whole process?', hint: 'Think beyond box height.', tone: 'phase', options: [
        { id: 'height', label: 'Box / jump height' }, { id: 'technique', label: 'Technique' }, { id: 'consistency', label: 'Consistency between attempts' },
        { id: 'experience', label: 'The athlete’s experience' }, { id: 'confidence', label: 'Confidence ratings' }, { id: 'process', label: 'How well the team worked' },
        { id: 'predictions', label: 'Predictions vs outcomes' },
      ] },
    ],
  },

  // ================================================================ Session 2, Part 1
  {
    id: 'stations', group: 'Session 2 · Stations', title: 'Station rotation', short: 'Rotation', mins: 90,
    phases: ['analyse', 'prescribe'],
    blocks: [
      { type: 'rotation' },
      { type: 'note', html: `
        <p>Six stations, <strong>15 minutes each</strong>. Start at the station matching your group number, then move one station along each time (6 goes back to 1). At each station you’ll <strong>put a strategy into practice</strong>, <strong>collect data</strong> that might inform one, or <strong>discuss factors</strong> that could influence one.</p>
        <p class="muted">This is the first time this session has run, so we may change things on the day, especially at the force plate and video stations, which involve some data processing.</p>
        <h3>Keep asking</h3>
        <ol class="questions-q"><li>How high can you jump?</li><li>What is your box jump limit?</li><li>Why do you have a limit?</li><li>What strategies can you put in place to improve performance?</li></ol>` },
    ],
  },
  {
    id: 'st-1', group: 'Session 2 · Stations', station: 1, title: 'Station 1 · Psychology', short: '1 · Psychology', mins: 15,
    phases: ['analyse', 'prescribe'], tag: 'psy',
    blocks: [
      { type: 'note', html: `<p>Explore the psychological side of the box jump with your athlete, and try out a strategy that could help.</p>` },
      { type: 'lens', fw: ['biopsychosocial', 'ecological'], text: 'Classmates watching are part of the athlete’s microsystem. Psychological responses don’t happen in a vacuum.', q: 'How much of what your athlete feels is about the box, and how much is about the room?' },
      { type: 'chips', id: 'psy_feel', label: 'As they approach the box, your athlete feels…', options: [
        { id: 'nervous', label: 'Nervous' }, { id: 'excited', label: 'Excited' }, { id: 'doubtful', label: 'Doubtful' }, { id: 'confident', label: 'Confident' },
        { id: 'focused', label: 'Focused' }, { id: 'distracted', label: 'Distracted' }, { id: 'shins', label: 'Afraid of catching shins' }, { id: 'watched', label: 'Self-conscious being watched' },
      ] },
      { type: 'chips', id: 'psy_try', label: 'Strategies you tried', options: [
        { id: 'selftalk', label: 'Self-talk' }, { id: 'imagery', label: 'Imagery' }, { id: 'goals', label: 'Goal setting' }, { id: 'breathing', label: 'Breathing / arousal control' },
        { id: 'external', label: 'External focus cue' }, { id: 'routine', label: 'Pre-performance routine' }, { id: 'modelling', label: 'Watching someone else' },
      ] },
      { type: 'columns', blocks: [
        { type: 'rating', id: 'psy_conf_before', label: 'Athlete confidence before', max: 10 },
        { type: 'rating', id: 'psy_conf_after', label: 'Athlete confidence after', max: 10 },
      ] },
      { type: 'claim', id: 'psy_claim', label: 'Make your case' },
      crossPhys('psy_x_phys', 'Could this strategy change arousal, readiness or effort?'),
      crossBio('psy_x_bio', 'Could it change how they move, e.g. hesitation at take-off or where they focus their attention?'),
    ],
  },
  {
    id: 'st-2', group: 'Session 2 · Stations', station: 2, title: 'Station 2 · Physiology', short: '2 · Physiology', mins: 15,
    phases: ['prescribe'], tag: 'phys',
    blocks: [
      { type: 'note', html: `<p>Using what you know about acute interventions to improve jump performance, <strong>design and test a strategy</strong> with your athlete that would theoretically improve their jump height, e.g. dynamic stretching, isometrics, PNF stretching or another post-activation performance enhancement (PAPE) approach.</p>` },
      { type: 'choice', id: 'phys_type', label: 'Your strategy', options: [
        { id: 'dynamic', label: 'Dynamic stretching' }, { id: 'isometric', label: 'Isometric holds' }, { id: 'pnf', label: 'PNF stretching' },
        { id: 'heavy', label: 'Heavy-load PAPE' }, { id: 'plyo', label: 'Plyometric PAPE' }, { id: 'other', label: 'Something else' },
      ] },
      { type: 'columns', blocks: [
        { type: 'short', id: 'phys_sets', label: 'Sets × reps / duration', placeholder: 'e.g. 3 × 5 s' },
        { type: 'short', id: 'phys_rest', label: 'Rest before jumping', placeholder: 'e.g. 4 min' },
      ] },
      { type: 'prepost', id: 'phys', label: 'Test it: CMJ before and after (cm)' },
      { type: 'lens', fw: ['complexity'], text: 'Potentiation and fatigue happen at the same time. Too little and nothing changes; too much or too soon and performance drops. The dose–response is non-linear and differs between athletes.', q: 'If it didn’t work, was the strategy wrong, or the dose or timing?' },
      crossPsy('phys_x_psy', 'What psychological factors might this strategy influence? Could you build in a psychological strategy, e.g. is there something your athlete is finding worrying?'),
      crossBio('phys_x_bio', 'How will this strategy affect biomechanical factors? Are there technical points you could reinforce while doing it, e.g. trunk angle or key phases of the jump?'),
    ],
  },
  {
    id: 'st-3', group: 'Session 2 · Stations', station: 3, title: 'Station 3 · Force plate & video analysis', short: '3 · Force plate & video', mins: 15,
    phases: ['describe', 'analyse'], tag: 'bio',
    blocks: [
      { type: 'note', html: `<p>Collect jump data using the force plate and the camera. What does it tell you about <em>how</em> your athlete jumps, and what could you change?</p><p class="muted">Work with whatever data you can get in the time. Processing may be rough, and that’s part of the challenge.</p>` },
      { type: 'chips', id: 'fv_obs', label: 'What did you look at?', options: [...VARS.filter((v) => ['phys', 'bio'].includes(v.d)), { id: 'hesitation', label: 'Hesitation before take-off', d: 'psy' }] },
      { type: 'lens', fw: ['dynamical', 'ecodynamics'], text: 'Movement settles into stable patterns (attractors). Variability between attempts can show the athlete exploring, or a pattern about to change.', q: 'Is the variability you see noise, or information?' },
      { type: 'choice', id: 'fv_stability', label: 'Across jumps, the technique was…', options: [{ id: 'stable', label: 'Very consistent' }, { id: 'some', label: 'Slightly variable' }, { id: 'variable', label: 'Very variable' }] },
      { type: 'claim', id: 'fv_claim', label: 'What does the data suggest you change?' },
      crossPhys('fv_x_phys', 'Does the data point to a physical limiter (force, speed, rate of force development)?'),
      crossPsy('fv_x_psy', 'Did anything in the video suggest hesitation or doubt? How would you give this feedback to your athlete?'),
    ],
  },
  {
    id: 'st-4', group: 'Session 2 · Stations', station: 4, title: 'Station 4 · Other disciplines', short: '4 · Other disciplines', mins: 15,
    phases: ['describe', 'prescribe'], tag: 'oth',
    blocks: [
      { type: 'note', html: `<p>Performance doesn’t stop at three disciplines. Ask yourselves these questions. There are no set answers; what matters is the thinking.</p>` },
      { type: 'questions', items: [
        { id: 'oth_pa', tag: 'Physical activity', q: 'What has your athlete done in the last 24–48 hours? Could fatigue or soreness be limiting them today?' },
        { id: 'oth_nutrition', tag: 'Nutrition', q: 'Has your athlete eaten and drunk enough today? Is there anything acute that would be appropriate, and is it within your remit to suggest it?' },
        { id: 'oth_sc', tag: 'S&C / training', q: 'If you had 6–8 weeks rather than an hour, what training would raise this athlete’s ceiling?' },
        { id: 'oth_cell', tag: 'Performance cell', q: 'Who else would you want in your performance cell, and what would they add?' },
      ] },
      { type: 'chips', id: 'oth_time', label: 'Which of these can you influence today?', options: [
        { id: 'pa', label: 'Recent activity / fatigue' }, { id: 'fuel', label: 'Nutrition / hydration' }, { id: 'sc', label: 'Training history' }, { id: 'audience', label: 'Who is watching' }, { id: 'none', label: 'None: these are long-term' },
      ] },
      { type: 'lens', fw: ['ecological'], text: 'Bronfenbrenner places the athlete at the centre of nested systems. Factors further out act indirectly, but they still act.', q: 'Add the factors you discussed, then place each one in the ring it belongs to.' },
      { type: 'list', id: 'eco_factors', label: 'Factors that could affect performance', disc: 'oth', placeholder: 'e.g. Didn’t sleep well, lab timetable, team banter' },
      { type: 'sorter', id: 'ring', lists: ['eco_factors', ...LIM], rings: true, label: 'Where does each factor sit?', cats: [
        { id: 'micro', label: 'Microsystem', hint: 'Immediate settings and people: this team, the room, peers' },
        { id: 'meso', label: 'Mesosystem', hint: 'Links between those settings, e.g. how the scientists and coach work together' },
        { id: 'exo', label: 'Exosystem', hint: 'Settings that act indirectly: lab rules, the timetable, the module' },
        { id: 'macro', label: 'Macrosystem', hint: 'Culture, values and norms, e.g. beliefs about who jumps high' },
      ] },
    ],
  },
  {
    id: 'st-5', group: 'Session 2 · Stations', station: 5, title: 'Station 5 · Review & plan', short: '5 · Review & plan', mins: 15,
    phases: ['optimise', 'revise'], tag: 'oth',
    blocks: [
      { type: 'lens', fw: ['pragmatism'], text: 'For a pragmatist, an idea is only as good as what it does in practice. Keep what worked, change what half-worked, and drop what didn’t, whatever discipline it came from.', q: 'What’s your evidence for each decision?' },
      { type: 'itemChoice', attr: 'keep', lists: ['strategies'], label: 'Your Session 1 strategies: keep, change or drop?', options: [{ id: 'keep', label: 'Keep' }, { id: 'change', label: 'Change' }, { id: 'drop', label: 'Drop' }] },
      { type: 'list', id: 'final_plan', label: 'Your strategy sequence for the box challenge', hint: 'In the order you’ll use them. Include anything new from the stations.', disc: 'choose', when: true, also: true, placeholder: 'Add a strategy' },
      { type: 'itemChoice', attr: 'pred', lists: ['final_plan'], label: 'Predict the effect of each', options: EFFECT },
      { type: 'chips', id: 'judge', label: 'How will you judge whether an attempt improved?', options: [
        { id: 'height', label: 'Box height' }, { id: 'technique', label: 'Technique' }, { id: 'consistency', label: 'Consistency' }, { id: 'confidence', label: 'Athlete confidence' }, { id: 'feel', label: 'How it felt to the athlete' },
      ] },
    ],
  },
  {
    id: 'st-6', group: 'Session 2 · Stations', station: 6, title: 'Station 6 · Optojump', short: '6 · Optojump', mins: 15,
    phases: ['describe', 'analyse'], tag: 'bio',
    blocks: [
      { type: 'note', html: `<p>Measure your athlete’s <strong>countermovement jump (CMJ)</strong> on the Optojump, or use data from the physiology lab, then estimate the highest box they should be able to clear.</p>` },
      { type: 'calc' },
      { type: 'note', html: `<p class="callout"><strong>Limitation:</strong> this simple equation doesn’t account for the <strong>trajectory</strong> of the jump or the <strong>total displacement of the hips</strong>, and both differ between athletes. Treat it as a starting point, not a ceiling.</p>` },
      { type: 'lens', fw: ['ecodynamics'], text: 'Gibson would say the athlete doesn’t see “a 76 cm box”; they see whether it affords jumping onto for <em>them</em>. Perceived and measured capability can differ.', q: 'Ask your athlete: what’s the highest box you think you could jump onto?' },
      { type: 'compare' },
      { type: 'lens', fw: ['intersectionality'], text: 'The equation estimates hip height as 52% of stature for men and 49% for women. Sex is one category, but bodies, training histories and experiences vary within it and overlap across it.', q: 'What does a sex-based equation assume, and who might it fit badly?' },
      { type: 'vote', id: 'sexeq', label: 'Should a box-height estimate use sex-specific equations?', options: [
        { id: 'yes', label: 'Yes: average differences matter' }, { id: 'start', label: 'Only as a starting point' }, { id: 'no', label: 'No: measure the individual' }, { id: 'unsure', label: 'Not sure' },
      ] },
    ],
  },

  // ================================================================ Session 2, Part 2
  {
    id: 'challenge', group: 'Session 2 · Box challenge', title: 'Part 2 · The box challenge', short: 'Box challenge',
    phases: ['optimise', 'revise'],
    blocks: [
      { type: 'note', html: `<p>Now <strong>integrate</strong> everything. Challenge your athlete to jump onto the highest box possible, <strong>going up in increments</strong>.</p>
        <p class="callout"><strong>After every attempt:</strong> the athlete rests while the group <strong>identifies → implements → reviews</strong> a strategy. Log each attempt below so you can see what made the difference.</p>` },
      { type: 'lens', fw: ['dynamical', 'pragmatism'], text: 'Raising the box is a control parameter: at some height the athlete’s behaviour may suddenly flip from “jump” to “refuse”. That’s a phase transition. Each identify → implement → review loop is a small Deweyan experiment.', q: 'At what height did the pattern change, and what moved it back?' },
      { type: 'pull', list: 'final_plan', label: 'Your strategy sequence (from Station 5)' },
      { type: 'attempts', phase: 'box' },
      { type: 'note', html: `<h3>Then: the Optojump</h3><p>When your athlete reaches their box limit, give them a short break. Then use the Optojump to try to improve jump height using the <strong>same strategies</strong>.</p>` },
      { type: 'attempts', phase: 'optojump' },
      { type: 'itemChoice', attr: 'act', lists: ['final_plan', 'strategies'], label: 'What effect did each strategy actually have?', options: EFFECT, dedupe: true },
      { type: 'predictCompare' },
    ],
  },

  // ================================================================ Summary
  {
    id: 'summary', group: 'Wrap up', title: 'Summary & screencast', short: 'Summary & screencast',
    phases: ['revise'],
    blocks: [],
  },
];

// Team-working reflection on the summary page (each person rates 1-5; the team sees the spread).
export const TEAMWORK = [
  { id: 'tw_critical', label: 'Critical thinking', hint: 'Did you question assumptions and weigh up evidence?' },
  { id: 'tw_comm', label: 'Communication', hint: 'Did each discipline explain its ideas so the others could use them?' },
  { id: 'tw_discussion', label: 'Discussion', hint: 'Were disagreements aired and resolved?' },
  { id: 'tw_coop', label: 'Co-operation', hint: 'Did you work as one team or as separate specialists?' },
];

// Plyobox height estimator (from the station spreadsheet):
// max box = hip height + CMJ - landing position
// hip height = 52% (men) or 49% (women) of stature; landing position = 33% of stature.
export const HIP_PCT = { m: 0.52, f: 0.49 };
export const LANDING_PCT = 0.33;
export function estimateBox(cmj, stature, sex) {
  return stature * HIP_PCT[sex] + cmj - stature * LANDING_PCT;
}

// Which station a group is at in a given 15-minute slot (matches the timetable: group 1 starts at station 1).
export function stationFor(group, slot) {
  return ((group - 1 + slot) % 6) + 1;
}

// True when any saved input on the page has something in it. `A` is a Map of field -> value.
export function pageHasContent(page, A) {
  const tests = [];
  const attr = (name) => (k) => k.startsWith('attr:') && k.endsWith(`:${name}`);
  const walk = (b) => {
    switch (b.type) {
      case 'columns': b.blocks.forEach(walk); break;
      case 'field': case 'short': case 'choice': case 'rating': tests.push((k) => k === b.id); break;
      case 'list': case 'web': tests.push((k) => k.startsWith(`list:${b.id}:`)); break;
      case 'questions': b.items.forEach((i) => tests.push((k) => k === i.id)); break;
      case 'calc': tests.push((k) => k.startsWith('est:')); break;
      case 'chips': tests.push((k) => k.startsWith(`${b.id}:`)); break;
      case 'vote': tests.push((k) => k.startsWith(`vote:${b.id}:`)); break;
      case 'claim': case 'rule': tests.push((k) => k.startsWith(`${b.id}.`)); break;
      case 'matrix': case 'sorter': tests.push(attr(b.id)); break;
      case 'itemChoice': tests.push(attr(b.attr)); break;
      case 'athletePick': tests.push(attr('athpick')); break;
      case 'roles': tests.push((k) => k.startsWith('role:')); break;
      case 'prepost': tests.push((k) => k.startsWith(`${b.id}_pre:`) || k.startsWith(`${b.id}_post:`)); break;
      case 'compare': tests.push((k) => k.startsWith('perceived:')); break;
      case 'spectrum': tests.push((k) => k.startsWith('spec:')); break;
      default: break;
    }
  };
  page.blocks.forEach(walk);
  if (!tests.length) return false;
  for (const [k, v] of A) {
    if (!v || !tests.some((t) => t(k))) continue;
    if (k.startsWith('list:')) { try { if (JSON.parse(v).del) continue; } catch { continue; } }
    return true;
  }
  return false;
}
