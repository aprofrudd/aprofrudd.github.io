// Generic poster generator for the classroom-poll-site engine.
//
// Reads the student's own answers from localStorage (written by vote.js as
// `<LESSON_ID>_voted_<stageId>` = {choices:[…], voteIds:[…]}), turns each into
// a short prose fragment via the lesson's window.POSTER template, fills the
// section bodies, and renders a fixed-size academic poster the student can
// download as a PNG (html2canvas).
//
// Everything here is lesson-agnostic; the lesson supplies window.POSTER
// (poster-template.js), window.STAGES (stages.js) and optionally window.CITIES
// (cities.js). Nothing is read from or written to Firebase - names/schools
// stay on the device.

(function () {
  const LESSON_ID = window.LESSON_ID || 'lesson';
  const VOTED_PREFIX = LESSON_ID + '_voted_';
  const IDENTITY_KEY = LESSON_ID + '_identity';

  const T = window.POSTER || {};
  const STAGES = window.STAGES || [];
  const CITIES = window.CITIES || [];

  // ---- read answers from localStorage -------------------------------------

  function readVoted(stageId) {
    const raw = localStorage.getItem(VOTED_PREFIX + stageId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.choices)) return parsed.choices;
      if (parsed && 'choice' in parsed) return [parsed.choice];
    } catch (_) { return [raw]; }
    return null;
  }

  function cityName(id) {
    const c = CITIES.find(c => c.id === id);
    return c ? c.name : null;
  }

  // Join a list as "a, b and c"
  function joinNicely(items) {
    const xs = items.filter(Boolean);
    if (xs.length === 0) return '';
    if (xs.length === 1) return xs[0];
    if (xs.length === 2) return xs[0] + ' and ' + xs[1];
    return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }

  // Build the answer object `a` from the template's `answers` spec.
  function buildAnswers() {
    const a = {};
    (T.answers || []).forEach(spec => {
      const choices = readVoted(spec.stage);
      let value = null;
      if (choices && choices.length) {
        if (spec.type === 'cityName') {
          value = cityName(choices[0]);
        } else if (spec.type === 'single') {
          value = (spec.phrases && spec.phrases[choices[0]]) || null;
        } else if (spec.type === 'list') {
          const frags = choices.map(c => (spec.phrases && spec.phrases[c]) || null);
          value = joinNicely(frags) || null;
        }
      }
      a[spec.key] = value || spec.fallback || '…';
    });
    return a;
  }

  // ---- identity (name / school / title) -----------------------------------

  function readIdentity() {
    try { return JSON.parse(localStorage.getItem(IDENTITY_KEY)) || {}; }
    catch (_) { return {}; }
  }
  function writeIdentity(id) {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
  }

  // ---- rendering ----------------------------------------------------------

  const posterEl = document.getElementById('poster');
  const nameInput   = document.getElementById('f-name');
  const schoolInput = document.getElementById('f-school');
  const yearInput   = document.getElementById('f-year');
  const titleInput  = document.getElementById('f-title');
  const saveBtn     = document.getElementById('save-btn');
  const statusEl    = document.getElementById('save-status');
  const editPanel   = document.getElementById('edit-panel');
  const enterBtn    = document.getElementById('enter-btn');
  const enterConsent= document.getElementById('enter-consent');
  const enterStatus = document.getElementById('enter-status');

  const comp = T.competition || {};
  const KICKER    = T.kicker || 'Research Poster';
  const BYLINE_TAG = comp.bylineTag || '';

  const answers = buildAnswers();
  const identity = readIdentity();

  // Seed the inputs from any saved identity.
  nameInput.value   = identity.name   || '';
  schoolInput.value = identity.school || '';
  yearInput.value   = identity.year   || '';
  titleInput.value  = identity.title  || T.defaultTitle || '';

  // ---- per-section edits (student-authored overrides) ---------------------
  const EDITS_KEY = LESSON_ID + '_poster_edits';
  function readEdits() { try { return JSON.parse(localStorage.getItem(EDITS_KEY)) || {}; } catch (_) { return {}; } }
  function writeEdits(e) { localStorage.setItem(EDITS_KEY, JSON.stringify(e)); }
  let edits = readEdits();

  // ---- per-section image overrides (student-supplied figures) -------------
  // Downscaled data URLs kept on-device only (consistent with "store data,
  // not images"): they show in the live preview and the downloaded PNG, but
  // are not uploaded with a competition entry.
  const IMAGES_KEY = LESSON_ID + '_poster_images';
  const MAX_IMG_DIM = 1400;   // px; ample for a poster figure at 2x export
  function readImages() { try { return JSON.parse(localStorage.getItem(IMAGES_KEY)) || {}; } catch (_) { return {}; } }
  function writeImages(m) {
    try { localStorage.setItem(IMAGES_KEY, JSON.stringify(m)); return true; }
    catch (_) { return false; }   // localStorage quota exceeded
  }
  let images = readImages();

  // Read a chosen file, downscale it to MAX_IMG_DIM, return a JPEG data URL.
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('not an image'));
        img.onload = () => {
          const scale = Math.min(1, MAX_IMG_DIM / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function generatedText(sec) {
    return typeof sec.body === 'function' ? sec.body(answers) : (sec.body || '');
  }
  function sectionText(i, sec) {
    const e = edits[String(i)];
    return (e != null && e !== '') ? e : generatedText(sec);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPoster() {
    const name   = nameInput.value.trim()   || 'Your name';
    const school = schoolInput.value.trim()  || 'Your school';
    const year   = yearInput.value.trim();
    const title  = titleInput.value.trim()   || T.defaultTitle || '';

    const schoolLine = year ? `${school}, ${year}` : school;
    const bylineBits = [name, schoolLine, BYLINE_TAG].filter(Boolean);

    const logos = Array.isArray(T.logos) ? T.logos : [];
    const logosHtml = logos.length
      ? `<div class="p-logos">${logos.map(s =>
          `<img src="${esc(s)}" alt="" crossorigin="anonymous" onerror="this.style.display='none'">`).join('')}</div>`
      : '';

    let html = '';
    html += `<header class="p-head${logos.length ? ' p-head-logos' : ''}">
      ${logosHtml}
      <div class="p-kicker">${esc(KICKER)}</div>
      <h1 class="p-title">${esc(title)}</h1>
      <div class="p-byline">${esc(bylineBits.join('  ·  '))}</div>
    </header>`;

    html += '<div class="p-body">';
    (T.sections || []).forEach((sec, i) => {
      html += `<section class="p-section${sec.wide ? ' p-section--wide' : ''}">
        <h2 class="p-h2">${esc(sec.heading)}</h2>`;
      if (sec.figure) {
        const customImg = images[String(i)];
        const src = customImg || sec.figure;
        // The template caption describes the original figure (often with a
        // citation), so drop it once the student swaps in their own image.
        const cap = (sec.figureCaption && !customImg)
          ? `<figcaption>${esc(sec.figureCaption)}</figcaption>` : '';
        html += `<figure class="p-figure">
          <img src="${esc(src)}" alt="" crossorigin="anonymous">
          ${cap}
        </figure>`;
      }
      html += `<p class="p-text">${esc(sectionText(i, sec))}</p></section>`;
    });
    html += '</div>';

    if (T.references && T.references.length) {
      html += `<section class="p-refs"><h2 class="p-h2">References</h2><ol>`;
      T.references.forEach(r => { html += `<li>${esc(r)}</li>`; });
      html += `</ol></section>`;
    }

    if (T.footer) {
      html += `<footer class="p-foot">${esc(T.footer)}</footer>`;
    }

    posterEl.innerHTML = html;
  }

  function persist() {
    writeIdentity({
      name: nameInput.value.trim(),
      school: schoolInput.value.trim(),
      year: yearInput.value.trim(),
      title: titleInput.value.trim()
    });
  }

  // Scale the fixed 1000px-wide poster to fit the column. A transform-scaled
  // element keeps its original box size for layout, so we also pin the frame's
  // height to the scaled poster height (otherwise it reserves the full 1414px+
  // and overflows / leaves a gap).
  const POSTER_W = 1000;
  const frameEl  = document.getElementById('poster-frame');
  const scalerEl = document.getElementById('poster-scaler');
  function fitPoster() {
    const avail = frameEl.clientWidth || POSTER_W;
    const scale = Math.min(1, avail / POSTER_W);
    scalerEl.style.setProperty('--poster-scale', scale);
    // posterEl.offsetHeight is the un-scaled height; reserve the scaled height.
    frameEl.style.height = (posterEl.offsetHeight * scale) + 'px';
  }

  function refresh() { renderPoster(); fitPoster(); }

  // ---- edit panel: one textarea per section -------------------------------
  function buildEditPanel() {
    if (!editPanel) return;
    editPanel.innerHTML = '<h2 class="edit-heading">Add your own detail</h2>' +
      '<p class="edit-intro">Each section is filled in from your answers. Edit the text to add more, or replace a figure with your own image - your changes show on the poster straight away.</p>';
    (T.sections || []).forEach((sec, i) => {
      const block = document.createElement('div');
      block.className = 'edit-block';
      const id = 'edit-' + i;
      // Figure sections get a "Replace image" control; text-only sections don't.
      const imgControl = sec.figure ? `
        <div class="edit-image">
          <label class="edit-image-btn">
            <input type="file" accept="image/*" hidden>
            🖼 Replace image
          </label>
          <button type="button" class="edit-image-reset" hidden>Use original</button>
          <span class="edit-image-status"></span>
        </div>` : '';
      block.innerHTML = `
        <div class="edit-row">
          <label for="${id}">${esc(sec.heading)}</label>
          <button type="button" class="edit-reset" data-i="${i}">Reset</button>
        </div>
        <textarea id="${id}" rows="3" data-i="${i}"></textarea>
        ${imgControl}`;
      editPanel.appendChild(block);
      const ta = block.querySelector('textarea');
      ta.value = sectionText(i, sec);
      ta.addEventListener('input', () => {
        const gen = generatedText(sec);
        if (ta.value === gen || ta.value.trim() === '') { delete edits[String(i)]; }
        else { edits[String(i)] = ta.value; }
        writeEdits(edits);
        refresh();
      });
      block.querySelector('.edit-reset').addEventListener('click', () => {
        delete edits[String(i)];
        writeEdits(edits);
        ta.value = generatedText(sec);
        refresh();
      });

      // Image replace / reset wiring (figure sections only).
      if (sec.figure) {
        const fileInput = block.querySelector('.edit-image input[type=file]');
        const resetImg  = block.querySelector('.edit-image-reset');
        const statusImg = block.querySelector('.edit-image-status');
        const syncImgUI = () => {
          const has = !!images[String(i)];
          resetImg.hidden = !has;
          statusImg.textContent = has ? 'Showing your image' : '';
        };
        syncImgUI();
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          statusImg.textContent = 'Loading…';
          try {
            const dataUrl = await fileToDataURL(file);
            const prev = images[String(i)];
            images[String(i)] = dataUrl;
            if (!writeImages(images)) {
              if (prev != null) images[String(i)] = prev; else delete images[String(i)];
              statusImg.textContent = 'That image is too large to save - try a smaller one';
              return;
            }
            syncImgUI();
            refresh();
          } catch (e) {
            console.warn('[poster] image load failed:', e);
            statusImg.textContent = 'Could not load that file';
          } finally {
            fileInput.value = '';
          }
        });
        resetImg.addEventListener('click', () => {
          delete images[String(i)];
          writeImages(images);
          syncImgUI();
          refresh();
        });
      }
    });
  }

  [nameInput, schoolInput, yearInput, titleInput].forEach(input => {
    input.addEventListener('input', () => { persist(); refresh(); updateEnterEnabled(); });
  });
  window.addEventListener('resize', fitPoster);
  // Re-fit once figures load (they change the poster height).
  posterEl.addEventListener('load', fitPoster, true);

  buildEditPanel();
  refresh();
  // A couple of delayed re-fits to catch async image layout.
  setTimeout(fitPoster, 200);
  setTimeout(fitPoster, 800);

  // ---- enter the competition ----------------------------------------------
  const ENTERED_KEY = LESSON_ID + '_entered';
  let entered = localStorage.getItem(ENTERED_KEY) !== null;

  if (enterBtn) enterBtn.textContent = comp.entryLabel || '🏆 Enter the competition';
  if (enterConsent) enterConsent.textContent = comp.consent ||
    'Entering sends your name, school and poster to your teacher.';

  function updateEnterEnabled() {
    if (!enterBtn) return;
    const ready = !!(nameInput.value.trim() && schoolInput.value.trim());
    enterBtn.disabled = !ready;
    enterBtn.title = ready ? '' : 'Add your name and school first';
  }

  function setEnteredUI() {
    if (!enterBtn) return;
    enterBtn.textContent = comp.enteredLabel || 'Entered ✓ - good luck!';
    enterBtn.classList.add('entered');
  }
  if (entered) setEnteredUI();
  updateEnterEnabled();

  // Lazily create the store only when needed (single addDoc, no listeners).
  // store.js is a deferred module, so window.createStore may not exist yet at
  // load - wait for it on first use.
  let _storeP = null;
  function getStore() {
    if (!_storeP) {
      _storeP = (async () => {
        for (let i = 0; i < 150 && !window.createStore; i++) {
          await new Promise(res => setTimeout(res, 30));
        }
        if (!window.createStore) throw new Error('store unavailable');
        return window.createStore();
      })();
    }
    return _storeP;
  }

  if (enterBtn) enterBtn.addEventListener('click', async () => {
    if (enterBtn.disabled) return;
    enterBtn.disabled = true;
    enterStatus.textContent = 'Entering…';
    const payload = {
      name:   nameInput.value.trim(),
      school: schoolInput.value.trim(),
      year:   yearInput.value.trim(),
      title:  titleInput.value.trim() || T.defaultTitle || '',
      sections: (T.sections || []).map((s, i) => ({ heading: s.heading, text: sectionText(i, s) })),
      answers
    };
    try {
      const store = await getStore();
      await store.submitPoster(payload);
      localStorage.setItem(ENTERED_KEY, String(Date.now()));
      entered = true;
      setEnteredUI();
      enterStatus.textContent = 'You’re entered! Good luck.';
    } catch (e) {
      console.warn('[poster] entry failed:', e);
      enterStatus.textContent = 'Could not enter - check your connection and try again.';
    } finally {
      updateEnterEnabled();
    }
  });

  // ---- PNG export ---------------------------------------------------------

  function safeFilename(s) {
    return (s || 'student').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  }

  saveBtn.addEventListener('click', async () => {
    if (!window.html2canvas) {
      statusEl.textContent = 'Export library failed to load - try reloading the page.';
      return;
    }
    saveBtn.disabled = true;
    statusEl.textContent = 'Building your poster…';
    try {
      // Wait for fonts + images to settle before capture.
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      await Promise.all(Array.from(posterEl.querySelectorAll('img')).map(img =>
        img.complete ? Promise.resolve()
                     : new Promise(res => { img.onload = img.onerror = res; })
      ));

      // Capture at the poster's NATIVE 1000px width, not the on-screen scaled
      // size. html2canvas measures via getBoundingClientRect (which the
      // ancestor transform shrinks), so we force the width and neutralise the
      // scale transform inside the cloned document (no on-screen flash).
      const canvas = await window.html2canvas(posterEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#faf4e6',
        logging: false,
        width: POSTER_W,
        height: posterEl.offsetHeight,
        windowWidth: POSTER_W,
        onclone: (doc) => {
          const sc = doc.getElementById('poster-scaler');
          if (sc) { sc.style.transform = 'none'; sc.style.setProperty('--poster-scale', '1'); }
        }
      });
      const link = document.createElement('a');
      link.download = safeFilename(nameInput.value) + '-worldcup-heat-poster.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
      statusEl.textContent = 'Saved! Check your downloads.';
    } catch (e) {
      console.warn('[poster] export failed:', e);
      statusEl.textContent = 'Could not save automatically - long-press the poster to save the image instead.';
    } finally {
      saveBtn.disabled = false;
    }
  });
})();
