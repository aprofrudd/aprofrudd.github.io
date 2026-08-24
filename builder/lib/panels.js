// Right-column edit panels for the builder: per-stage-type forms, the theme
// panel, and the settings panel. Each renderer returns a DOM node and mutates
// the spec in place, calling ctx.onChange() after every edit.
//
// ctx = { mediaBlobs, resolvePreview(path)->dataUrl|null, onChange(), onStructure() }
//   onChange()    - content changed; refresh preview + autosave
//   onStructure() - slide list changed (title/order/count); also re-render list

import { el, field, textInput, textArea, numberInput, selectInput, checkbox,
         colorInput, button, imageField, kebab } from './ui.js';
import { THEME_PRESETS, FONT_PRESETS } from './theme.js';

// ---- per-stage-type panels -------------------------------------------------

export function stagePanel(stage, ctx) {
  const root = el('div', 'b-panel');
  root.appendChild(el('div', 'b-panel-type', { text: TYPE_LABEL[stage.type] || (stage.type.toUpperCase() + ' slide') }));

  // Title (drives the slide-list label) + blurb, common to all types.
  root.appendChild(field('Title', textInput(stage.title, v => { stage.title = v; ctx.onRename(); })));
  if (stage.type !== 'poster') {
    // The blurb is rendered with innerHTML, and deck import joins bullets with
    // <br> - but nobody should have to EDIT raw <br> tags. The textarea shows
    // newlines and converts on the way in and out.
    const brToNl = v => String(v == null ? '' : v).replace(/<br\s*\/?>(\n)?/gi, '\n');
    const nlToBr = v => v.replace(/\n/g, '<br>');
    root.appendChild(field('Blurb (subtitle)', textArea(brToNl(stage.blurb),
      v => { stage.blurb = v ? nlToBr(v) : undefined; ctx.onChange(); }, 2)));
  }

  if (stage.type === 'mcq')     mcqFields(stage, root, ctx);
  if (stage.type === 'content') contentFields(stage, root, ctx);
  if (stage.type === 'media')   mediaFields(stage, root, ctx);
  if (stage.type === 'map')     mapFields(stage, root, ctx);
  if (stage.type === 'slide')   slideFields(stage, root, ctx);

  return root;
}

const TYPE_LABEL = {
  slide: 'IMPORTED SLIDE',
  mcq: 'POLL',
  content: 'INFO slide',
  media: 'VIDEO slide',
  map: 'MAP slide'
};

// An imported deck slide: the rendered page image, plus the one-click route to
// turning it into a live poll. Converting keeps the image (as the poll's
// figure), so the students still see the original slide while they vote.
function slideFields(stage, root, ctx) {
  root.appendChild(field('Slide image', imageField(stage.image, ctx.mediaBlobs,
    p => { stage.image = p; ctx.onChange(); }, ctx.resolvePreview),
    'Replace this if you edit the slide in PowerPoint and re-export it.'));

  root.appendChild(el('hr', 'b-sep'));
  root.appendChild(el('p', 'b-field-hint', {
    text: 'This slide is displayed only - nobody votes on it. Turn it into a poll to collect answers on the same slide.'
  }));
  root.appendChild(button('Turn into a poll', () => {
    stage.type = 'mcq';
    stage.slideImage = stage.image;
    delete stage.image;
    stage.options = [{ id: 'option-1', label: 'Option 1' }, { id: 'option-2', label: 'Option 2' }];
    ctx.onStructure();
  }, 'b-btn--primary'));
}

function imagePicker(label, stage, key, ctx, captionKey) {
  const box = el('div', 'b-subgroup');
  box.appendChild(field(label, imageField(stage[key], ctx.mediaBlobs,
    p => { stage[key] = p; ctx.onChange(); }, ctx.resolvePreview)));
  if (captionKey) {
    box.appendChild(field('Caption', textInput(stage[captionKey],
      v => { stage[captionKey] = v || undefined; ctx.onChange(); })));
  }
  return box;
}

function mcqFields(stage, root, ctx) {
  // An imported deck slide behind the poll: the projector shows this instead of
  // re-rendering the question, so it gets its own field rather than the
  // "figure above the options" one.
  if (stage.slideImage) {
    root.appendChild(field('Slide image (shown on the projector)',
      imageField(stage.slideImage, ctx.mediaBlobs,
        p => { stage.slideImage = p; ctx.onChange(); }, ctx.resolvePreview),
      'The projector shows this slide; students see the options on their phones.'));
    root.appendChild(el('hr', 'b-sep'));
  }
  root.appendChild(field('Let students pick up to', numberInput(stage.maxSelect || 1,
    v => { stage.maxSelect = (v && v > 1) ? v : undefined; ctx.onChange(); }, 1, 6), '1 = single choice'));

  const optsWrap = el('div', 'b-options');
  root.appendChild(el('div', 'b-field-label', { text: 'Options' }));
  root.appendChild(optsWrap);
  stage.options = stage.options || [];

  function ensureId(opt, label) {
    if (opt.id) return;
    let base = kebab(label) || 'option';
    let id = base, n = 2;
    while (stage.options.some(o => o !== opt && o.id === id)) id = base + '-' + (n++);
    opt.id = id;
  }
  function repaint(focusLast) {
    optsWrap.innerHTML = '';
    stage.options.forEach((opt, i) => {
      const row = el('div', 'b-option-row');
      const labelInput = textInput(opt.label, v => { opt.label = v; ensureId(opt, v); ctx.onChange(); }, 'Option text');
      row.appendChild(labelInput);
      row.appendChild(textInput(opt.sublabel, v => { opt.sublabel = v || undefined; ctx.onChange(); }, 'Sub-label (optional)'));
      const rm = button('✕', () => {
        if (ctx.snapshot) ctx.snapshot('Option removed');
        stage.options.splice(i, 1);
        repaint();
        ctx.onChange();
        if (ctx.toast) ctx.toast('Option removed', true);
      }, 'b-btn--icon');
      rm.setAttribute('aria-label', 'Remove option: ' + (opt.label || 'untitled'));
      row.appendChild(rm);
      optsWrap.appendChild(row);
      if (focusLast && i === stage.options.length - 1) labelInput.focus();
    });
    addBtn.disabled = stage.options.length >= 6;
  }
  const addBtn = button('+ Add option', () => {
    if (stage.options.length >= 6) return;
    // Empty on purpose: pre-filled placeholder text ("New option") had to be
    // selected and retyped every single time.
    stage.options.push({ label: '' });
    repaint(true);
    ctx.onChange();
  }, 'b-btn--ghost');
  root.appendChild(addBtn);
  repaint();

  if (!stage.slideImage) {
    root.appendChild(el('hr', 'b-sep'));
    root.appendChild(imagePicker('Figure above the options (optional)', stage, 'figure', ctx, 'figureCaption'));
  }

  // Undo an accidental "turn into a poll" without losing the imported image.
  if (stage.slideImage) {
    root.appendChild(el('hr', 'b-sep'));
    root.appendChild(button('Back to a display-only slide', () => {
      if (ctx.snapshot) ctx.snapshot('poll turned back into a slide');
      stage.type = 'slide';
      stage.image = stage.slideImage;
      delete stage.slideImage;
      delete stage.options; delete stage.maxSelect;
      ctx.onStructure();
      if (ctx.toast) ctx.toast('Voting removed from this slide', true);
    }, 'b-btn--link'));
  }
}

function contentFields(stage, root, ctx) {
  root.appendChild(imagePicker('Figure (optional)', stage, 'figure', ctx, 'figureCaption'));
  root.appendChild(el('hr', 'b-sep'));

  // Table editor: pipe-delimited, first line = headers.
  const tableText = stage.table
    ? [stage.table.headers].concat(stage.table.rows || []).map(r => (r || []).join(' | ')).join('\n')
    : '';
  root.appendChild(field('Table (optional)', textArea(tableText, v => {
    const lines = v.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { stage.table = undefined; ctx.onChange(); return; }
    const grid = lines.map(l => l.split('|').map(c => c.trim()));
    stage.table = Object.assign({ headers: grid[0], rows: grid.slice(1) },
      stage.table && stage.table.highlightTop ? { highlightTop: stage.table.highlightTop } : {});
    ctx.onChange();
  }, 4), 'One row per line, cells separated by  |  . First line = column headers.'));
  root.appendChild(field('Highlight top N rows', numberInput(stage.table && stage.table.highlightTop,
    v => { if (stage.table) { stage.table.highlightTop = v || undefined; ctx.onChange(); } }, 0, 20)));

  root.appendChild(el('hr', 'b-sep'));
  root.appendChild(field('Pull-quote (optional)', textArea(stage.quote, v => { stage.quote = v || undefined; ctx.onChange(); }, 2)));
  root.appendChild(field('Citation', textInput(stage.citation, v => { stage.citation = v || undefined; ctx.onChange(); }, 'Author, Year')));
  root.appendChild(field('Source link', textInput(stage.link, v => { stage.link = v || undefined; ctx.onChange(); }, 'https://...')));

  root.appendChild(el('hr', 'b-sep'));
  root.appendChild(imagePicker('Side figure - shown in the results pane (optional)', stage, 'sideFigure', ctx, 'sideFigureCaption'));
}

function mediaFields(stage, root, ctx) {
  root.appendChild(field('Video URL', textInput(stage.video, v => { stage.video = v || undefined; ctx.onChange(); }, 'media/clip.mp4 or https://...'),
    'Host large videos externally (e.g. a CDN/YouTube file URL) - videos are not committed with the presentation.'));
  root.appendChild(imagePicker('Poster image (shown before play, optional)', stage, 'poster', ctx));
}

function mapFields(stage, root, ctx) {
  root.appendChild(field('Tap hint', textInput(stage.tapHint, v => { stage.tapHint = v || undefined; ctx.onChange(); }, 'Tap a place')));
  root.appendChild(el('p', 'b-note', { text: 'Map stages use the shared host-cities basemap. Edit the pins in Settings → Map places.' }));
}

// ---- theme panel -----------------------------------------------------------

export function themePanel(spec, ctx) {
  const root = el('div', 'b-panel');
  spec.theme = spec.theme || {};
  const t = spec.theme;

  root.appendChild(el('div', 'b-panel-type', { text: 'Theme' }));

  // Preset bundles
  root.appendChild(field('Preset', selectInput('', [{ value: '', label: 'Custom / pick below' }].concat(
    Object.entries(THEME_PRESETS).map(([k, p]) => ({ value: k, label: p.label }))), k => {
      const p = THEME_PRESETS[k]; if (!p) return;
      t.paper = p.paper; t.ink = p.ink; t.accent = p.accent; t.pin = p.pin; t.font = p.font;
      ctx.onRebuild();   // re-render the panel so the colour swatches update
    })));

  const colors = [
    ['Background', 'paper'], ['Text', 'ink'], ['Accent (buttons/bars)', 'accent'], ['Emphasis (pins)', 'pin']
  ];
  const grid = el('div', 'b-color-grid');
  colors.forEach(([label, key]) => {
    const cell = el('div', 'b-color-cell');
    cell.appendChild(colorInput(t[key], v => { t[key] = v; ctx.onChange(); }));
    cell.appendChild(el('span', null, { text: label }));
    grid.appendChild(cell);
  });
  root.appendChild(grid);

  root.appendChild(field('Fonts', selectInput(t.font || 'classic',
    Object.entries(FONT_PRESETS).map(([k, p]) => ({ value: k, label: p.label })),
    v => { t.font = v; ctx.onChange(); })));

  // Background
  root.appendChild(el('hr', 'b-sep'));
  root.appendChild(el('div', 'b-field-label', { text: 'Background' }));
  t.background = t.background || { type: 'solid' };
  const bg = t.background;
  root.appendChild(selectInput(bg.type || 'solid', [
    { value: 'solid', label: 'Solid (uses Background colour)' },
    { value: 'gradient', label: 'Gradient' },
    { value: 'image', label: 'Image' }
  ], v => { bg.type = v; ctx.onRebuild(); }));

  if (bg.type === 'gradient') {
    const g = el('div', 'b-color-grid');
    [['From', 'from'], ['To', 'to']].forEach(([label, key]) => {
      const cell = el('div', 'b-color-cell');
      cell.appendChild(colorInput(bg[key] || (key === 'from' ? t.paper : '#dddddd'), v => { bg[key] = v; ctx.onChange(); }));
      cell.appendChild(el('span', null, { text: label }));
      g.appendChild(cell);
    });
    root.appendChild(g);
    root.appendChild(field('Angle', numberInput(bg.angle == null ? 160 : bg.angle, v => { bg.angle = v; ctx.onChange(); }, 0, 360)));
  } else if (bg.type === 'image') {
    root.appendChild(field('Background image', imageField(bg.src, ctx.mediaBlobs,
      p => { bg.src = p; ctx.onChange(); }, ctx.resolvePreview)));
  }
  return root;
}

// ---- settings panel --------------------------------------------------------

export function settingsPanel(spec, ctx) {
  const root = el('div', 'b-panel');
  root.appendChild(el('div', 'b-panel-type', { text: 'Settings' }));

  root.appendChild(field('Presentation name', textInput(spec.title, v => { spec.title = v; ctx.onRename(); })));

  // Renaming the web address is a real move (the draft and its images follow
  // it), so it applies when you leave the field - not on every keystroke,
  // which used to strand a ghost draft per pause while typing.
  const slugInput = textInput(spec.slug, () => {}, 'heat-2026');
  slugInput.addEventListener('change', () => {
    // A cleared field must not silently rename to kebab('') === 'item'.
    if (!slugInput.value.trim()) { slugInput.value = spec.slug; return; }
    const next = kebab(slugInput.value);
    slugInput.value = next;
    if (next && next !== spec.slug && ctx.onSlugChange) ctx.onSlugChange(next);
  });
  const slugHint = ctx.published
    ? 'Locked - this presentation is already published at this address.'
    : 'Students join at alanruddock.com/' + (spec.slug || '…') + '/ - short names make easier joins.';
  root.appendChild(field('Web address', slugInput, slugHint));
  if (ctx.published) slugInput.disabled = true;

  root.appendChild(field('Kicker (small tagline)', textInput(spec.kicker, v => { spec.kicker = v || undefined; ctx.onChange(); })));
  root.appendChild(field('Phone heading', textInput(spec.heading, v => { spec.heading = v || undefined; ctx.onChange(); })));
  root.appendChild(field('Projector heading', textInput(spec.projectorHeading, v => { spec.projectorHeading = v || undefined; ctx.onChange(); })));
  root.appendChild(field('Logo (optional)', imageField(spec.logo, ctx.mediaBlobs,
    p => { spec.logo = p; ctx.onChange(); }, ctx.resolvePreview)));

  // Advanced: nobody needs "Lesson ID (vote storage key)" in their face.
  const adv = el('details', 'b-advanced');
  adv.appendChild(el('summary', null, { text: 'Advanced' }));
  const lidField = field('Vote storage key', textInput(spec.lessonId, v => { spec.lessonId = kebab(v); ctx.onChange(); }),
    ctx.published ? 'Locked once published - votes are keyed on it.'
                  : "Defaults to the web address. Only change it if two presentations must share (or must not share) their votes.");
  adv.appendChild(lidField);
  if (ctx.published) lidField.querySelector('.b-input').disabled = true;
  root.appendChild(adv);

  // Map places (only if a map stage exists)
  if ((spec.stages || []).some(s => s.type === 'map')) {
    root.appendChild(el('hr', 'b-sep'));
    root.appendChild(el('div', 'b-field-label', { text: 'Map places (pins)' }));
    root.appendChild(el('p', 'b-note', { text: 'x / y are percentage positions on the basemap (0-100). Name shows on the pin.' }));
    spec.cities = spec.cities || [];
    const list = el('div', 'b-cities');
    function repaint() {
      list.innerHTML = '';
      spec.cities.forEach((c, i) => {
        const row = el('div', 'b-city-row');
        row.appendChild(textInput(c.name, v => { c.name = v; if (!c.id) c.id = kebab(v); ctx.onChange(); }, 'Name'));
        row.appendChild(numberInput(c.x, v => { c.x = v; ctx.onChange(); }, 0, 100));
        row.appendChild(numberInput(c.y, v => { c.y = v; ctx.onChange(); }, 0, 100));
        row.appendChild(button('✕', () => { spec.cities.splice(i, 1); repaint(); ctx.onChange(); }, 'b-btn--icon'));
        list.appendChild(row);
      });
    }
    root.appendChild(list);
    root.appendChild(button('+ Add place', () => {
      spec.cities.push({ id: 'place-' + (spec.cities.length + 1), name: 'New place', x: 50, y: 50 });
      repaint(); ctx.onChange();
    }, 'b-btn--ghost'));
    repaint();
  }
  return root;
}
