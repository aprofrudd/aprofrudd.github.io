// Phone-side controller. Subscribes to the current stage, renders the right
// UI for it, and writes the vote. One vote per stage per device — enforced
// via localStorage. After voting, the student sees a "look at the screen"
// message until the projector advances.

(async function () {
  const root  = document.getElementById('stage-root');
  const dev   = document.getElementById('dev-banner');
  const store = await window.createStore();

  if (!store.isLive) {
    dev.hidden = false;
    dev.textContent = 'Local-dev mode (no Firebase) — votes stored on this device only.';
  }

  let currentStageIndex = -1;
  let currentEpoch = null;
  const EPOCH_KEY = 'wcw_epoch';

  function votedKey(stageId) { return 'wcw_voted_' + stageId; }
  function hasVoted(stageId) { return localStorage.getItem(votedKey(stageId)) !== null; }
  function markVoted(stageId, choice) { localStorage.setItem(votedKey(stageId), choice); }

  function clearVotedFlags() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('wcw_voted_'))
      .forEach(k => localStorage.removeItem(k));
  }

  function syncEpoch(epoch) {
    if (epoch == null) return;
    const seen = localStorage.getItem(EPOCH_KEY);
    const hasVotedFlags = Object.keys(localStorage).some(k => k.startsWith('wcw_voted_'));
    if (seen === null) {
      // First load with epoch-aware code. If this device has voted flags
      // from an earlier session (pre-epoch code, or before a reset we
      // missed), treat them as stale and clear them.
      if (hasVotedFlags) clearVotedFlags();
      localStorage.setItem(EPOCH_KEY, String(epoch));
      return;
    }
    if (Number(seen) !== Number(epoch)) {
      // Teacher reset — unlock this phone for the new session
      clearVotedFlags();
      localStorage.setItem(EPOCH_KEY, String(epoch));
    }
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls)  e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function renderThanks(stage) {
    root.innerHTML = '';
    const wrap = el('div', 'thanks');
    wrap.innerHTML = `
      <h2>Got it.</h2>
      <span class="arrow">↑</span>
      <p>Look at the screen — your vote is in.</p>
      <p style="font-size:0.85rem;margin-top:1.5rem;color:#9a7d6f;">
        Wait here. The next question will appear automatically.
      </p>`;
    root.appendChild(wrap);
  }

  function renderWait(title) {
    root.innerHTML = '';
    const wrap = el('div', 'thanks');
    wrap.innerHTML = `
      <h2>${title}</h2>
      <p>Look at the screen.</p>`;
    root.appendChild(wrap);
  }

  function renderMap(stage) {
    root.innerHTML = '';

    const head = el('div', 'header-inline');
    head.style.padding = '0 0 1rem';
    head.innerHTML = `
      <div class="kicker" style="font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:#6b4a3e;">
        Question 1
      </div>
      <h2 style="font-family:Georgia,serif;font-size:1.25rem;margin:0.25rem 0 0.5rem;">${stage.title}</h2>
      <p style="color:#6b4a3e;font-size:0.9rem;margin:0;">${stage.blurb}</p>
    `;
    root.appendChild(head);

    const mapWrap = el('div', 'map-wrap');
    const img = el('img', 'basemap');
    img.src = 'map.svg';
    img.alt = 'North America map';
    mapWrap.appendChild(img);

    const pinsLayer = el('div', 'pins');
    mapWrap.appendChild(pinsLayer);

    window.CITIES.forEach(city => {
      const btn = el('button', 'pin');
      btn.style.left = city.x + '%';
      btn.style.top  = city.y + '%';
      btn.setAttribute('aria-label', city.name);
      btn.dataset.city = city.id;
      btn.dataset.dir  = city.labelDir || 's';
      btn.innerHTML = `<span class="dot"></span><span class="label">${city.name}</span>`;
      btn.addEventListener('click', () => {
        if (hasVoted(stage.id)) return;
        markVoted(stage.id, city.id);
        store.addVote(stage.id, city.id);
        renderThanks(stage);
      });
      pinsLayer.appendChild(btn);
    });

    root.appendChild(mapWrap);

    const note = el('div');
    note.style.cssText = 'text-align:center;color:#6b4a3e;font-size:0.85rem;margin-top:1rem;';
    note.textContent = 'Tap the city you think will host the hottest match.';
    root.appendChild(note);
  }

  function renderMcq(stage, qNumber) {
    root.innerHTML = '';

    const head = el('div');
    head.innerHTML = `
      <div style="font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:#6b4a3e;">
        Question ${qNumber}
      </div>
      <h2 style="font-family:Georgia,serif;font-size:1.3rem;margin:0.25rem 0 0.5rem;">${stage.title}</h2>
      ${stage.blurb ? `<p style="color:#6b4a3e;font-size:0.95rem;margin:0 0 0.5rem;">${stage.blurb}</p>` : ''}
    `;
    root.appendChild(head);

    const list = el('div', 'mcq-list');
    stage.options.forEach(opt => {
      const b = el('button', 'mcq-option');
      b.textContent = opt.label;
      b.addEventListener('click', () => {
        if (hasVoted(stage.id)) return;
        markVoted(stage.id, opt.id);
        store.addVote(stage.id, opt.id);
        renderThanks(stage);
      });
      list.appendChild(b);
    });
    root.appendChild(list);
  }

  function render(stageIndex) {
    const stages = window.STAGES;
    if (stageIndex < 0 || stageIndex >= stages.length) {
      root.innerHTML = '<div class="thanks"><h2>Lesson complete.</h2><p>Thanks for taking part.</p></div>';
      return;
    }
    const stage = stages[stageIndex];

    if (hasVoted(stage.id)) {
      renderThanks(stage);
      return;
    }

    switch (stage.type) {
      case 'map': renderMap(stage); break;
      case 'mcq': {
        // Count which MCQ this is for the Question N header
        const mcqIdx = stages
          .slice(0, stageIndex + 1)
          .filter(s => s.type === 'mcq' || s.type === 'map').length;
        renderMcq(stage, mcqIdx);
        break;
      }
      case 'media':   renderWait(stage.title); break;
      case 'content': renderWait(stage.title); break;
    }
  }

  store.onStage(({stage, epoch}) => {
    const epochChanged = currentEpoch !== null && currentEpoch !== epoch;
    syncEpoch(epoch);
    currentEpoch = epoch ?? currentEpoch;
    if (stage !== currentStageIndex || epochChanged) {
      currentStageIndex = stage;
      render(stage);
    }
  });
})();
