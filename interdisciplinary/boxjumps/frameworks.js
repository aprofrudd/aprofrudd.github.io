// Interdisciplinary frameworks map (from the module's framework diagram) and the mono -> trans spectrum.
// tier: 'found' = foundational (pink in the original diagram), 'applied' = applied (lavender).

export const FRAMEWORKS = [
  {
    id: 'systems', tier: 'found', name: 'Systems Theory', person: 'Ludwig von Bertalanffy',
    source: 'General System Theory (1968)',
    idea: 'A system is more than the sum of its parts. Open systems exchange energy and information with their environment, and feedback loops let them regulate themselves.',
    jump: 'Jump height emerges from interacting sub-systems: muscle, technique and belief. Your support team is a system too, and its output depends on the connections between members.',
    ask: 'If you change one part, what else changes?',
  },
  {
    id: 'complexity', tier: 'found', name: 'Complexity Theory', person: 'Ilya Prigogine',
    source: 'Order Out of Chaos (Prigogine & Stengers, 1984)',
    sport: 'Applied to sports injury by Bittencourt et al. (2016), who argue injury emerges from a web of interacting determinants.',
    idea: 'Complex systems are non-linear and self-organising. Order emerges from interactions, so small changes can have large effects and large changes can have none.',
    jump: 'One well-timed cue might unlock 10 cm, while two good strategies used together might cancel each other out. Effects are not additive.',
    ask: 'Where might a small change have a big effect, or a big change no effect?',
  },
  {
    id: 'ecological', tier: 'found', name: 'Ecological Frameworks', person: 'Urie Bronfenbrenner',
    source: 'The Ecology of Human Development (1979)',
    sport: 'Applied to athlete development environments by Henriksen, Stambulova & Roessler (2010).',
    idea: 'People develop within nested systems: the microsystem (immediate settings and people), mesosystem (links between those settings), exosystem (settings that affect them indirectly) and macrosystem (culture, values and norms).',
    jump: 'Peers watching are the athlete’s microsystem. How your team members interact is a mesosystem. Lab rules and the timetable are exosystem. Beliefs about who “should” be able to jump high are macrosystem.',
    ask: 'What outside the athlete is shaping this jump?',
  },
  {
    id: 'biopsychosocial', tier: 'applied', name: 'Biopsychosocial Model', person: 'George Engel',
    source: 'Science (1977)',
    sport: 'Used widely in sports injury and return-to-sport research, e.g. Wiese-Bjornstal et al. (1998).',
    idea: 'Health and behaviour come from biological, psychological and social factors interacting. None can be fully understood alone.',
    jump: 'Physiology and biomechanics cover “bio”, psychology covers “psycho”, but who in your cell covers “social”? The audience, team dynamics and the athlete’s relationship with the people coaching them all matter.',
    ask: 'What is the social limiter here, and who owns it?',
  },
  {
    id: 'intersectionality', tier: 'applied', name: 'Intersectionality', person: 'Kimberlé Crenshaw',
    source: 'University of Chicago Legal Forum (1989)',
    sport: 'Linked to the under-representation of women in sport and exercise science research, e.g. Cowley et al. (2021).',
    idea: 'Identities such as sex, gender, race, class, disability and body size overlap to create experiences that can’t be understood one category at a time.',
    jump: 'The box-height calculator uses sex-specific equations: what does that assume? Who volunteered to be the athlete, and why? Jumping in front of peers may feel very different depending on who you are.',
    ask: 'Whose experience does your plan assume?',
  },
  {
    id: 'ecodynamics', tier: 'applied', name: 'Ecological Dynamics', person: 'James J. Gibson',
    source: 'The Ecological Approach to Visual Perception (1979)',
    sport: 'Developed in sport by Davids, Button & Bennett (2008) and Araújo and colleagues, using Newell’s (1986) model of individual, task and environmental constraints.',
    idea: 'Perception and action are coupled. People perceive affordances (opportunities for action) relative to their own capabilities, and movement emerges from interacting constraints.',
    jump: 'The box is a task constraint and an affordance. Whether it looks “jumpable” depends on the athlete’s capabilities. You can change the task or the environment, not just the athlete.',
    ask: 'What constraint could you change instead of the athlete?',
  },
  {
    id: 'pragmatism', tier: 'applied', name: 'Pragmatism', person: 'John Dewey',
    source: 'Logic: The Theory of Inquiry (1938)',
    sport: 'Proposed as a research philosophy for sport and exercise psychology by Giacobbi, Poczwardowski & Hager (2005).',
    idea: 'Ideas are judged by their practical consequences. Knowledge grows through a cycle of inquiry: meet a problem, form a hypothesis, act, then reflect on what happened.',
    jump: 'Identify → implement → review after each attempt is Dewey’s cycle of inquiry. So is your support model, Describe → Revise.',
    ask: 'What would count as evidence that it worked?',
  },
  {
    id: 'transdisciplinary', tier: 'applied', name: 'Transdisciplinarity', person: 'Basarab Nicolescu',
    source: 'Manifesto of Transdisciplinarity (2002)',
    idea: 'Transdisciplinary work goes between, across and beyond disciplines. It brings in non-academic knowledge and reframes the problem as a whole, rather than as a set of disciplinary pieces.',
    jump: 'Your athlete’s lived experience is evidence too. A transdisciplinary team would let the athlete help define the problem, not just receive the solution.',
    ask: 'What does your athlete know that your data can’t tell you?',
  },
  {
    id: 'dynamical', tier: 'applied', name: 'Dynamical Systems', person: 'Henri Poincaré',
    source: 'Qualitative theory of dynamical systems (late 19th century)',
    sport: 'Brought into movement science through Haken, Kelso & Bunz’s (1985) model of coordination dynamics.',
    idea: 'Systems settle into stable states (attractors). Changing a control parameter past a critical point causes a sudden phase transition, and variability is information, not just noise.',
    jump: 'Technique settles into stable patterns, and a hesitant run-up can be an attractor. Raising the box is a control parameter: at some height, “jump” suddenly flips to “refuse”.',
    ask: 'Is the variability between attempts noise, or information?',
  },
];

export const FW_EDGES = [
  { from: 'systems', to: 'complexity', label: 'serves as foundation for' },
  { from: 'complexity', to: 'ecological', label: 'extends to' },
  { from: 'ecological', to: 'biopsychosocial', label: 'applies to' },
  { from: 'ecological', to: 'ecodynamics', label: 'informs' },
  { from: 'biopsychosocial', to: 'intersectionality', label: 'incorporates' },
  { from: 'intersectionality', to: 'ecological', label: 'provides feedback to', dashed: true },
  { from: 'ecodynamics', to: 'pragmatism', label: 'draws from' },
  { from: 'pragmatism', to: 'transdisciplinary', label: 'supports' },
  { from: 'transdisciplinary', to: 'dynamical', label: 'utilizes' },
  { from: 'dynamical', to: 'systems', label: 'provides feedback to', dashed: true },
];

// Node centres in an 900 x 760 viewBox, laid out like the original diagram.
export const FW_POS = {
  systems: [640, 50],
  complexity: [390, 160],
  ecological: [390, 270],
  biopsychosocial: [145, 400],
  intersectionality: [300, 520],
  ecodynamics: [640, 400],
  pragmatism: [640, 510],
  transdisciplinary: [640, 620],
  dynamical: [640, 720],
};

export const fw = (id) => FRAMEWORKS.find((f) => f.id === id);

// ---------------------------------------------------------------- spectrum
export const SPECTRUM = [
  { id: 'mono', label: 'Mono', def: 'One discipline works on the problem with its own methods.' },
  { id: 'multi', label: 'Multi', def: 'Several disciplines work on the same problem side by side. Each stays inside its own boundary and the outputs are added together at the end.' },
  { id: 'inter', label: 'Inter', def: 'Disciplines interact by sharing data, methods and decisions, producing an integrated solution none of them could reach alone.' },
  { id: 'trans', label: 'Trans', def: 'Work goes beyond the disciplines, bringing in non-academic knowledge (athlete, coach) and reframing the problem as a whole.' },
];

export const SPECTRUM_SOURCE = 'Choi & Pak (2006), Clinical and Investigative Medicine, is a widely cited starting point for these definitions.';

export const SPECTRUM_EXAMPLES = [
  { id: 'ex1', text: 'A physiologist tests CMJ height and prescribes a strength programme without speaking to anyone else.', answer: 'mono', why: 'One discipline, one set of methods, one output.' },
  { id: 'ex2', text: 'The physiologist, biomechanist and psychologist each test the athlete and send the coach three separate reports.', answer: 'multi', why: 'Three disciplines on one problem, but they never interact. The coach has to do the integrating.' },
  { id: 'ex3', text: 'The biomechanist spots hesitation at take-off. With the psychologist they design a cue that also shortens the countermovement, and the physiologist times it after the potentiation set.', answer: 'inter', why: 'Each discipline’s data changes what the others do, and the solution only exists because they worked together.' },
  { id: 'ex4', text: 'All three disciplines save data into one shared spreadsheet, but each person only analyses their own columns.', answer: 'multi', why: 'Sharing a place is not the same as integrating. Nobody’s analysis is changed by anyone else’s.' },
  { id: 'ex5', text: 'The athlete, coach and scientists co-design the plan. The athlete’s experience counts as evidence alongside the data, and the problem gets reframed from “jump higher” to “trust the take-off”.', answer: 'trans', why: 'Non-academic knowledge is integrated and the problem itself is redefined beyond any one discipline.' },
  { id: 'ex6', text: 'A psychologist uses force-plate data from the athlete’s best jumps to write a personalised imagery script.', answer: 'inter', why: 'Psychology’s intervention is built from biomechanical data, so the disciplines are genuinely combined.' },
];
