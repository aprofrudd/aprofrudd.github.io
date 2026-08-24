// Small DOM + form helpers for the builder (vanilla, no framework).

export function el(tag, cls, props) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (props) {
    for (const k in props) {
      if (k === 'text') e.textContent = props[k];
      else if (k === 'html') e.innerHTML = props[k];
      else if (k === 'on' && props.on) for (const ev in props.on) e.addEventListener(ev, props.on[ev]);
      else if (k in e) e[k] = props[k];
      else e.setAttribute(k, props[k]);
    }
  }
  return e;
}

export function field(labelText, control, hint) {
  const wrap = el('label', 'b-field');
  wrap.appendChild(el('span', 'b-field-label', { text: labelText }));
  // Stable key so the editor can restore keyboard focus to this control after
  // a structural re-render (which used to silently drop focus).
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(control.tagName || '')) control.dataset.fkey = labelText;
  wrap.appendChild(control);
  if (hint) wrap.appendChild(el('span', 'b-field-hint', { text: hint }));
  return wrap;
}

export function textInput(value, onInput, placeholder) {
  return el('input', 'b-input', {
    type: 'text', value: value == null ? '' : value, placeholder: placeholder || '',
    on: { input: e => onInput(e.target.value) }
  });
}

export function textArea(value, onInput, rows) {
  return el('textarea', 'b-input b-textarea', {
    rows: rows || 3, value: value == null ? '' : value,
    on: { input: e => onInput(e.target.value) }
  });
}

export function numberInput(value, onInput, min, max) {
  return el('input', 'b-input b-input--num', {
    type: 'number', value: value == null ? '' : value,
    min: min == null ? '' : min, max: max == null ? '' : max,
    on: { input: e => onInput(e.target.value === '' ? undefined : Number(e.target.value)) }
  });
}

export function selectInput(value, options, onChange) {
  const sel = el('select', 'b-input');
  options.forEach(o => {
    const opt = el('option', null, { value: o.value, text: o.label });
    if (String(o.value) === String(value)) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', e => onChange(e.target.value));
  return sel;
}

export function checkbox(checked, onChange, labelText) {
  const wrap = el('label', 'b-check');
  const cb = el('input', null, { type: 'checkbox', checked: !!checked,
    on: { change: e => onChange(e.target.checked) } });
  wrap.appendChild(cb);
  wrap.appendChild(el('span', null, { text: labelText }));
  return wrap;
}

export function colorInput(value, onChange) {
  return el('input', 'b-color', {
    type: 'color', value: value || '#000000',
    on: { input: e => onChange(e.target.value) }
  });
}

export function button(text, onClick, cls) {
  return el('button', 'b-btn ' + (cls || ''), { type: 'button', text, on: { click: onClick } });
}

// Read a File, downscale to maxDim, return a JPEG/PNG data URL.
export function fileToDataURL(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('not an image'));
      img.onload = () => {
        const scale = Math.min(1, (maxDim || 1600) / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = el('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        // Keep PNG for graphics with transparency, JPEG for photos.
        const isPng = /\.png$/i.test(file.name || '') || (file.type === 'image/png');
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

let imgCounter = 0;
// An image picker that uploads into the in-memory media map and reports the
// presentation-relative path it was stored under. `resolvePreview` turns a
// stored path back into a data URL for the thumbnail.
export function imageField(currentPath, mediaBlobs, onPath, resolvePreview) {
  const wrap = el('div', 'b-image');
  const thumb = el('div', 'b-image-thumb');
  function paint() {
    thumb.innerHTML = '';
    const src = currentPath && resolvePreview ? resolvePreview(currentPath) : null;
    if (src) {
      thumb.appendChild(el('img', null, { src }));
    } else {
      thumb.appendChild(el('span', 'b-image-empty', { text: 'No image' }));
    }
  }
  const input = el('input', null, {
    type: 'file', accept: 'image/*', hidden: true,
    on: { change: async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const dataUrl = await fileToDataURL(f, 1600);
        const ext = (f.type === 'image/png' || /\.png$/i.test(f.name)) ? 'png' : 'jpg';
        const path = 'media/img-' + (Date.now().toString(36)) + '-' + (imgCounter++) + '.' + ext;
        mediaBlobs[path] = dataUrl;
        currentPath = path;
        onPath(path);
        paint();
      } catch (err) { toast("Couldn't load that image - use a PNG or JPG."); }
      e.target.value = '';
    } }
  });
  const pick = button(currentPath ? 'Replace image' : 'Add image', () => input.click(), 'b-btn--ghost');
  const clear = button('Remove', () => { currentPath = null; onPath(undefined); paint(); pick.textContent = 'Add image'; }, 'b-btn--link');
  paint();
  wrap.appendChild(thumb);
  const row = el('div', 'b-image-actions');
  row.appendChild(input); row.appendChild(pick); row.appendChild(clear);
  wrap.appendChild(row);
  return wrap;
}

export function debounce(fn, ms) {
  let t;
  return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}

// kebab-case a label into a stable id (for stage/option ids).
export function kebab(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
}

// ---- in-page dialogs + toasts ----------------------------------------------
// The builder used native prompt()/alert()/confirm() for everything - naming,
// the GitHub token, import reports, deletions. Native dialogs look broken in
// 2026, block the tab, and discard the user's input when mis-dismissed. These
// two primitives replace all of them.

// dialog({ title, body, fields, buttons, danger }) -> Promise<{button, values} | null>
//   body:    html string (trusted, builder-authored copy only)
//   fields:  [{ key, label, value, placeholder, hint, type }]
//   buttons: [{ label, value, primary, danger }]  (Escape/backdrop -> null)
export function dialog(opts) {
  return new Promise(resolve => {
    const overlay = el('div', 'b-modal-overlay');
    const box = el('div', 'b-modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    if (opts.title) {
      const h = el('h3', 'b-modal-title', { text: opts.title });
      box.appendChild(h);
    }
    if (opts.body) box.appendChild(el('div', 'b-modal-body', { html: opts.body }));

    const inputs = {};
    (opts.fields || []).forEach(f => {
      const control = f.type === 'textarea'
        ? el('textarea', 'b-input b-textarea', { rows: f.rows || 3, value: f.value == null ? '' : f.value, placeholder: f.placeholder || '' })
        : el('input', 'b-input', { type: f.type || 'text', value: f.value == null ? '' : f.value, placeholder: f.placeholder || '' });
      inputs[f.key] = control;
      box.appendChild(field(f.label || '', control, f.hint));
      if (f.onInput) control.addEventListener('input', () => f.onInput(control.value, box));
    });

    const row = el('div', 'b-modal-actions');
    const done = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      if (value === null) return resolve(null);
      const values = {};
      for (const k in inputs) values[k] = inputs[k].value.trim();
      resolve({ button: value, values });
    };
    const buttons = opts.buttons || [{ label: 'OK', value: 'ok', primary: true }];
    buttons.forEach(b => {
      const btn = button(b.label, () => done(b.value),
        b.primary ? 'b-btn--primary' : (b.danger ? 'b-btn--danger' : 'b-btn--ghost'));
      if (b.primary) btn.dataset.primary = '1';
      row.appendChild(btn);
    });
    row.appendChild(button('Cancel', () => done(null), 'b-btn--link'));
    box.appendChild(row);

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        const primary = row.querySelector('[data-primary]');
        if (primary) primary.click();
      }
    }
    document.addEventListener('keydown', onKey, true);
    // Close on a true backdrop click only: a drag-select that starts inside
    // the dialog and releases over the backdrop must not discard the input.
    let downOnOverlay = false;
    overlay.addEventListener('mousedown', (e) => { downOnOverlay = e.target === overlay; });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && downOnOverlay) done(null); });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const first = box.querySelector('input, textarea') || row.querySelector('button');
    if (first) first.focus();
    if (first && first.select && first.value) first.select();
  });
}

// toast(message, { action: {label, onClick}, duration }) - transient notice
// with an optional action button ("Undo"). One at a time; new replaces old.
let activeToast = null;
export function toast(message, opts) {
  opts = opts || {};
  if (activeToast) activeToast.remove();
  const t = el('div', 'b-toast');
  t.setAttribute('role', 'status');
  t.appendChild(el('span', null, { text: message }));
  if (opts.action) {
    t.appendChild(button(opts.action.label, () => {
      t.remove();
      if (activeToast === t) activeToast = null;
      opts.action.onClick();
    }, 'b-btn--toast'));
  }
  document.body.appendChild(t);
  activeToast = t;
  setTimeout(() => {
    if (activeToast === t) { t.remove(); activeToast = null; }
  }, opts.duration || (opts.action ? 6000 : 3500));
}
