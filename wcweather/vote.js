// Phone-side controller. Subscribes to the current stage, renders the right
// UI for it, and writes the vote. One vote per stage per device — enforced
// via localStorage. After voting, the student sees "Got it" with a
// "Change my vote" button. When the teacher advances the stage on the
// projector, every connected phone re-renders.
//
// Lesson-agnostic engine code — uses window.LESSON_ID (set by
// lesson.config.js) so multiple lessons can coexist on the same origin
// without clobbering each other's localStorage.

(async function () {
  const LESSON_ID = window.LESSON_ID || 'lesson';
  const root  = document.getElementById('stage-root');
  const dev   = document.getElementById('dev-banner');
  const store = await window.createStore();

  if (!store.isLive) {
    dev.hidden = false;
    dev.textContent = 'Local-dev mode (no Firebase) — votes stored on this device only.';
  }

  let currentStageIndex = -1;
  let currentEpoch = null;
  const EPOCH_KEY  = LESSON_ID + '_epoch';
  const VOTED_PREFIX = LESSON_ID + '_voted_';

  function votedKey(stageId) { return VOTED_PREFIX + stageId; }
  function hasVoted(stageId) { return localStorage.getItem(votedKey(stageId)) !== null; }

  function readVoted(stageId) {
    const raw = localStorage.getItem(votedKey(stageId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'choice' in parsed) return parsed;
    } catch (_) { /* fall through */ }
    return { choice: raw, voteId: null };
  }
  function markVoted(stageId, choice, voteId) {
    localStorage.setItem(votedKey(stageId), JSON.stringify({ choice, voteId: voteId || null }));
  }
  function clearVoted(stageId) { localStorage.removeItem(votedKey(stageId)); }

  function clearVotedFlags() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(VOTED_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  function syncEpoch(epoch) {
    if (epoch == null) return;
    const seen = localStorage.getItem(EPOCH_KEY);
    const hasVotedFlags = Object.keys(localStorage).some(k => k.startsWith(VOTED_PREFIX));
    if (seen === null) {
      // First load with epoch-aware code. If this device has voted flags from
      // an earlier session (pre-epoch code, or before a reset we missed),
      // treat them as stale and clear them so the student can vote afresh.
      if (hasVotedFlags) clearVotedFlags();
      localStorage.setItem(EPOCH_KEY, String(epoch));
      return;
    }
    if (Number(seen) !== Number(epoch)) {
      // Teacher reset — unlock this phone for the new session.
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
    const v = readVoted(stage.id);
    const choiceLabel = v ? labelForChoice(stage, v.choice) : '';
    wrap.innerHTML = `
      <h2>Got it.</h2>
      <span class="arrow">↑</span>
      <p>Look at the screen — your vote is in.</p>
      ${choiceLabel ? `<p style="font-size:0.95rem;margin-top:0.5rem;color:#6b4a3e;">You picked <strong>${choiceLabel}</strong>.</p>` : ''}
      <button type="button" class="change-vote">Change my vote</button>
      <p style="font-size:0.85rem;margin-top:1.5rem;color:#9a7d6f;">
        The next question will appear automatically.
      </p>`;
    wrap.querySelector('.change-vote').addEventListener('click', async () => {
      const cur = readVoted(stage.id);
      if (cur && cur.voteId) {
        try { await store.removeVote(cur.voteId); } catch (e) { /* ignore */ }
      }
      clearVoted(stage.id);
      render(currentStageIndex);
    });
    root.appendChild(wrap);
  }

  function labelForChoice(stage, choiceId) {
    if (stage.type === 'map') {
      const c = (window.CITIES || []).find(c => c.id === choiceId);
      return c ? c.name : choiceId;
    }
    if (stage.type === 'mcq') {
      const o = stage.options.find(o => o.id === choiceId);
      return o ? o.label : choiceId;
    }
    return choiceId;
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
      <p style="color:#6b4a3e;font-size:0.9rem;margin:0;">${stage.blurb || ''}</p>
    `;
    root.appendChild(head);

    async function castVote(choiceId) {
      if (hasVoted(stage.id)) return;
      markVoted(stage.id, choiceId, null);
      renderThanks(stage);
      try {
        const voteId = await store.addVote(stage.id, choiceId);
        markVoted(stage.id, choiceId, voteId);
      } catch (e) { console.warn('[' + LESSON_ID + '] vote failed:', e); }
    }

    const cities = window.CITIES || [];
    const mapWrap = el('div', 'map-wrap');
    const img = el('img', 'basemap');
    img.src = (stage.map || 'map.svg');
    img.alt = 'Map';
    mapWrap.appendChild(img);

    const pinsLayer = el('div', 'pins');
    mapWrap.appendChild(pinsLayer);

    cities.forEach(city => {
      const btn = el('button', 'pin');
      btn.style.left = city.x + '%';
      btn.style.top  = city.y + '%';
      btn.setAttribute('aria-label', city.name);
      btn.dataset.city = city.id;
      btn.dataset.dir  = city.labelDir || 's';
      btn.innerHTML = `<span class="dot"></span><span class="label">${city.name}</span>`;
      btn.addEventListener('click', () => castVote(city.id));
      pinsLayer.appendChild(btn);
    });

    root.appendChild(mapWrap);

    const note = el('div', 'tap-hint');
    note.textContent = stage.tapHint || 'Tap the marker you want to pick.';
    root.appendChild(note);

    // Tap-friendly fallback list — labels overlap badly when 16+ pins are
    // squeezed into a phone-width map, so we hide labels on small screens
    // and route voting through a grouped list of buttons below the map.
    if (cities.length) {
      const list = el('div', 'city-list');
      list.setAttribute('aria-label', 'Pick from a list');

      // Group by `country` when present (mirrors the wcweather worked example)
      // or just render one ungrouped list otherwise.
      const groups = new Map();
      cities.forEach(c => {
        const key = c.country || '__all__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
      });

      const COUNTRY_NAMES = { US: 'USA', CA: 'Canada', MX: 'Mexico' };
      groups.forEach((items, key) => {
        const group = el('div', 'city-list-group');
        if (key !== '__all__') {
          const heading = el('div', 'city-list-heading');
          heading.textContent = COUNTRY_NAMES[key] || key;
          group.appendChild(heading);
        }
        const row = el('div', 'city-list-row');
        items.forEach(city => {
          const b = el('button', 'city-list-btn');
          b.dataset.city = city.id;
          b.textContent = city.name;
          b.addEventListener('click', () => castVote(city.id));
          row.appendChild(b);
        });
        group.appendChild(row);
        list.appendChild(group);
      });

      root.appendChild(list);
    }
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
      b.addEventListener('click', async () => {
        if (hasVoted(stage.id)) return;
        markVoted(stage.id, opt.id, null);
        renderThanks(stage);
        try {
          const voteId = await store.addVote(stage.id, opt.id);
          markVoted(stage.id, opt.id, voteId);
        } catch (e) { console.warn('[' + LESSON_ID + '] vote failed:', e); }
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
        const qIdx = stages
          .slice(0, stageIndex + 1)
          .filter(s => s.type === 'mcq' || s.type === 'map').length;
        renderMcq(stage, qIdx);
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
