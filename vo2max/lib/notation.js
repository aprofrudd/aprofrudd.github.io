/*
 * notation.js — typesets V̇O₂max: a dot over the V, "2max" as a subscript.
 *
 * Source strings carry U+0307 COMBINING DOT ABOVE and U+2082 SUBSCRIPT TWO
 * (see VO2MAX in data.js). No font in the site's stack anchors the dot to a
 * capital V, so browsers park it in the notch between the V and the O; and a
 * subscript "max" has no Unicode form at all. So the mark is used as a
 * sentinel: only strings that deliberately carry it are rewritten, which
 * leaves verbatim quotes written "VO2max" exactly as their sources wrote them.
 *
 *   HTML — <span class="v-vo2max"><span class="v-vdot">V</span>O<span class="v-sub">2max</span></span>
 *          Dot from a ::before in /styles.css; subscript by CSS. The text is
 *          a plain "2max" so a copy-paste gives "VO2max".
 *
 *   SVG  — the <text> is rebuilt as tspans (subscript at 0.68×, baseline
 *          shifted with dy) and a <circle> is placed over the V. Its position
 *          comes from canvas text metrics, not getComputedTextLength(), so a
 *          chart inside a hidden slide still typesets.
 *
 * A MutationObserver keeps up with charts that draw lazily and readouts that
 * rewrite themselves. Replacements never reintroduce the mark, so a rerun
 * over typeset content is a no-op and the observer settles.
 */

const MARK = '̇';
const SVG_NS = 'http://www.w3.org/2000/svg';
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);

// V + dot + O + subscript-two (or a plain 2) + optional "max".
const TOKEN = /V̇O[₂2](max)?/g;

/* Geometry in multiples of the font size. Cap height is about 0.70em in this
 * stack; the dot sits just clear of it. SUB_SIZE and SUB_SHIFT are the same
 * numbers as .v-sub in /styles.css, so HTML and SVG agree. */
const DOT_CENTRE = 0.855;
const DOT_RADIUS = 0.057;
const SUB_SIZE = 0.68;
const SUB_SHIFT = 0.22;

const r2 = (n) => Math.round(n * 100) / 100;

let ctx = null;
function canvas() {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  return ctx;
}
function measure(text, font) {
  if (!text) return 0;
  const c = canvas();
  c.font = font;
  return c.measureText(text).width;
}

/* Stray marks outside the token: wrap the letter before each one. A mark
 * with nothing to sit over is dropped. */
function splitStray(s, out) {
  let last = 0;
  for (let i = s.indexOf(MARK); i !== -1; i = s.indexOf(MARK, i + 1)) {
    if (i === 0 || s[i - 1] === MARK) { last = i + 1; continue; }
    if (i - 1 > last) out.push({ kind: 'text', text: s.slice(last, i - 1) });
    out.push({ kind: 'vdot', text: s[i - 1] });
    last = i + 1;
  }
  if (last < s.length) out.push({ kind: 'text', text: s.slice(last) });
}

/** Pieces: { kind:'text', text } | { kind:'vdot', text } | { kind:'vo2', sub:'2max'|'2' } */
function tokenise(raw) {
  const pieces = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(raw); m; m = TOKEN.exec(raw)) {
    if (m.index > last) splitStray(raw.slice(last, m.index), pieces);
    pieces.push({ kind: 'vo2', sub: '2' + (m[1] || '') });
    last = m.index + m[0].length;
  }
  if (last < raw.length) splitStray(raw.slice(last), pieces);
  return pieces;
}

function span(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  if (text) s.textContent = text;
  return s;
}

/** HTML: replace a marked text node with the span structure. */
function typesetHtmlText(node) {
  const raw = node.nodeValue;
  if (!raw || raw.indexOf(MARK) === -1) return;
  const frag = document.createDocumentFragment();
  for (const p of tokenise(raw)) {
    if (p.kind === 'text') frag.appendChild(document.createTextNode(p.text));
    else if (p.kind === 'vdot') frag.appendChild(span('v-vdot', p.text));
    else {
      const wrap = span('v-vo2max');
      wrap.append(span('v-vdot', 'V'), 'O', span('v-sub', p.sub));
      frag.appendChild(wrap);
    }
  }
  node.parentNode.replaceChild(frag, node);
}

/** SVG: rebuild a marked <text> as tspans and drop a <circle> over each V. */
function typesetSvgText(textEl) {
  const raw = textEl.textContent;
  if (raw.indexOf(MARK) === -1) return;

  const cs = getComputedStyle(textEl);
  const size = parseFloat(cs.fontSize) || 12;
  const font = (px) => {
    const f = `${cs.fontStyle || 'normal'} ${cs.fontWeight || 400} ${px}px ${cs.fontFamily || 'sans-serif'}`;
    const c = canvas();
    c.font = f;
    // Canvas keeps its previous font if it cannot parse the string, and
    // every width would then come from the wrong face. Fall back cleanly.
    return c.font.includes(`${px}px`) ? f : `${px}px sans-serif`;
  };
  const subPx = r2(size * SUB_SIZE);
  const shift = r2(size * SUB_SHIFT);

  // Flatten to runs at two sizes. dy is cumulative in SVG — it moves the
  // current text position for everything after it — so the run after a
  // subscript carries the opposite shift to come back to the baseline.
  const runs = [];    // { text, px, dy }
  const dots = [];    // indices of runs whose first character takes the dot
  let lowered = false;
  for (const p of tokenise(raw)) {
    const back = lowered ? -shift : 0;
    if (p.kind === 'text') {
      runs.push({ text: p.text, px: size, dy: back });
      lowered = false;
    } else if (p.kind === 'vdot') {
      dots.push(runs.length);
      runs.push({ text: p.text, px: size, dy: back });
      lowered = false;
    } else {
      dots.push(runs.length);
      runs.push({ text: 'VO', px: size, dy: back });
      runs.push({ text: p.sub, px: subPx, dy: shift });
      lowered = true;
    }
  }

  const x = parseFloat(textEl.getAttribute('x')) || 0;
  const y = parseFloat(textEl.getAttribute('y')) || 0;
  const anchor = cs.textAnchor || textEl.getAttribute('text-anchor') || 'start';
  const widths = runs.map((r) => measure(r.text, font(r.px)));
  const total = widths.reduce((a, b) => a + b, 0);
  const left = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;

  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
  runs.forEach((r) => {
    const t = document.createElementNS(SVG_NS, 'tspan');
    if (r.dy) t.setAttribute('dy', String(r.dy));
    // style, not attribute: .v-chart text sets font-size in CSS.
    if (r.px !== size) t.style.fontSize = `${r.px}px`;
    t.textContent = r.text;
    textEl.appendChild(t);
  });
  textEl.setAttribute('data-notation', '');

  const fill = cs.fill && cs.fill !== 'none' ? cs.fill : 'currentColor';
  const transform = textEl.getAttribute('transform');
  let after = textEl;
  dots.forEach((idx) => {
    const before = widths.slice(0, idx).reduce((a, b) => a + b, 0);
    const cx = left + before + measure(runs[idx].text[0], font(runs[idx].px)) / 2;
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'v-vdot-dot');
    dot.setAttribute('cx', String(r2(cx)));
    dot.setAttribute('cy', String(r2(y - size * DOT_CENTRE)));
    dot.setAttribute('r', String(Math.max(0.9, r2(size * DOT_RADIUS))));
    dot.setAttribute('fill', fill);
    if (transform) dot.setAttribute('transform', transform);
    textEl.parentNode.insertBefore(dot, after.nextSibling);
    after = dot;
  });
}

function typesetTextNode(node) {
  const parent = node.parentNode;
  if (!parent || parent.nodeType !== 1) return;
  if (SKIP.has(parent.nodeName.toUpperCase())) return;
  if (parent.namespaceURI === SVG_NS) {
    // After a rebuild the text sits inside tspans; find the owning <text>.
    const text = parent.nodeName === 'text' ? parent : (parent.closest && parent.closest('text'));
    if (text) typesetSvgText(text);
  } else {
    typesetHtmlText(node);
  }
}

/** Typeset every marked string inside `root`. Safe to run twice. */
export function typesetNotation(root) {
  if (!root) return;
  if (root.nodeType === 3) { typesetTextNode(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.indexOf(MARK) !== -1
      ? NodeFilter.FILTER_ACCEPT
      : NodeFilter.FILTER_REJECT),
  });
  const found = [];
  while (walker.nextNode()) found.push(walker.currentNode);
  found.forEach(typesetTextNode);
}

/** Typeset `root` now and keep typesetting it as the page builds itself. */
export function watchNotation(root = document.body) {
  typesetNotation(root);
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') typesetTextNode(r.target);
      else r.addedNodes.forEach(typesetNotation);
    }
  });
  obs.observe(root, { childList: true, subtree: true, characterData: true });
  return obs;
}
