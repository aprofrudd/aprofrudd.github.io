// Projector-side controller. Renders the active stage (question + media) on
// the left, live results on the right, and provides Next/Prev/Reset.
// Lesson-agnostic - uses window.LESSON_ID for any localStorage namespacing.

(async function () {
  const LESSON_ID = window.LESSON_ID || 'lesson';
  const VOTED_PREFIX = LESSON_ID + '_voted_';

  const stagePane    = document.getElementById('stage-pane');
  const resultsPane  = document.getElementById('results-pane');
  const stageIndic   = document.getElementById('stage-indicator');
  const prevBtn      = document.getElementById('prev-btn');
  const nextBtn      = document.getElementById('next-btn');
  const resetBtn     = document.getElementById('reset-btn');
  const dev          = document.getElementById('dev-banner');
  const authBtn      = document.getElementById('auth-btn');
  const authWho      = document.getElementById('auth-who');

  // Only a signed-in teacher may drive the lesson. Students who open this page
  // can watch the live results but the controls do nothing for them - enforced
  // by Firestore rules (state writes require the teacher's account), with the
  // UI lock below as the visible half.
  let isTeacher = false;

  const store = await window.createStore();
  if (!store.isLive) {
    dev.hidden = false;
    dev.textContent = 'Local-dev mode (no Firebase) - votes only sync between tabs on this device.';
  }

  let currentStage = 0;
  let allVotes = [];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function stagesTotal() { return window.STAGES.length; }

  function renderStagePane() {
    stagePane.innerHTML = '';
    const stage = window.STAGES[currentStage];
    if (!stage) return;

    const kicker = el('div');
    kicker.style.cssText = 'font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:#6b4a3e;';
    kicker.textContent = `Stage ${currentStage + 1} of ${stagesTotal()}`;
    stagePane.appendChild(kicker);

    // An imported deck slide carries its own title inside the image, so
    // repeating it above just eats projector space. The title is still used in
    // the builder's slide list and on the students' phones.
    if (stage.type !== 'slide' && !stage.slideImage) {
      const h = el('h2');
      h.textContent = stage.title;
      stagePane.appendChild(h);
    }

    if (stage.blurb) {
      const p = el('p', 'blurb');
      p.innerHTML = stage.blurb;
      stagePane.appendChild(p);
    }

    if (stage.type === 'map') {
      renderProjectorMap(stagePane, stage);
    } else if (stage.type === 'mcq' && stage.slideImage) {
      // A poll imported from a deck: the teacher's slide already shows the
      // question and the answer choices exactly as they designed them, so show
      // that and nothing else. The live bars go in the results pane; the phones
      // still render the tappable option list from stage.options.
      renderDeckSlide(stagePane, { image: stage.slideImage, title: stage.title });
    } else if (stage.type === 'mcq') {
      // Optional figure shown above the option list - useful when the
      // question requires students to read a chart to answer.
      if (stage.figure) {
        const figWrap = el('div', 'mcq-figure-wrap');
        const img = el('img');
        img.src = stage.figure;
        img.alt = stage.figureCaption || '';
        figWrap.appendChild(img);
        if (stage.figureCaption) {
          const cap = el('div', 'mcq-figure-caption');
          cap.textContent = stage.figureCaption;
          figWrap.appendChild(cap);
        }
        stagePane.appendChild(figWrap);
      }
      const list = el('div', 'mcq-list');
      stage.options.forEach(opt => {
        const row = el('div', 'mcq-option disabled');
        if (opt.sublabel) {
          const main = el('span', 'mcq-option-label');
          main.textContent = opt.label;
          const sub  = el('span', 'mcq-option-sublabel');
          sub.textContent = opt.sublabel;
          row.appendChild(main);
          row.appendChild(sub);
        } else {
          row.textContent = opt.label;
        }
        list.appendChild(row);
      });
      stagePane.appendChild(list);
    } else if (stage.type === 'media') {
      renderMedia(stagePane, stage);
    } else if (stage.type === 'content') {
      renderContent(stagePane, stage);
    } else if (stage.type === 'poster') {
      renderPosterInstructions(stagePane, stage);
    } else if (stage.type === 'slide') {
      renderDeckSlide(stagePane, stage);
    }
    // QR + URL live in the persistent top-right corner of the projector page.
  }

  // A slide imported from a PowerPoint/Keynote deck: one rasterised page shown
  // as large as the projector allows. No vote attaches to it - it is the
  // teacher's own slide, displayed inside the lesson flow.
  function renderDeckSlide(parent, stage) {
    const wrap = el('div', 'deck-slide');
    const img = el('img');
    img.src = stage.image;
    img.alt = stage.title || '';
    wrap.appendChild(img);
    parent.appendChild(wrap);
  }

  function renderProjectorMap(parent, stage) {
    const cities = window.CITIES || [];
    const mapWrap = el('div', 'map-wrap');
    const img = el('img', 'basemap');
    img.src = (stage.map || 'map.svg');
    img.alt = '';
    mapWrap.appendChild(img);

    const pinsLayer = el('div', 'pins');
    mapWrap.appendChild(pinsLayer);

    const counts = countsForStage(stage.id);
    const max = Math.max(0, ...Object.values(counts));

    cities.forEach(city => {
      const pin = el('div', 'pin disabled');
      pin.style.left = city.x + '%';
      pin.style.top  = city.y + '%';
      pin.dataset.dir = city.labelDir || 's';
      const c = counts[city.id] || 0;
      if (c > 0) pin.classList.add('has-votes');
      if (c > 0 && c === max) pin.classList.add('leader');
      pin.innerHTML = `
        <span class="dot"></span>
        <span class="label">${city.name}</span>
        <span class="count">${c}</span>
      `;
      pinsLayer.appendChild(pin);
    });

    parent.appendChild(mapWrap);
  }

  function renderPosterInstructions(parent, stage) {
    // Derive the lesson folder from the current path by stripping whatever file
    // we're on (results.html, results, index.html...) so the links are always
    // <folder>/poster.html and <folder>/lesson.html - never "resultsposter.html".
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const posterUrl = base + (stage.href || 'poster.html');
    const lessonUrl = base + (stage.recapHref || 'lesson.html');
    const wrap = el('div', 'poster-instructions');
    wrap.innerHTML = `
      <div class="poster-emoji">🎓</div>
      <p class="poster-lead">On your phone, tap <strong>“Create my poster”</strong> - or open the link below.</p>
      <div class="poster-url">${posterUrl}</div>
      <p class="poster-sub">Your poster is built from the answers you gave today. Add your name and school, then save it as an image for the CASES Outreach competition.</p>
      <p class="poster-home">Want to finish at home? Everything from today's lesson is here:<br><span class="poster-url poster-url--home">${lessonUrl}</span></p>`;
    parent.appendChild(wrap);
  }

  function renderMedia(parent, stage) {
    const wrap = el('div', 'media-stage');
    parent.appendChild(wrap);

    function makePlaceholder() {
      const ph = el('div', 'video-placeholder');
      ph.innerHTML = `
        <div style="font-size:1.2rem;margin-bottom:0.4rem;">Video goes here</div>
        <div>Drop your file at <code>${stage.video}</code></div>`;
      return ph;
    }

    fetch(stage.video, { method: 'HEAD' })
      .then(r => {
        if (!r.ok) return makePlaceholder();
        const video = el('video');
        video.controls = true;
        video.preload  = 'metadata';
        if (stage.poster) video.poster = stage.poster;
        const source = el('source');
        source.src  = stage.video;
        source.type = 'video/mp4';
        video.appendChild(source);
        return video;
      })
      .catch(() => makePlaceholder())
      .then(node => wrap.appendChild(node));
  }

  function renderContent(parent, stage) {
    const wrap = el('div', 'content-stage');

    // 1) Figure (optional - image of a chart, paper figure, etc.)
    if (stage.figure) {
      const fig = el('div', 'figure-wrap');
      wrap.appendChild(fig);
      fetch(stage.figure, { method: 'HEAD' })
        .then(r => {
          if (r.ok) {
            const img = el('img');
            img.src = stage.figure;
            img.alt = stage.figureCaption || '';
            fig.appendChild(img);
            if (stage.figureCaption) {
              const cap = el('div', 'figure-caption');
              cap.textContent = stage.figureCaption;
              fig.appendChild(cap);
            }
          } else throw new Error('missing');
        })
        .catch(() => {
          const ph = el('div', 'figure-placeholder');
          ph.textContent = `Drop a figure at ${stage.figure}`;
          fig.appendChild(ph);
        });
    }

    // 2) Table (optional - clean HTML table for displaying paper data
    //    responsively. Use instead of a figure when you want themed,
    //    accessible output rather than a screenshot.)
    if (stage.table) {
      const tWrap = el('div', 'content-table-wrap');
      const tbl = el('table', 'content-table');
      if (stage.table.headers) {
        const thead = el('thead');
        const tr = el('tr');
        stage.table.headers.forEach(h => {
          const th = el('th');
          th.textContent = h;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        tbl.appendChild(thead);
      }
      const tbody = el('tbody');
      const highlightTop = Number.isInteger(stage.table.highlightTop)
        ? stage.table.highlightTop : 0;
      (stage.table.rows || []).forEach((row, i) => {
        const tr = el('tr');
        if (i < highlightTop) tr.classList.add('highlight');
        row.forEach((cell, ci) => {
          const td = el('td');
          td.textContent = cell;
          if (ci === 0) td.classList.add('rowlabel');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      tWrap.appendChild(tbl);
      wrap.appendChild(tWrap);
    }

    // 3) Quote + citation (optional). Citation becomes a clickable
    //    paper link when `stage.link` is set.
    if (stage.quote) {
      const q = el('blockquote');
      q.innerHTML = `“${stage.quote}”`;
      if (stage.citation) {
        const cite = el('cite');
        if (stage.link) {
          const safe = String(stage.link).replace(/"/g, '&quot;');
          cite.innerHTML = `- <a href="${safe}" target="_blank" rel="noopener">${stage.citation} ↗</a>`;
        } else {
          cite.textContent = `- ${stage.citation}`;
        }
        q.appendChild(cite);
      }
      wrap.appendChild(q);
    } else if (stage.link) {
      // Surface the paper link even when there's no pull quote.
      const linkP = el('p', 'paper-link');
      const safe = String(stage.link).replace(/"/g, '&quot;');
      const label = stage.citation || 'Read the paper';
      linkP.innerHTML = `<a href="${safe}" target="_blank" rel="noopener">${label} ↗</a>`;
      wrap.appendChild(linkP);
    }

    parent.appendChild(wrap);
  }

  function countsForStage(stageId) {
    const out = {};
    allVotes.forEach(v => {
      if (v.stage !== stageId) return;
      out[v.choice] = (out[v.choice] || 0) + 1;
    });
    return out;
  }

  function renderResultsPane() {
    const stage = window.STAGES[currentStage];
    resultsPane.innerHTML = '';

    const h = el('h3');
    h.textContent = 'Live results';
    resultsPane.appendChild(h);

    if (!stage) return;

    // Content stages can optionally show a reference figure in the side
    // pane (e.g. a paper figure that complements the main table or quote).
    if (stage.type === 'content' && stage.sideFigure) {
      h.textContent = stage.sideFigureCaption ? '' : 'Reference';
      if (!h.textContent) h.remove();
      const sideWrap = el('div', 'side-figure');
      const img = el('img');
      img.src = stage.sideFigure;
      img.alt = stage.sideFigureCaption || '';
      sideWrap.appendChild(img);
      if (stage.sideFigureCaption) {
        const cap = el('div', 'side-figure-caption');
        cap.textContent = stage.sideFigureCaption;
        sideWrap.appendChild(cap);
      }
      resultsPane.appendChild(sideWrap);
      return;
    }

    if (stage.type === 'poster') {
      const note = el('div', 'results-empty');
      note.textContent = 'Everyone is building their own poster.';
      resultsPane.appendChild(note);
      return;
    }

    if (stage.type === 'media' || stage.type === 'content' || stage.type === 'slide') {
      const note = el('div', 'results-empty');
      note.textContent = 'No vote on this stage - discussion / viewing.';
      resultsPane.appendChild(note);
      return;
    }

    const counts = countsForStage(stage.id);
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    const max   = Math.max(0, ...Object.values(counts));

    let options;
    if (stage.type === 'map') {
      const cities = window.CITIES || [];
      options = cities.map(c => ({ id: c.id, label: c.name }));
    } else {
      options = stage.options;
    }

    options.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));

    if (total === 0) {
      const note = el('div', 'results-empty');
      note.textContent = 'Waiting for first vote…';
      resultsPane.appendChild(note);
    }

    const list = el('div', 'results-list');
    options.forEach(opt => {
      const n = counts[opt.id] || 0;
      const pct = total ? (n / max) * 100 : 0;
      const row = el('div', 'results-row');
      if (n > 0 && n === max) row.classList.add('leader');
      row.innerHTML = `
        <div class="name">${opt.label}</div>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="count">${n}</div>`;
      list.appendChild(row);
    });
    resultsPane.appendChild(list);
  }

  function renderControls() {
    const locked = store.isLive && !isTeacher;
    prevBtn.disabled = locked || currentStage <= 0;
    nextBtn.disabled = locked || currentStage >= stagesTotal() - 1;
    resetBtn.disabled = locked;
    stageIndic.textContent = `${currentStage + 1} / ${stagesTotal()}`;
  }

  function rerender() {
    // Deck slides get the full projector width (the results column is empty on
    // them anyway); CSS keys off this class.
    const cur = window.STAGES[currentStage];
    // Display-only deck slides get the whole width; a slide-backed poll keeps
    // the results column, so it is not included here.
    document.body.classList.toggle('stage-slide', !!cur && cur.type === 'slide');
    renderStagePane();
    renderResultsPane();
    renderControls();
  }

  // Surface a failed stage write (rules / auth / network) instead of failing
  // silently. The projector only advances on the onStage echo, so on failure it
  // correctly does NOT move - and now it says why.
  function flashError(msg) {
    if (!dev) return;
    const wasHidden = dev.hidden;
    const prev = dev.textContent;
    dev.hidden = false;
    dev.textContent = msg;
    setTimeout(() => {
      if (dev.textContent === msg) { dev.textContent = prev; dev.hidden = wasHidden; }
    }, 5000);
  }
  async function go(n) {
    try { await store.setStage(n); }
    catch (e) {
      console.warn('[' + LESSON_ID + '] setStage failed:', e);
      flashError('Could not change slide - check your sign-in and connection. (' + (e.code || e.message) + ')');
    }
  }
  prevBtn.addEventListener('click', () => {
    if (currentStage > 0) go(currentStage - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (currentStage < stagesTotal() - 1) go(currentStage + 1);
  });
  resetBtn.addEventListener('click', () => {
    if (resetBtn.disabled) return;
    const ok = confirm('Reset all votes? This wipes every recorded vote across every stage and unlocks every phone.');
    if (!ok) return;
    store.clearVotes();
    // Also clear voted flags on the projector's own browser so testing isn't
    // blocked by stale localStorage.
    Object.keys(localStorage)
      .filter(k => k.startsWith(VOTED_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  });

  // Keyboard: arrows advance the lesson.
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && !nextBtn.disabled) nextBtn.click();
    if (e.key === 'ArrowLeft'  && !prevBtn.disabled) prevBtn.click();
  });

  // --- Teacher sign-in gate ------------------------------------------------
  // In live mode the controls are locked until the teacher signs in with
  // Google. The Firestore SDK attaches the signed-in user's token to writes,
  // and the security rules only accept stage writes from the teacher's email -
  // so a student opening this page can watch but cannot drive the lesson.
  async function setupAuth() {
    if (!store.isLive) {
      // Local-dev: no backend auth; controls work for testing.
      isTeacher = true;
      if (authBtn) authBtn.hidden = true;
      if (authWho) authWho.hidden = true;
      renderControls();
      return;
    }
    try {
      const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } =
        await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const auth = getAuth();   // default app - store.js already initialised it
      if (authBtn) authBtn.addEventListener('click', () => {
        if (auth.currentUser) signOut(auth);
        else signInWithPopup(auth, new GoogleAuthProvider())
               .catch(e => { if (authWho) authWho.textContent = 'Sign-in failed: ' + e.code; });
      });
      onAuthStateChanged(auth, (user) => {
        isTeacher = !!user;
        if (authBtn) authBtn.textContent = user ? 'Sign out' : 'Sign in to control';
        // Don't show the email on the projector (it's in front of the class);
        // just confirm the signed-in state.
        if (authWho) authWho.textContent = user
          ? 'Signed in'
          : 'View-only - sign in to control the lesson';
        renderControls();
      });
    } catch (e) {
      console.warn('[' + LESSON_ID + '] auth setup failed:', e);
    }
  }
  setupAuth();

  // Generate the "join on your phone" QR at runtime from this page's folder URL
  // (which serves index.html), so each presentation needs no committed qr.png.
  // The qrcode lib is loaded by results.html; retry briefly in case it is slow.
  // The QR lib is the vendored qrcode-generator (engine/vendor/qrcode.js),
  // which defines a global `qrcode` function. It used to come from a CDN path
  // that turned out not to exist - the corner failed silently on every
  // published presentation - hence vendored, like every other third-party lib.
  function renderJoinQR(tries) {
    tries = tries || 0;
    const corner = document.querySelector('.qr-corner');
    if (!corner) return;
    if (typeof window.qrcode !== 'function') {
      if (tries < 50) { setTimeout(() => renderJoinQR(tries + 1), 50); return; }
      // Library never arrived: make the URL the join mechanism instead of
      // leaving a silently empty corner.
      const label = corner.querySelector('.qr-corner-label span');
      if (label) label.style.cssText = 'font-size:1.05rem;font-weight:700;';
      return;
    }
    try {
      const joinUrl = window.location.origin +
        window.location.pathname.replace(/[^/]*$/, '');
      const qr = window.qrcode(0, 'M');   // 0 = auto-size to the data
      qr.addData(joinUrl);
      qr.make();
      let img = corner.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = 'QR code to join';
        img.style.cssText = 'width:100%;height:auto;image-rendering:pixelated;border-radius:4px;';
        (corner.querySelector('#qr-code') || corner).appendChild(img);
      }
      img.src = qr.createDataURL(8, 8);
    } catch (e) {
      console.warn('[' + LESSON_ID + '] QR render failed:', e);
    }
  }
  renderJoinQR();

  store.onStage(({stage}) => { currentStage = stage; rerender(); });
  store.onVotes((votes)   => { allVotes = votes; rerender(); });

  // If the projector sleeps or drops its connection, pull the current stage AND
  // the live tally back when it wakes so neither can get stuck behind reality.
  function resync() {
    if (store.refreshStage) store.refreshStage();
    if (store.refreshVotes) store.refreshVotes();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resync(); });
  window.addEventListener('focus', resync);
  window.addEventListener('online', resync);

  // Foreground safety-net poll (visibility-gated) + tap resync, so a projector
  // whose realtime channel silently stalls cannot sit behind the live state or
  // freeze the results bars. Each stream is refreshed only when its own listener
  // has been quiet for the interval, so a healthy stream costs no extra reads.
  const STALL_POLL_MS = 15000;
  let pollTimer = null;
  function pollTick() {
    if (store.refreshStage && (!store.msSinceSnapshot || store.msSinceSnapshot() >= STALL_POLL_MS)) store.refreshStage();
    if (store.refreshVotes && (!store.msSinceVotes || store.msSinceVotes() >= STALL_POLL_MS)) store.refreshVotes();
  }
  function updatePoll() {
    if (document.hidden) { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
    else if (!pollTimer) { pollTimer = setInterval(pollTick, STALL_POLL_MS); }
  }
  document.addEventListener('visibilitychange', updatePoll);
  updatePoll();

  let lastTap = 0;
  window.addEventListener('pointerdown', () => {
    const now = Date.now();
    if (now - lastTap < 4000) return;
    lastTap = now;
    resync();
  }, { passive: true });
})();
