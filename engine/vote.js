// Phone-side controller. Subscribes to the current stage, renders the right
// UI for it, and writes the vote. One vote per stage per device - enforced
// via localStorage. After voting, the student sees "Got it" with a
// "Change my vote" button. When the teacher advances the stage on the
// projector, every connected phone re-renders.
//
// Voting is ack-gated: the phone only says "your vote is in" AFTER Firestore
// confirms the write. A slow write shows an honest "still sending" state (the
// SDK keeps it queued, so it lands when the connection returns); a rejected
// write re-opens the question with a plain-English retry message. The old
// behaviour - mark voted locally, then fire-and-forget - could lock 200 phones
// on a false success screen while the projector stayed at zero.
//
// Lesson-agnostic engine code - uses window.LESSON_ID (set by
// lesson.config.js) so multiple lessons can coexist on the same origin
// without clobbering each other's localStorage.

(async function () {
  const LESSON_ID = window.LESSON_ID || 'lesson';
  const root  = document.getElementById('stage-root');
  const dev   = document.getElementById('dev-banner');
  const store = await window.createStore();

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls)  e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // Screen-reader live region: announces question changes, vote confirmations
  // and errors, since the page rebuilds its DOM silently otherwise.
  const live = el('div', 'sr-only');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  document.body.appendChild(live);
  function announce(text) {
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 40);
  }

  // Live mode with a dead Firebase init: say so and offer reload, instead of
  // silently collecting votes into localStorage that never reach the screen.
  if (store.failed) {
    root.innerHTML = '';
    const wrap = el('div', 'thanks connect-error');
    wrap.innerHTML = `
      <h2>Couldn't connect.</h2>
      <p>Check your WiFi or mobile signal, then reload this page.</p>
      <button type="button" class="mcq-submit" style="margin-top:1rem;">Reload</button>`;
    wrap.querySelector('button').addEventListener('click', () => location.reload());
    root.appendChild(wrap);
    announce("Couldn't connect. Check your WiFi and reload this page.");
    return;
  }

  if (!store.isLive) {
    dev.hidden = false;
    dev.textContent = 'Practice mode - votes stay on this device and only sync between tabs here.';
  }

  let currentStageIndex = -1;
  let currentEpoch = null;
  const EPOCH_KEY  = LESSON_ID + '_epoch';
  const SRESET_KEY = LESSON_ID + '_sreset_nonce';
  const VOTED_PREFIX = LESSON_ID + '_voted_';

  function votedKey(stageId) { return VOTED_PREFIX + stageId; }
  function hasVoted(stageId) { return localStorage.getItem(votedKey(stageId)) !== null; }
  function currentStage() { return (window.STAGES || [])[currentStageIndex] || null; }

  // Voted state on the device.
  // Always normalised to {choices: [], voteIds: [], pending} (arrays). Single-
  // select stages have one entry; multi-select up to maxSelect. `pending` means
  // the server has not acked yet (weak connection) - the writes are queued in
  // the SDK and the ids get patched in when they land.
  function readVoted(stageId) {
    const raw = localStorage.getItem(votedKey(stageId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.choices)) return parsed;
      if (parsed && 'choice' in parsed) {
        return { choices: [parsed.choice], voteIds: [parsed.voteId || null] };
      }
    } catch (_) { /* fall through */ }
    return { choices: [raw], voteIds: [null] };
  }
  function markVoted(stageId, choices, voteIds, pending) {
    localStorage.setItem(votedKey(stageId), JSON.stringify({
      choices: Array.isArray(choices) ? choices : [choices],
      voteIds: Array.isArray(voteIds) ? voteIds : [voteIds || null],
      pending: !!pending
    }));
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
      // Teacher reset - unlock this phone for the new session.
      clearVotedFlags();
      localStorage.setItem(EPOCH_KEY, String(epoch));
    }
  }

  // Teacher re-ran a single question (stageReset on the state doc): unlock just
  // that stage on this phone, leaving every other answer intact.
  function syncStageReset(stageReset) {
    if (!stageReset || stageReset.nonce == null) return false;
    const seen = localStorage.getItem(SRESET_KEY);
    if (String(seen) === String(stageReset.nonce)) return false;
    localStorage.setItem(SRESET_KEY, String(stageReset.nonce));
    if (seen === null) return false;   // first sight of the field - nothing to undo
    clearVoted(stageReset.stage);
    const cur = currentStage();
    return !!(cur && cur.id === stageReset.stage);
  }

  // ---- casting votes (ack-gated) -------------------------------------------

  const ACK_WAIT_MS = 4000;

  function showSending() {
    root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const note = el('div', 'vote-sending');
    note.textContent = 'Sending your vote…';
    root.appendChild(note);
    announce('Sending your vote.');
  }

  function showVoteError() {
    const note = el('div', 'vote-error');
    note.textContent = "Your vote didn't send - check your WiFi and tap your answer again.";
    root.prepend(note);
  }

  async function castVotes(stage, choices) {
    if (hasVoted(stage.id)) return;
    showSending();
    const writes = choices.map(c => store.addVote(stage.id, c));
    const all = Promise.all(writes);
    const outcome = await Promise.race([
      all.then(ids => ({ ok: true, ids })).catch(e => ({ ok: false, e })),
      new Promise(res => setTimeout(() => res({ slow: true }), ACK_WAIT_MS))
    ]);

    if (outcome.ok) {
      markVoted(stage.id, choices, outcome.ids, false);
      renderThanks(stage);
      announce('Got it - your vote is in.');
      return;
    }

    if (outcome.slow) {
      // Not failed - queued. The SDK delivers it when the connection returns,
      // so lock the stage but say honestly that it is still on its way.
      markVoted(stage.id, choices, choices.map(() => null), true);
      renderThanks(stage);
      announce('Still sending your vote - keep this page open.');
      all.then(ids => {
        markVoted(stage.id, choices, ids, false);
        const cur = currentStage();
        if (cur && cur.id === stage.id && hasVoted(stage.id)) renderThanks(stage);
        announce('Your vote is in.');
      }).catch(e => {
        console.warn('[' + LESSON_ID + '] queued vote rejected:', e);
        clearVoted(stage.id);
        const cur = currentStage();
        if (cur && cur.id === stage.id) { render(currentStageIndex); showVoteError(); }
        announce("Your vote didn't send - tap your answer to try again.");
      });
      return;
    }

    // Rejected outright (rules, quota, bad request): reopen the question.
    console.warn('[' + LESSON_ID + '] vote rejected:', outcome.e);
    render(currentStageIndex);
    showVoteError();
    announce("Your vote didn't send - tap your answer to try again.");
  }

  // ---- screens -------------------------------------------------------------

  function renderThanks(stage) {
    root.innerHTML = '';
    const wrap = el('div', 'thanks');
    const v = readVoted(stage.id);
    const choices = (v && v.choices) || [];
    const pending = !!(v && v.pending);
    const labels = choices.map(c => labelForChoice(stage, c)).filter(Boolean);

    let picksHtml = '';
    if (labels.length === 1) {
      picksHtml = `<p class="thanks-picks">You picked <strong>${labels[0]}</strong>.</p>`;
    } else if (labels.length > 1) {
      const items = labels.map(l => `<li>${l}</li>`).join('');
      picksHtml = `
        <div class="thanks-picks">
          <div>You picked:</div>
          <ul>${items}</ul>
        </div>`;
    }

    wrap.innerHTML = pending ? `
      <h2>Sending…</h2>
      <span class="arrow">↑</span>
      <p>Weak connection - your vote goes through as soon as it's back. Keep this page open.</p>
      ${picksHtml}
      <button type="button" class="change-vote" disabled>Change my vote</button>
      <p class="thanks-note">You can change your vote once it has sent.</p>` : `
      <h2>Got it.</h2>
      <span class="arrow">↑</span>
      <p>Look at the screen - your vote is in.</p>
      ${picksHtml}
      <button type="button" class="change-vote">Change my vote</button>
      <p class="thanks-note">The next question will appear automatically.</p>`;

    const changeBtn = wrap.querySelector('.change-vote');
    changeBtn.addEventListener('click', async () => {
      const cur = readVoted(stage.id);
      const ids = (cur && cur.voteIds) || [];
      changeBtn.disabled = true;
      changeBtn.textContent = 'Removing…';
      try {
        // Delete every vote this device cast for this stage in parallel.
        // Ids are always present here - the button is disabled while pending.
        await Promise.all(ids.filter(Boolean).map(id => store.removeVote(id)));
        clearVoted(stage.id);
        render(currentStageIndex);
        announce('Vote removed - pick again.');
      } catch (e) {
        console.warn('[' + LESSON_ID + '] removeVote failed:', e);
        changeBtn.disabled = false;
        changeBtn.textContent = 'Change my vote';
        const note = el('p', 'vote-error');
        note.textContent = "Couldn't remove your vote - check your connection and try again.";
        wrap.appendChild(note);
      }
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

  // Question header, shared by map + mcq. Focus lands on the heading so a
  // screen reader announces the new question the moment the stage changes.
  function questionHead(qNumber, stage) {
    const head = el('div', 'q-head');
    head.innerHTML = `
      <div class="q-kicker">Question ${qNumber}</div>
      <h2 class="q-title" tabindex="-1">${stage.title}</h2>
      ${stage.blurb ? `<p class="q-blurb">${stage.blurb}</p>` : ''}`;
    return head;
  }
  function focusQuestion(head, qNumber, stage, choiceCount) {
    const h = head.querySelector('.q-title');
    if (h) { try { h.focus({ preventScroll: true }); } catch (_) {} }
    announce(`Question ${qNumber}: ${stage.title}. ${choiceCount} choices.`);
  }

  function renderMap(stage, qNumber) {
    root.innerHTML = '';
    const head = questionHead(qNumber, stage);
    root.appendChild(head);

    const cities = window.CITIES || [];
    let selectedId = null;

    const mapWrap = el('div', 'map-wrap');
    const img = el('img', 'basemap');
    img.src = (stage.map || 'map.svg');
    img.alt = 'Map';
    mapWrap.appendChild(img);

    const pinsLayer = el('div', 'pins');
    mapWrap.appendChild(pinsLayer);

    // Confirm bar: a 34px dot is too easy to fat-finger for the tap to be the
    // vote itself, so the first tap selects and this button casts.
    const confirmBar = el('div', 'map-confirm');
    confirmBar.hidden = true;
    const confirmBtn = el('button', 'mcq-submit');
    confirmBtn.type = 'button';
    confirmBar.appendChild(confirmBtn);
    confirmBtn.addEventListener('click', () => {
      if (selectedId) castVotes(stage, [selectedId]);
    });

    function select(cityId) {
      selectedId = cityId;
      const city = cities.find(c => c.id === cityId);
      root.querySelectorAll('.pin, .city-list-btn').forEach(n => {
        n.classList.toggle('selected', n.dataset.city === cityId);
        if (n.classList.contains('city-list-btn')) {
          n.setAttribute('aria-pressed', String(n.dataset.city === cityId));
        }
      });
      confirmBar.hidden = false;
      confirmBtn.textContent = 'Confirm: ' + (city ? city.name : cityId);
      announce((city ? city.name : cityId) + ' selected. Tap confirm to cast your vote.');
    }

    cities.forEach(city => {
      const btn = el('button', 'pin');
      btn.type = 'button';
      btn.style.left = city.x + '%';
      btn.style.top  = city.y + '%';
      btn.setAttribute('aria-label', city.name);
      btn.dataset.city = city.id;
      btn.dataset.dir  = city.labelDir || 's';
      btn.innerHTML = `<span class="dot"></span><span class="label">${city.name}</span>`;
      btn.addEventListener('click', () => select(city.id));
      pinsLayer.appendChild(btn);
    });

    root.appendChild(mapWrap);

    const note = el('div', 'tap-hint');
    note.textContent = stage.tapHint || 'Tap a marker to pick it, then confirm.';
    root.appendChild(note);
    root.appendChild(confirmBar);

    // Tap-friendly fallback list - labels overlap badly when 16+ pins are
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
          b.type = 'button';
          b.dataset.city = city.id;
          b.textContent = city.name;
          b.setAttribute('aria-pressed', 'false');
          b.addEventListener('click', () => select(city.id));
          row.appendChild(b);
        });
        group.appendChild(row);
        list.appendChild(group);
      });

      root.appendChild(list);
    }

    focusQuestion(head, qNumber, stage, cities.length);
  }

  function renderMcq(stage, qNumber) {
    root.innerHTML = '';
    const head = questionHead(qNumber, stage);
    root.appendChild(head);

    // A question that hangs off a chart (or an imported slide) has to show it
    // on the phone too - the projector may be hard to read from the back row.
    const figSrc = stage.figure || stage.slideImage;
    if (figSrc) {
      const fig = el('div', 'phone-figure');
      const img = el('img');
      img.src = figSrc;
      img.alt = stage.figureCaption || 'Figure for this question';
      fig.appendChild(img);
      if (stage.figureCaption) {
        const cap = el('div', 'phone-figure-caption');
        cap.textContent = stage.figureCaption;
        fig.appendChild(cap);
      }
      root.appendChild(fig);
    }

    const maxSelect = Math.max(1, Number(stage.maxSelect || 1));
    const isMulti   = maxSelect > 1;

    const list = el('div', 'mcq-list');
    const selected = new Set();  // selected opt.ids while the student is choosing

    // Helper to render label + optional sublabel inside an option button.
    function fillOption(b, opt) {
      if (opt.sublabel) {
        const main = el('span', 'mcq-option-label');
        main.textContent = opt.label;
        const sub  = el('span', 'mcq-option-sublabel');
        sub.textContent = opt.sublabel;
        b.appendChild(main);
        b.appendChild(sub);
      } else {
        b.textContent = opt.label;
      }
    }

    if (isMulti) {
      // Multi-select flow: tap to toggle, submit when ready.
      const counter = el('div', 'mcq-counter');
      const limitNote = el('div', 'mcq-limit-note');
      limitNote.hidden = true;
      const submit  = el('button', 'mcq-submit');
      submit.type = 'button';
      submit.disabled = true;

      function refresh() {
        counter.textContent = `${selected.size} of ${maxSelect} selected`;
        submit.textContent = selected.size > 0
          ? `Submit ${selected.size} pick${selected.size > 1 ? 's' : ''}`
          : 'Submit';
        submit.disabled = selected.size < 1;
      }

      stage.options.forEach(opt => {
        const b = el('button', 'mcq-option');
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        fillOption(b, opt);
        b.addEventListener('click', () => {
          if (selected.has(opt.id)) {
            selected.delete(opt.id);
            b.classList.remove('selected');
            b.setAttribute('aria-pressed', 'false');
          } else {
            if (selected.size >= maxSelect) {
              // Visible + audible rejection, not just a shake.
              b.classList.add('limit-flash');
              setTimeout(() => b.classList.remove('limit-flash'), 400);
              limitNote.hidden = false;
              limitNote.textContent = `You can pick up to ${maxSelect} - unselect one first.`;
              setTimeout(() => { limitNote.hidden = true; }, 2500);
              announce(`You can pick up to ${maxSelect}. Unselect one first.`);
              return;
            }
            selected.add(opt.id);
            b.classList.add('selected');
            b.setAttribute('aria-pressed', 'true');
          }
          refresh();
        });
        list.appendChild(b);
      });

      refresh();
      root.appendChild(list);
      const footer = el('div', 'mcq-footer');
      footer.appendChild(counter);
      footer.appendChild(limitNote);
      footer.appendChild(submit);
      root.appendChild(footer);

      submit.addEventListener('click', () => {
        if (hasVoted(stage.id) || selected.size < 1) return;
        castVotes(stage, Array.from(selected));
      });
      focusQuestion(head, qNumber, stage, stage.options.length);
      return;
    }

    // Single-select fast path.
    stage.options.forEach(opt => {
      const b = el('button', 'mcq-option');
      b.type = 'button';
      fillOption(b, opt);
      b.addEventListener('click', () => castVotes(stage, [opt.id]));
      list.appendChild(b);
    });
    root.appendChild(list);
    focusQuestion(head, qNumber, stage, stage.options.length);
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

    const qIdx = stages
      .slice(0, stageIndex + 1)
      .filter(s => s.type === 'mcq' || s.type === 'map').length;

    switch (stage.type) {
      case 'map': renderMap(stage, qIdx); break;
      case 'mcq': renderMcq(stage, qIdx); break;
      case 'media':   renderWait(stage.title); break;
      case 'content': renderWait(stage.title); break;
      case 'slide':   renderWait(stage.title); break;
      case 'poster':  renderPosterCta(stage); break;
    }
  }

  function renderPosterCta(stage) {
    root.innerHTML = '';
    const wrap = el('div', 'thanks');
    wrap.innerHTML = `
      <h2>${stage.title || 'Build your poster'}</h2>
      <span class="arrow" style="font-size:2.2rem;">🎓</span>
      <p>${stage.blurb || 'Turn your answers into a poster you can keep.'}</p>
      <a class="poster-cta" href="${stage.href || 'poster.html'}">Create my poster →</a>
      <p class="thanks-note">It opens on this phone using the answers you gave today.</p>`;
    root.appendChild(wrap);
  }

  // The builder preview drives this hook to update content without a full
  // iframe reload (which flashed a half-booted page on every keystroke).
  window.__previewRefresh = (stages) => {
    if (stages) window.STAGES = stages;
    render(currentStageIndex);
  };

  store.onStage(({stage, epoch, stageReset}) => {
    const epochChanged = currentEpoch !== null && currentEpoch !== epoch;
    syncEpoch(epoch);
    currentEpoch = epoch ?? currentEpoch;
    const stageUnlocked = syncStageReset(stageReset);
    if (stage !== currentStageIndex || epochChanged || stageUnlocked) {
      currentStageIndex = stage;
      render(stage);
    }
  });

  // A phone that locks, backgrounds, or drops WiFi suspends its realtime
  // listener and can freeze on an old stage. When it comes back, pull the
  // current stage so it snaps straight into sync instead of waiting for the
  // teacher to nudge it (which is what threw the pacing off).
  function resync() { if (store.refreshStage) store.refreshStage(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resync(); });
  window.addEventListener('focus', resync);
  window.addEventListener('online', resync);
  window.addEventListener('pageshow', resync);

  // The wake events above only fire when the phone comes back. But a phone the
  // student is actively WATCHING can have its realtime channel silently stall
  // with no event at all - so it would sit on an old slide forever. Two safety
  // nets for that case:
  //  1) a visibility-gated poll (only while the page is visible, so a
  //     backgrounded phone costs zero reads); it skips the read whenever a live
  //     snapshot arrived within the interval, so a healthy phone is nearly free.
  //  2) a throttled tap handler, so a student glancing at a stuck phone and
  //     touching it snaps forward at once.
  const STALL_POLL_MS = 15000;
  let pollTimer = null;
  function pollTick() {
    if (store.msSinceSnapshot && store.msSinceSnapshot() < STALL_POLL_MS) return;
    resync();
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
