// Theme system for the presentation builder.
//
// The engine reads every colour through 13 CSS custom properties in styles.css
// (:root). A per-presentation theme.css that re-declares those vars overrides
// them via the cascade - so theming needs NO engine change. The teacher only
// picks 4 "anchor" colours; the other 9 vars are derived here so they never
// see a wall of pickers. theme.css also sets the body background.

// ---- colour helpers --------------------------------------------------------

export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

// mix(a, b, t): t=0 -> a, t=1 -> b
export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t
  });
}

export const lighten = (hex, t) => mix(hex, '#ffffff', t);
export const darken  = (hex, t) => mix(hex, '#000000', t);
export function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ---- font + theme presets --------------------------------------------------
// System font stacks only (no external font loading - keeps the builder and
// published pages free of third-party script/style fetches).

export const FONT_PRESETS = {
  classic:  {
    label: 'Classic (serif headings)',
    serif: "'Georgia', 'Hoefler Text', 'Times New Roman', serif",
    sans:  "'Helvetica Neue', 'Arial', system-ui, sans-serif"
  },
  modern: {
    label: 'Modern (sans)',
    serif: "'Avenir Next', 'Segoe UI', system-ui, sans-serif",
    sans:  "'Avenir Next', 'Segoe UI', system-ui, sans-serif"
  },
  editorial: {
    label: 'Editorial (Palatino)',
    serif: "'Palatino Linotype', 'Palatino', Georgia, serif",
    sans:  "'Optima', 'Segoe UI', system-ui, sans-serif"
  }
};

// Anchor colours = { paper, ink, accent, pin }. Presets fill the four pickers.
export const THEME_PRESETS = {
  parchment: { label: 'Parchment',     paper: '#faf4e6', ink: '#3a261e', accent: '#c0524a', pin: '#7c2820', font: 'classic' },
  slate:     { label: 'Cool slate',    paper: '#f3f5f8', ink: '#22303b', accent: '#2f6f8f', pin: '#1d4456', font: 'modern' },
  forest:    { label: 'Forest',        paper: '#f2f6ef', ink: '#22311f', accent: '#3f7a3a', pin: '#274d24', font: 'classic' },
  ink:       { label: 'High contrast', paper: '#ffffff', ink: '#16181d', accent: '#b4332a', pin: '#7a1f18', font: 'modern' },
  midnight:  { label: 'Midnight',      paper: '#1c2230', ink: '#eef1f6', accent: '#e0a93b', pin: '#f0c14b', font: 'modern' }
};

export const DEFAULT_THEME = {
  paper: '#faf4e6', ink: '#3a261e', accent: '#c0524a', pin: '#7c2820',
  font: 'classic',
  background: { type: 'solid' }   // solid -> uses --paper; gradient/image override body
};

// ---- derive the full variable set from the 4 anchors -----------------------

export function deriveVars(theme) {
  const paper  = theme.paper  || DEFAULT_THEME.paper;
  const ink    = theme.ink    || DEFAULT_THEME.ink;
  const accent = theme.accent || DEFAULT_THEME.accent;
  const pin    = theme.pin    || DEFAULT_THEME.pin;
  const font   = FONT_PRESETS[theme.font] || FONT_PRESETS.classic;
  const inkSoft = mix(ink, paper, 0.30);
  return {
    '--paper':       paper,
    '--paper-dark':  mix(paper, ink, 0.07),
    '--ink':         ink,
    '--ink-soft':    inkSoft,
    '--accent':      accent,
    '--accent-soft': mix(accent, paper, 0.62),
    '--pin':         pin,
    '--pin-glow':    rgba(pin, 0.18),
    '--shadow':      `0 2px 8px ${rgba(ink, 0.12)}`,
    '--bar':         accent,
    '--bar-track':   rgba(inkSoft, 0.12),
    '--serif':       font.serif,
    '--sans':        font.sans
  };
}

// ---- background --------------------------------------------------------------

function backgroundCss(theme) {
  const bg = theme.background || {};
  if (bg.type === 'gradient') {
    const angle = Number.isFinite(bg.angle) ? bg.angle : 160;
    const from = bg.from || theme.paper || DEFAULT_THEME.paper;
    const to   = bg.to   || darken(from, 0.12);
    return `linear-gradient(${angle}deg, ${from}, ${to}) fixed`;
  }
  if (bg.type === 'image' && bg.src) {
    // bg.src is a presentation-relative path, e.g. media/bg.jpg
    return `url("${bg.src}") center / cover no-repeat fixed`;
  }
  // solid -> fall back to the paper variable so it tracks the theme
  return 'var(--paper)';
}

// ---- emit theme.css ---------------------------------------------------------

export function themeCss(theme) {
  const vars = deriveVars(theme || DEFAULT_THEME);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `/* Generated by the presentation builder - per-presentation theme. */
:root {
${lines}
}
body { background: ${backgroundCss(theme || DEFAULT_THEME)}; }
`;
}
