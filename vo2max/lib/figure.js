/*
 * figure.js — the wrapper every chart in the module sits inside.
 *
 * Mirrors the accessible-figure pattern the homepage already uses for the
 * collaboration network (index.html): a <figure> holding a role="img" div with
 * an aria-label, an aria-hidden SVG, a <figcaption>, and a <details> data
 * table so the numbers are reachable without seeing the picture.
 *
 * It also supplies the Replay and Reset buttons every interactive needs for
 * screen recording.
 */

/** Build an element from a tag, attributes and children. */
export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  kids.flat().forEach((k) => {
    if (k === null || k === undefined || k === false) return;
    node.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  });
  return node;
}

/**
 * Create a figure shell.
 *
 * opts.label    — the aria-label describing the finding in plain English
 * opts.caption  — figcaption text
 * opts.table    — { head: [...], rows: [[...]], keyRow: n } for the data table
 * opts.onReplay — called when Replay is pressed
 * opts.onReset  — called when Reset is pressed; omit to hide the button
 *
 * Returns { figure, chart, setLabel, setTable } — append your <svg> to `chart`.
 */
export function figure(opts = {}) {
  const chart = h('div', {
    class: 'v-chart' + (opts.wide ? ' v-chart--wide' : ''),
    role: 'img',
    'aria-label': opts.label || '',
  });
  const hint = h('p', { class: 'v-scroll-hint' }, 'Swipe the chart sideways to see all of it.');
  const caption = opts.caption ? h('figcaption', { class: 'v-caption', html: opts.caption }) : null;

  const tableWrap = h('details', { class: 'v-table' },
    h('summary', {}, 'View as a table')
  );
  const tableScroll = h('div', { class: 'v-table-scroll' });
  tableWrap.appendChild(tableScroll);

  const controls = h('div', { class: 'v-controls v-controls-end' });
  if (opts.onReplay) {
    controls.appendChild(h('button', {
      class: 'v-btn', type: 'button', onclick: opts.onReplay,
    }, 'Replay'));
  }
  if (opts.onReset) {
    controls.appendChild(h('button', {
      class: 'v-btn', type: 'button', onclick: opts.onReset,
    }, 'Reset'));
  }

  const fig = h('figure', { class: 'v-figure' },
    chart,
    hint,
    caption,
    opts.table !== false ? tableWrap : null,
    controls.childElementCount ? controls : null
  );

  function setTable(spec) {
    tableScroll.innerHTML = '';
    if (!spec) { tableWrap.hidden = true; return; }
    tableWrap.hidden = false;
    const table = h('table', {},
      spec.caption ? h('caption', { class: 'visually-hidden' }, spec.caption) : null,
      h('thead', {}, h('tr', {}, spec.head.map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, spec.rows.map((r, i) =>
        h('tr', { class: spec.keyRow === i ? 'is-key' : null },
          r.map((c, j) => (j === 0
            ? h('th', { scope: 'row', style: 'font-weight:inherit' }, String(c))
            : h('td', {}, String(c))))
        )
      ))
    );
    tableScroll.appendChild(table);
  }

  if (opts.table && opts.table !== true) setTable(opts.table);

  return {
    figure: fig,
    chart,
    setLabel: (t) => chart.setAttribute('aria-label', t),
    setTable,
  };
}

/**
 * A two-option segmented control, used everywhere to switch between the
 * healthy men and the men with heart disease.
 * `options` is [{ value, label }]; `onChange` receives the new value.
 */
export function toggle(options, value, onChange, ariaLabel = 'Choose a group') {
  const wrap = h('div', { class: 'v-toggle', role: 'group', 'aria-label': ariaLabel });
  const buttons = options.map((o) =>
    h('button', {
      type: 'button',
      'aria-pressed': String(o.value === value),
      onclick: () => {
        buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === o.value)));
        onChange(o.value);
      },
    }, o.label)
  );
  buttons.forEach((b) => wrap.appendChild(b));
  wrap.select = (v) => {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === v)));
  };
  return wrap;
}

/**
 * A labelled range slider with a live value readout.
 * Returns the wrapping element with `.input` and `.set(v)` attached.
 */
export function slider(opts) {
  const out = h('strong', {}, opts.format ? opts.format(opts.value) : String(opts.value));
  const input = h('input', {
    type: 'range',
    class: 'v-range',
    min: opts.min,
    max: opts.max,
    step: opts.step || 1,
    value: opts.value,
    'aria-label': opts.label,
  });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = opts.format ? opts.format(v) : String(v);
    opts.onInput(v);
  });
  const wrap = h('div', { class: 'v-slider-row' },
    h('div', { class: 'v-slider-label' }, h('span', {}, opts.label), out),
    input
  );
  wrap.input = input;
  wrap.set = (v) => {
    input.value = String(v);
    out.textContent = opts.format ? opts.format(v) : String(v);
    opts.onInput(v);
  };
  return wrap;
}

/** A row of big live numbers. `stats` is [{ value, label, small }]. */
export function readout(stats) {
  const wrap = h('div', { class: 'v-readout' });
  const nodes = stats.map((s) => {
    const num = h('span', { class: 'v-stat-num' + (s.small ? ' v-stat-num-sm' : '') }, s.value);
    // labelHtml lets a label carry markup — a <span class="v-nocase"> keeps
    // a unit like mL·kg⁻¹·min⁻¹ out of the uppercase transform. (V̇O₂max
    // needs nothing: notation.js supplies its own wrapper.)
    const label = s.labelHtml
      ? h('span', { class: 'v-stat-label', html: s.labelHtml })
      : h('span', { class: 'v-stat-label' }, s.label);
    wrap.appendChild(h('div', { class: 'v-stat' }, num, label));
    return num;
  });
  wrap.set = (i, value) => { nodes[i].textContent = value; };
  wrap.setAll = (values) => values.forEach((v, i) => { if (nodes[i]) nodes[i].textContent = v; });
  return wrap;
}

/** A colour key. `keys` is [{ swatch: 'safe'|'risk'|'neutral', label }]. */
export function legend(keys) {
  return h('div', { class: 'v-legend' },
    // The label goes in its own span: .v-key is a flex row with a gap, so a
    // bare text node would be split into two flex items the moment
    // notation.js wraps the V of V̇O₂max, opening a gap mid-word.
    keys.map((k) => h('span', { class: 'v-key' },
      h('span', { class: `v-swatch v-swatch-${k.swatch}` }),
      h('span', {}, k.label)
    ))
  );
}

/** A card to hold one interactive. */
export function card(title, hint, sub, wide) {
  const body = h('div', { class: 'v-card-body' });
  const el = h('div', { class: 'v-card' + (wide ? ' v-card-wide' : '') },
    h('div', { class: 'v-card-head' },
      h('h3', {}, title),
      hint ? h('span', { class: 'v-card-hint' }, hint) : null
    ),
    sub ? h('p', { class: 'v-card-sub', html: sub }) : null,
    body
  );
  el.body = body;
  return el;
}
