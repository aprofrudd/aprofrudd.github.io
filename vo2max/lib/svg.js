/*
 * svg.js — the small amount of SVG machinery the module charts need.
 *
 * Deliberately not a chart library. Every chart draws itself; these are just
 * the repetitive bits (element creation, scales, axes, ticks) factored out so
 * each interactive stays readable.
 */

const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes and optional text content. */
export function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Append many children at once; returns the parent. */
export function add(parent, ...kids) {
  kids.flat().forEach((k) => k && parent.appendChild(k));
  return parent;
}

/** A root <svg> sized by viewBox so it scales fluidly. */
export function svg(width, height) {
  return el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    'aria-hidden': 'true',
  });
}

/** A <g> with an optional translate. */
export function group(x = 0, y = 0, attrs = {}) {
  return el('g', { transform: `translate(${x},${y})`, ...attrs });
}

/** Linear scale from a data domain to a pixel range. */
export function scaleLinear(d0, d1, r0, r1) {
  const span = d1 - d0 || 1;
  const fn = (v) => r0 + ((v - d0) / span) * (r1 - r0);
  fn.invert = (px) => d0 + ((px - r0) / (r1 - r0)) * span;
  fn.domain = [d0, d1];
  fn.range = [r0, r1];
  return fn;
}

/**
 * Logarithmic scale. Ratios like hazard ratios are symmetric on a log axis —
 * halving and doubling sit the same distance either side of 1 — which is why
 * forest plots are conventionally drawn this way.
 */
export function scaleLog(d0, d1, r0, r1) {
  const l0 = Math.log(d0), l1 = Math.log(d1);
  const span = l1 - l0 || 1;
  const fn = (v) => r0 + ((Math.log(v) - l0) / span) * (r1 - r0);
  fn.invert = (px) => Math.exp(l0 + ((px - r0) / (r1 - r0)) * span);
  fn.domain = [d0, d1];
  fn.range = [r0, r1];
  return fn;
}

/** Evenly spaced band positions, like a categorical axis. */
export function scaleBand(count, r0, r1, padding = 0.2) {
  const step = (r1 - r0) / count;
  const band = step * (1 - padding);
  const fn = (i) => r0 + i * step + (step - band) / 2;
  fn.bandwidth = band;
  fn.step = step;
  return fn;
}

/** Round to at most `n` decimals, dropping trailing zeros. */
export function round(v, n = 2) {
  return Number(v.toFixed(n));
}

/** "Nice" tick values covering [d0, d1] at roughly `count` intervals. */
export function ticks(d0, d1, count = 5) {
  const raw = (d1 - d0) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(d0 / step) * step; v <= d1 + step * 1e-9; v += step) {
    out.push(round(v, 6));
  }
  return out;
}

/**
 * A horizontal axis with a line and tick labels.
 * `format` receives the tick value and returns its label.
 */
export function axisBottom(x, y, values, format = String, opts = {}) {
  const g = group(0, 0, { class: 'v-axis' });
  const [r0, r1] = x.range;
  add(g, el('line', { x1: r0, y1: y, x2: r1, y2: y, class: 'v-axis-line' }));
  values.forEach((v) => {
    const px = x(v);
    add(
      g,
      el('line', { x1: px, y1: y, x2: px, y2: y + 5, class: 'v-axis-line' }),
      el('text', {
        x: px,
        y: y + 19,
        'text-anchor': 'middle',
        class: opts.small ? 'v-label-sm' : null,
      }, format(v))
    );
  });
  return g;
}

/**
 * A vertical axis with gridlines running right across the plot.
 */
export function axisLeft(y, x0, x1, values, format = String, opts = {}) {
  const g = group(0, 0, { class: 'v-axis' });
  values.forEach((v) => {
    const py = y(v);
    if (opts.grid !== false) {
      add(g, el('line', { x1: x0, y1: py, x2: x1, y2: py, class: 'v-grid-line' }));
    }
    add(
      g,
      el('text', {
        x: x0 - 10,
        y: py + 4,
        'text-anchor': 'end',
        class: opts.small ? 'v-label-sm' : null,
      }, format(v))
    );
  });
  return g;
}

/** An axis title, rotated for the y axis. */
export function axisTitle(text, x, y, rotate = 0) {
  return el('text', {
    x, y,
    'text-anchor': 'middle',
    class: 'v-label-strong',
    transform: rotate ? `rotate(${rotate} ${x} ${y})` : null,
  }, text);
}

/** Build an SVG path `d` string from [x, y] pixel pairs. */
export function line(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${round(p[0], 2)},${round(p[1], 2)}`).join(' ');
}

/**
 * Build a step-function path — the shape a Kaplan-Meier curve makes.
 * Between two points it goes across first, then down.
 */
export function stepLine(points) {
  if (!points.length) return '';
  let d = `M${round(points[0][0], 2)},${round(points[0][1], 2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${round(points[i][0], 2)},${round(points[i - 1][1], 2)}`;
    d += ` L${round(points[i][0], 2)},${round(points[i][1], 2)}`;
  }
  return d;
}

/** A rounded-top rectangle, for bars. */
export function bar(x, y, w, h, r = 3) {
  const rad = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= rad) return el('rect', { x, y, width: w, height: Math.max(h, 0) });
  const d = `M${x},${y + h} L${x},${y + rad} Q${x},${y} ${x + rad},${y}` +
            ` L${x + w - rad},${y} Q${x + w},${y} ${x + w},${y + rad}` +
            ` L${x + w},${y + h} Z`;
  return el('path', { d });
}

/**
 * Animate an element's stroke so a line appears to draw itself.
 * Respects prefers-reduced-motion by simply doing nothing.
 */
export function drawIn(path, ms = 600, delay = 0) {
  if (prefersReducedMotion()) return;
  const len = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0;
  if (!len) return;
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  path.style.transition = `stroke-dashoffset ${ms}ms ease ${delay}ms`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    path.style.strokeDashoffset = '0';
  }));
}

/** Animate a bar growing from its baseline. */
export function growIn(node, ms = 500, delay = 0) {
  if (prefersReducedMotion()) return;
  // In SVG, transform-origin resolves against the viewBox by default, so
  // 'bottom' would mean the bottom of the whole chart. fill-box makes it mean
  // the bottom of this bar, which is what a bar growing from its baseline needs.
  node.style.transformBox = 'fill-box';
  node.style.transformOrigin = 'bottom';
  node.style.transform = 'scaleY(0)';
  node.style.transition = `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    node.style.transform = 'scaleY(1)';
  }));
}

/** Fade a node in. */
export function fadeIn(node, ms = 400, delay = 0) {
  if (prefersReducedMotion()) return;
  node.style.opacity = '0';
  node.style.transition = `opacity ${ms}ms ease ${delay}ms`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    node.style.opacity = '1';
  }));
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Normal distribution density, used to draw the Table 2 curves. */
export function normalPdf(x, mean, sd) {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Cumulative normal probability — the share of a normal distribution below x.
 * Abramowitz & Stegun 7.1.26 approximation of the error function; accurate to
 * about 1e-7, far beyond what the module displays.
 */
export function normalCdf(x, mean, sd) {
  const z = (x - mean) / (sd * Math.SQRT2);
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  const erf = z >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

/** Format a number with a thousands separator. */
export function comma(n) {
  return n.toLocaleString('en-GB');
}
