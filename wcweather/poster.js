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
// (cities.js). Nothing is read from or written to Firebase — names/schools
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
  const titleInput  = document.getElementById('f-title');
  const saveBtn     = document.getElementById('save-btn');
  const statusEl    = document.getElementById('save-status');

  const answers = buildAnswers();
  const identity = readIdentity();

  // Seed the inputs from any saved identity.
  nameInput.value   = identity.name   || '';
  schoolInput.value = identity.school || '';
  titleInput.value  = identity.title  || T.defaultTitle || '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPoster() {
    const name   = nameInput.value.trim()   || 'Your name';
    const school = schoolInput.value.trim()  || 'Your school';
    const title  = titleInput.value.trim()   || T.defaultTitle || '';

    const bylineBits = [name, school, 'CASES Outreach 2026'].filter(Boolean);

    let html = '';
    html += `<header class="p-head">
      <div class="p-kicker">FIFA World Cup 2026 · Heat &amp; Player Health</div>
      <h1 class="p-title">${esc(title)}</h1>
      <div class="p-byline">${esc(bylineBits.join('  ·  '))}</div>
    </header>`;

    html += '<div class="p-body">';
    (T.sections || []).forEach(sec => {
      html += `<section class="p-section">
        <h2 class="p-h2">${esc(sec.heading)}</h2>`;
      if (sec.figure) {
        html += `<figure class="p-figure">
          <img src="${esc(sec.figure)}" alt="" crossorigin="anonymous">
          ${sec.figureCaption ? `<figcaption>${esc(sec.figureCaption)}</figcaption>` : ''}
        </figure>`;
      }
      const bodyText = typeof sec.body === 'function' ? sec.body(answers) : (sec.body || '');
      html += `<p class="p-text">${esc(bodyText)}</p></section>`;
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

  [nameInput, schoolInput, titleInput].forEach(input => {
    input.addEventListener('input', () => { persist(); refresh(); });
  });
  window.addEventListener('resize', fitPoster);
  // Re-fit once figures load (they change the poster height).
  posterEl.addEventListener('load', fitPoster, true);

  refresh();
  // A couple of delayed re-fits to catch async image layout.
  setTimeout(fitPoster, 200);
  setTimeout(fitPoster, 800);

  // ---- PNG export ---------------------------------------------------------

  function safeFilename(s) {
    return (s || 'student').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  }

  saveBtn.addEventListener('click', async () => {
    if (!window.html2canvas) {
      statusEl.textContent = 'Export library failed to load — try reloading the page.';
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
      statusEl.textContent = 'Could not save automatically — long-press the poster to save the image instead.';
    } finally {
      saveBtn.disabled = false;
    }
  });
})();
