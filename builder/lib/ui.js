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
      } catch (err) { alert('Could not load image: ' + err.message); }
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
