// Deck import: turn an existing PowerPoint/Keynote deck into presentation stages.
//
// Two routes, because they trade off differently and both are worth having:
//
//   .pdf   - PowerPoint's own renderer did the work (File > Export > PDF), so we
//            get pixel-accurate slides: fonts, SmartArt, charts, layout, all of
//            it. Each page is rasterised client-side with pdf.js into a `slide`
//            stage. The text layer is still read, so titles and [[poll]] markers
//            are picked up - we just can't re-flow the design.
//
//   .pptx  - the file is a zip of OOXML, so we can pull out real text, speaker
//            notes and embedded images and build *editable* stages (title,
//            blurb, figure). No visual fidelity: we are rebuilding the slide in
//            the engine's own design, not reproducing PowerPoint's.
//
// Poll slides: a slide is turned into a live poll when its text or speaker notes
// contain the marker [[poll]]. Everything after the marker becomes the options.
// Without a marker a slide imports as a plain stage and the teacher flips it to
// a poll in the builder - deliberately conservative, because guessing wrong and
// silently turning a content slide into a vote is worse than one extra click.

import { kebab } from './ui.js';

const SLIDE_WIDTH   = 1600;   // px; raster width for PDF pages
const JPEG_QUALITY  = 0.82;
const MAX_SLIDES    = 200;
const POLL_MARKER   = /\[\[\s*poll\s*\]\]/i;

// ---- small helpers ---------------------------------------------------------

function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error || new Error('Could not read the file.'));
    r.onload = () => resolve(r.result);
    r.readAsArrayBuffer(file);
  });
}

// JSZip ships as a UMD bundle, not an ES module, so it goes in via a tag.
let jszipPromise = null;
function loadJsZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (jszipPromise) return jszipPromise;
  jszipPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/jszip.min.js', import.meta.url).href;
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('Could not load the zip reader.'));
    document.head.appendChild(s);
  });
  return jszipPromise;
}

function uniqueId(taken, base) {
  let id = base, n = 2;
  while (taken.has(id)) id = base + '-' + (n++);
  taken.add(id);
  return id;
}

// Build a poll from a marked slide. The rule is deliberately dull, because a
// teacher has to be able to predict it from looking at the slide: the slide's
// title is the question, and every other line on the slide is an option. Where
// the marker physically sits does not matter - it is a flag, not a delimiter.
//
// The one exception is options written in the speaker notes after the marker:
// those win, so a teacher can put the question on the slide and keep the answer
// choices off the projected image entirely.
function pollFrom(title, bodyLines, notesLines) {
  const strip = ls => (ls || []).map(l => l.replace(POLL_MARKER, '').trim()).filter(Boolean);
  // A wrapped title arrives as one joined string, so drop any line that is part
  // of it, not just an exact match.
  const notTitle = l => l !== title && !(title && title.includes(l));

  if (notesLines && notesLines.some(l => POLL_MARKER.test(l))) {
    const i = notesLines.findIndex(l => POLL_MARKER.test(l));
    const fromNotes = strip(notesLines.slice(i)).filter(notTitle);
    if (fromNotes.length >= 2) return { question: title, options: fromNotes.slice(0, 8) };
  }
  return { question: title, options: strip(bodyLines).filter(notTitle).slice(0, 8) };
}

// `imageKey` decides how the projector treats the picture. For a PDF import the
// image IS the whole slide - it already shows the question and the answers as
// the teacher designed them - so it goes in `slideImage` and the engine drops
// its own heading and option list rather than printing the question three
// times. For a .pptx import the picture is just one graphic from the slide, so
// it goes in `figure` and sits above a normally-rendered question.
function mcqStage(id, question, optionLabels, imagePath, imageKey) {
  const taken = new Set();
  const stage = {
    id,
    type: 'mcq',
    title: question,
    options: optionLabels.map((label, i) => ({
      id: uniqueId(taken, kebab(label) || ('option-' + (i + 1))),
      label
    }))
  };
  if (imagePath) stage[imageKey || 'figure'] = imagePath;
  // A poll needs at least two things to choose between.
  while (stage.options.length < 2) {
    stage.options.push({ id: uniqueId(taken, 'option-' + (stage.options.length + 1)),
                         label: 'Option ' + (stage.options.length + 1) });
  }
  return stage;
}

// ---- PDF route -------------------------------------------------------------

let pdfjsPromise = null;
function loadPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = import('../vendor/pdf.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
    return lib;
  });
  return pdfjsPromise;
}

// Group a page's text items into lines, top of the page first, keeping each
// line's font size so we can tell a title from a bullet.
function pageLines(tc) {
  const rows = new Map();
  (tc.items || []).forEach(i => {
    if (!i.str || !i.str.trim()) return;
    const y = Math.round(((i.transform && i.transform[5]) || 0) / 4);
    const size = Math.abs((i.transform && i.transform[3]) || 0);
    if (!rows.has(y)) rows.set(y, { y, size, parts: [] });
    const row = rows.get(y);
    row.parts.push(i.str);
    if (size > row.size) row.size = size;
  });
  return [...rows.values()]
    .sort((a, b) => b.y - a.y)                   // PDF y grows upwards
    .map(r => ({ y: r.y, size: r.size, text: r.parts.join('').replace(/\s+/g, ' ').trim() }))
    .filter(r => r.text);
}

// The title is the TOPMOST of the page's large lines, not simply the largest:
// picking the largest gets it wrong on any slide with a big pull-figure
// ("1.2 - 2.4 L/h" at 60pt under a 44pt heading), and the heading at the top is
// what the teacher thinks of as the slide's name.
//
// A title that wrapped onto two or three lines has to come back as one string,
// so we keep taking lines while they are the SAME size as the first - same size
// means same text run, whereas the pull-figure below is a different size and
// stops the walk.
function titleFromLines(lines) {
  if (!lines.length) return '';
  const max = Math.max(...lines.map(l => l.size));
  let i = lines.findIndex(l => l.size >= max * 0.7);
  if (i < 0) i = 0;
  const first = lines[i].size;
  const parts = [];
  for (let j = i; j < lines.length; j++) {
    if (Math.abs(lines[j].size - first) > first * 0.1) break;
    parts.push(lines[j].text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

async function importPdf(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const data = await readArrayBuffer(file);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const total = Math.min(pdf.numPages, MAX_SLIDES);
  const warnings = [];
  if (pdf.numPages > MAX_SLIDES) {
    warnings.push(`Deck has ${pdf.numPages} slides; only the first ${MAX_SLIDES} were imported.`);
  }

  const stages = [];
  const media = {};
  const taken = new Set();
  const stamp = Date.now().toString(36);
  let markedPolls = 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (let n = 1; n <= total; n++) {
    onProgress && onProgress(n, total, 'Rendering slide ' + n + ' of ' + total);
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: SLIDE_WIDTH / base.width });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    // Slides are usually white; without this, transparent regions go black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // intent:'print' matters for more than fidelity: with the default 'display'
    // intent pdf.js steps through the operator list on requestAnimationFrame,
    // which browsers stop firing in a backgrounded tab - so a teacher who
    // switched tabs mid-import would hang forever. Print intent renders in a
    // plain loop and finishes regardless of tab visibility.
    await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;

    const path = `media/slide-${String(n).padStart(3, '0')}-${stamp}.jpg`;
    media[path] = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    let title = '', lines = [];
    try {
      const rows = pageLines(await page.getTextContent());
      title = titleFromLines(rows);
      lines = rows.map(r => r.text);
    } catch (e) { /* image-only slide: fall back to a numbered title */ }
    title = title || 'Slide ' + n;

    if (lines.some(l => POLL_MARKER.test(l))) {
      const { question, options } = pollFrom(title, lines, null);
      stages.push(mcqStage(uniqueId(taken, kebab(question) || 'poll-' + n),
                           question, options, path, 'slideImage'));
      markedPolls++;
    } else {
      stages.push({
        id: uniqueId(taken, 'slide-' + String(n).padStart(3, '0')),
        type: 'slide',
        title,
        image: path
      });
    }
    page.cleanup();
  }

  if (markedPolls) {
    warnings.push('The [[poll]] marker is printed on the exported slide, so it stays visible in the image. ' +
      'To keep it off the projector, delete the marker, re-export, and use "Turn into a poll" in the builder instead.');
  }

  return { stages, media, warnings, fidelity: 'image' };
}

// ---- PPTX route ------------------------------------------------------------

const XML = new DOMParser();

function parseXml(text) { return XML.parseFromString(text, 'application/xml'); }

// rId -> target path, resolved against the part's own folder.
function relsMap(doc, baseDir) {
  const out = {};
  if (!doc) return out;
  [...doc.getElementsByTagName('Relationship')].forEach(r => {
    const id = r.getAttribute('Id');
    let target = r.getAttribute('Target') || '';
    if (r.getAttribute('TargetMode') === 'External') { out[id] = { external: true, target }; return; }
    // Normalise "../media/image1.png" against the part's directory.
    const parts = (baseDir + '/' + target).split('/');
    const stack = [];
    parts.forEach(p => {
      if (p === '..') stack.pop();
      else if (p && p !== '.') stack.push(p);
    });
    out[id] = { external: false, target: stack.join('/') };
  });
  return out;
}

// Paragraph text for one shape, one string per <a:p>.
function shapeParagraphs(sp) {
  return [...sp.getElementsByTagName('a:p')].map(p =>
    [...p.getElementsByTagName('a:t')].map(t => t.textContent).join('').trim()
  ).filter(Boolean);
}

function isTitleShape(sp) {
  const ph = sp.getElementsByTagName('p:ph')[0];
  const type = ph && ph.getAttribute('type');
  return type === 'title' || type === 'ctrTitle';
}

function extFor(path) {
  const m = /\.([a-z0-9]+)$/i.exec(path || '');
  return m ? m[1].toLowerCase() : 'png';
}

async function importPptx(file, onProgress) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(await readArrayBuffer(file));
  const warnings = [];

  const presDoc = await readXml(zip, 'ppt/presentation.xml');
  if (!presDoc) throw new Error('That does not look like a .pptx file.');
  const presRels = relsMap(await readXml(zip, 'ppt/_rels/presentation.xml.rels'), 'ppt');

  // Slide order comes from sldIdLst, not from filename order - decks that have
  // had slides reordered or deleted do not have contiguous slideN.xml numbering.
  const slidePaths = [...presDoc.getElementsByTagName('p:sldId')]
    .map(s => s.getAttribute('r:id'))
    .map(rid => presRels[rid] && presRels[rid].target)
    .filter(Boolean);

  if (!slidePaths.length) throw new Error('No slides found in that file.');
  const total = Math.min(slidePaths.length, MAX_SLIDES);
  if (slidePaths.length > MAX_SLIDES) {
    warnings.push(`Deck has ${slidePaths.length} slides; only the first ${MAX_SLIDES} were imported.`);
  }

  const stages = [];
  const media = {};
  const taken = new Set();
  const stamp = Date.now().toString(36);
  const imageCache = {};   // zip path -> media/ path, so a repeated logo is stored once
  let skippedImages = 0;

  for (let n = 0; n < total; n++) {
    const slidePath = slidePaths[n];
    onProgress && onProgress(n + 1, total, 'Reading slide ' + (n + 1) + ' of ' + total);
    const doc = await readXml(zip, slidePath);
    if (!doc) continue;
    const dir = slidePath.split('/').slice(0, -1).join('/');
    const rels = relsMap(await readXml(zip, dir + '/_rels/' + slidePath.split('/').pop() + '.rels'), dir);

    // Text, split into the title placeholder and everything else.
    let title = '';
    const body = [];
    [...doc.getElementsByTagName('p:sp')].forEach(sp => {
      const paras = shapeParagraphs(sp);
      if (!paras.length) return;
      if (!title && isTitleShape(sp)) title = paras.join(' ').slice(0, 120);
      else body.push(...paras);
    });

    // Speaker notes - the natural place to write [[poll]] without it showing
    // on the projected slide.
    let notes = '';
    const notesRel = Object.values(rels).find(r => !r.external && /notesSlide\d+\.xml$/.test(r.target));
    if (notesRel) {
      const nd = await readXml(zip, notesRel.target);
      if (nd) notes = [...nd.getElementsByTagName('a:t')].map(t => t.textContent).join('\n');
    }

    // Largest embedded image on the slide becomes the figure.
    let figure = null, figureSize = 0;
    for (const blip of [...doc.getElementsByTagName('a:blip')]) {
      const rid = blip.getAttribute('r:embed');
      const rel = rid && rels[rid];
      if (!rel || rel.external) continue;
      const entry = zip.file(rel.target);
      if (!entry) continue;
      if (imageCache[rel.target]) {
        if (!figure) figure = imageCache[rel.target];
        continue;
      }
      const ext = extFor(rel.target);
      if (!/^(png|jpg|jpeg|gif|webp)$/.test(ext)) { skippedImages++; continue; }
      const b64 = await entry.async('base64');
      const bytes = Math.round((b64.length * 3) / 4);
      const mime = ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
      const path = `media/pptx-${String(n + 1).padStart(3, '0')}-${stamp}-${Object.keys(imageCache).length}.${ext}`;
      media[path] = `data:${mime};base64,` + b64;
      imageCache[rel.target] = path;
      if (bytes > figureSize) { figure = path; figureSize = bytes; }
    }

    const allText = body.concat(notes ? notes.split('\n') : []);
    title = title || body[0] || 'Slide ' + (n + 1);

    if (allText.some(l => POLL_MARKER.test(l))) {
      const { question, options } = pollFrom(title, body, notes ? notes.split('\n') : null);
      stages.push(mcqStage(uniqueId(taken, kebab(question) || 'poll-' + (n + 1)),
                           question, options, figure));
    } else {
      const stage = {
        id: uniqueId(taken, kebab(title) || 'slide-' + (n + 1)),
        type: 'content',
        title
      };
      const blurbLines = body.filter(l => l !== title);
      if (blurbLines.length) stage.blurb = blurbLines.join('<br>');
      if (figure) stage.figure = figure;
      // The engine's content stage needs something to show besides a heading.
      if (!stage.figure && !stage.blurb) stage.quote = title;
      stages.push(stage);
    }
  }

  // A slide can carry several images (a chart plus a corner logo) but only the
  // largest becomes the figure. Drop the rest - publish commits every blob in
  // the map, so orphans would bloat the repo for nothing.
  const used = new Set(stages.flatMap(s => [s.figure, s.slideImage]).filter(Boolean));
  Object.keys(media).forEach(k => { if (!used.has(k)) delete media[k]; });

  if (skippedImages) warnings.push(`${skippedImages} image(s) in an unsupported format (EMF/WMF) were skipped.`);
  warnings.push('PowerPoint layout, fonts and animations are not reproduced — .pptx import rebuilds each slide in your presentation theme. Export the deck as PDF instead if you want the slides to look exactly as they do in PowerPoint.');

  return { stages, media, warnings, fidelity: 'text' };
}

async function readXml(zip, path) {
  const entry = zip.file(path);
  if (!entry) return null;
  const doc = parseXml(await entry.async('string'));
  return doc.getElementsByTagName('parsererror').length ? null : doc;
}

// ---- entry point -----------------------------------------------------------

// Returns { stages, media, warnings, fidelity }. `media` is a path -> dataURL
// map to merge into the draft's mediaBlobs; `stages` reference those paths.
export async function importDeck(file, onProgress) {
  const name = (file && file.name) || '';
  if (/\.pdf$/i.test(name))  return importPdf(file, onProgress);
  if (/\.pptx$/i.test(name)) return importPptx(file, onProgress);
  if (/\.ppt$/i.test(name)) {
    throw new Error('Old .ppt files are not supported. Open it in PowerPoint and save as .pptx, or export as PDF.');
  }
  if (/\.key$/i.test(name)) {
    throw new Error('Keynote files are not supported directly. In Keynote use File > Export To > PDF, then import the PDF.');
  }
  throw new Error('Choose a .pdf or .pptx file.');
}

export const IMPORT_ACCEPT = '.pdf,.pptx';
