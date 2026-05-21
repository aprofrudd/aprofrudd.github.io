// Projector-side controller. Renders the active stage (question text + media)
// on the left, live results on the right, and provides Next/Prev/Reset.

(async function () {
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
      // Show option text on the projector too — students see their list mirrored
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

    // Join box only for stages where students vote
    if (stage.type === 'map' || stage.type === 'mcq') {
      renderJoinBox(stagePane);
    }
  }

  function renderProjectorMap(parent, stage) {
    const mapWrap = el('div', 'map-wrap');
    const img = el('img', 'basemap');
    img.src = 'map.svg';
    img.alt = '';
    mapWrap.appendChild(img);

    const pinsLayer = el('div', 'pins');
    mapWrap.appendChild(pinsLayer);

    // Compute vote counts for this stage by city
    const counts = countsForStage(stage.id);
    const max = Math.max(0, ...Object.values(counts));

    window.CITIES.forEach(city => {
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
        <div style="font-size:1.2rem;margin-bottom:0.4rem;">Manim animation goes here</div>
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

    if (stage.quote) {
      const q = el('blockquote');
      q.innerHTML = `“${stage.quote}”`;
      if (stage.citation) q.innerHTML += `<cite>— ${stage.citation}</cite>`;
      wrap.appendChild(q);
    }
    parent.appendChild(wrap);
  }

  function renderJoinBox(parent) {
    const url = window.location.origin + window.location.pathname.replace('results.html', '');
    const box = el('div', 'join-box');
    box.innerHTML = `
      <div class="qr"></div>
      <div class="join-text">
        <strong>Vote on your phone</strong>
        Scan or go to <code>${url}</code>
      </div>`;
    parent.appendChild(box);
    drawQr(box.querySelector('.qr'), url);
  }

  function drawQr(slot, text) {
    // 1) Static qr.png if shipped alongside the site (preferred for prod)
    // 2) qrcode CDN if reachable
    // 3) Big URL fallback — students type it
    const img = document.createElement('img');
    img.src = 'qr.png';
    img.alt = 'QR code to join the lesson';
    img.onload = () => slot.appendChild(img);
    img.onerror = () => {
      if (window.QRCode && window.QRCode.toCanvas) {
        const canvas = document.createElement('canvas');
        slot.appendChild(canvas);
        window.QRCode.toCanvas(canvas, text, {
          width: 180, margin: 1,
          color: { dark: '#3a261e', light: '#ffffff' }
        });
      } else {
        slot.classList.add('qr-fallback');
        slot.innerHTML = `<div class="qr-fallback-inner">QR<br><small>type URL →</small></div>`;
      }
    };
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
      options = window.CITIES.map(c => ({ id: c.id, label: c.name }));
    } else {
      options = stage.options;
    }

    // Sort by count desc, but keep zero-count options in their natural order at the bottom
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
    const ok = confirm('Reset all votes? This wipes every recorded vote across every stage.');
    if (!ok) return;
    store.clearVotes();
    // Also clear voted flags so the projector's own browser can vote again if testing
    Object.keys(localStorage).filter(k => k.startsWith('wcw_voted_')).forEach(k => localStorage.removeItem(k));
  });

  // Keyboard: right/left arrows advance the lesson
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && !nextBtn.disabled) nextBtn.click();
    if (e.key === 'ArrowLeft'  && !prevBtn.disabled) prevBtn.click();
  });

  store.onStage(({stage}) => { currentStage = stage; rerender(); });
  store.onVotes((votes)   => { allVotes = votes; rerender(); });
})();
