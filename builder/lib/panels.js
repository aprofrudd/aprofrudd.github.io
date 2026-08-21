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
    root.appendChild(field('Blurb (subtitle)', textArea(stage.blurb, v => { stage.blurb = v || undefined; ctx.onChange(); }, 2)));
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
  function repaint() {
    optsWrap.innerHTML = '';
    stage.options.forEach((opt, i) => {
      const row = el('div', 'b-option-row');
      row.appendChild(textInput(opt.label, v => { opt.label = v; ensureId(opt, v); ctx.onChange(); }, 'Option label'));
      row.appendChild(textInput(opt.sublabel, v => { opt.sublabel = v || undefined; ctx.onChange(); }, 'Sub-label (optional)'));
      row.appendChild(button('✕', () => { stage.options.splice(i, 1); repaint(); ctx.onChange(); }, 'b-btn--icon'));
      optsWrap.appendChild(row);
    });
    addBtn.disabled = stage.options.length >= 6;
  }
  const addBtn = button('+ Add option', () => {
    if (stage.options.length >= 6) return;
    const opt = { label: 'New option' }; ensureId(opt, opt.label);
    stage.options.push(opt); repaint(); ctx.onChange();
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
      if (!confirm('Remove the voting options and show this as a plain slide?')) return;
      stage.type = 'slide';
      stage.image = stage.slideImage;
      delete stage.slideImage;
      delete stage.options; delete stage.maxSelect;
      ctx.onStructure();
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

  root.appendChild(field('Presentation name (title)', textInput(spec.title, v => { spec.title = v; ctx.onRename(); })));
  root.appendChild(field('URL slug', textInput(spec.slug, v => {
    spec.slug = kebab(v); ctx.onChange();
  }, 'heat-2026'), ctx.published ? 'Locked - this presentation is already published.' : 'Lowercase, hyphens. Becomes alanruddock.com/<slug>/'));
  if (ctx.published) root.querySelector('.b-field:last-child .b-input').disabled = true;

  root.appendChild(field('Kicker (small tagline)', textInput(spec.kicker, v => { spec.kicker = v || undefined; ctx.onChange(); })));
  root.appendChild(field('Phone heading', textInput(spec.heading, v => { spec.heading = v || undefined; ctx.onChange(); })));
  root.appendChild(field('Projector heading', textInput(spec.projectorHeading, v => { spec.projectorHeading = v || undefined; ctx.onChange(); })));
  root.appendChild(field('Logo (optional)', imageField(spec.logo, ctx.mediaBlobs,
    p => { spec.logo = p; ctx.onChange(); }, ctx.resolvePreview)));

  const lidField = field('Lesson ID (vote storage key)', textInput(spec.lessonId, v => { spec.lessonId = kebab(v); ctx.onChange(); }),
    ctx.published ? 'Locked once published - votes are keyed on it.' : 'Defaults to the slug. Keep unique.');
  root.appendChild(lidField);
  if (ctx.published) lidField.querySelector('.b-input').disabled = true;

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
