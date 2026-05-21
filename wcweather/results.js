// Projector-side controller. Renders the active stage (question + media) on
// the left, live results on the right, and provides Next/Prev/Reset.
// Lesson-agnostic — uses window.LESSON_ID for any localStorage namespacing.

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

  const store = await window.createStore();
  if (!store.isLive) {
    dev.hidden = false;
    dev.textContent = 'Local-dev mode (no Firebase) — votes only sync between tabs on this device.';
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

    const h = el('h2');
    h.textContent = stage.title;
    stagePane.appendChild(h);

    if (stage.blurb) {
      const p = el('p', 'blurb');
      p.innerHTML = stage.blurb;
      stagePane.appendChild(p);
    }

    if (stage.type === 'map') {
      renderProjectorMap(stagePane, stage);
    } else if (stage.type === 'mcq') {
      const list = el('div', 'mcq-list');
      stage.options.forEach(opt => {
        const row = el('div', 'mcq-option disabled');
        row.textContent = opt.label;
        list.appendChild(row);
      });
      stagePane.appendChild(list);
    } else if (stage.type === 'media') {
      renderMedia(stagePane, stage);
    } else if (stage.type === 'content') {
      renderContent(stagePane, stage);
    }
    // QR + URL live in the persistent top-right corner of the projector page.
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
    const fig = el('div', 'figure-wrap');
    wrap.appendChild(fig);

    if (stage.figure) {
      fetch(stage.figure, { method: 'HEAD' })
        .then(r => {
          if (r.ok) {
            const img = el('img');
            img.src = stage.figure;
            img.alt = '';
            fig.appendChild(img);
          } else throw new Error('missing');
        })
        .catch(() => {
          const ph = el('div', 'figure-placeholder');
          ph.textContent = `Drop a figure at ${stage.figure}`;
          fig.appendChild(ph);
        });
    }

    if (stage.quote) {
      const q = el('blockquote');
      q.innerHTML = `“${stage.quote}”`;
      if (stage.citation) q.innerHTML += `<cite>— ${stage.citation}</cite>`;
      wrap.appendChild(q);
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

    if (stage.type === 'media' || stage.type === 'content') {
      const note = el('div', 'results-empty');
      note.textContent = 'No vote on this stage — discussion / viewing.';
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
    prevBtn.disabled = currentStage <= 0;
    nextBtn.disabled = currentStage >= stagesTotal() - 1;
    stageIndic.textContent = `${currentStage + 1} / ${stagesTotal()}`;
  }

  function rerender() {
    renderStagePane();
    renderResultsPane();
    renderControls();
  }

  prevBtn.addEventListener('click', () => {
    if (currentStage > 0) store.setStage(currentStage - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (currentStage < stagesTotal() - 1) store.setStage(currentStage + 1);
  });
  resetBtn.addEventListener('click', () => {
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

  store.onStage(({stage}) => { currentStage = stage; rerender(); });
  store.onVotes((votes)   => { allVotes = votes; rerender(); });
})();
