// Storage abstraction for the classroom-poll-site engine.
// Same public API whether we're talking to Firebase Firestore or the
// localStorage fallback (used during local-dev / before Firebase is set up).
//
// Reads window.LESSON_ID (set by lesson.config.js) so multiple lessons can
// share a single Firebase project without their votes colliding.
//
// Public surface returned by createStore():
//   onStage(cb)                - subscribe to {stage, epoch, stageReset} changes
//   setStage(n)                - set current stage index (projector only)
//   onVotes(cb)                - subscribe to all votes; cb(votes[])
//   addVote(stage, choice)     - record a vote; returns the new vote's id
//   removeVote(voteId)         - delete a single vote (used by "Change my vote")
//   clearVotes()               - wipe all votes and bump epoch (teacher reset)
//   clearVotesForStage(stageId)- wipe one stage's votes and stamp stageReset,
//                                so phones unlock just that question
//   probeControl()             - harmless state-doc write; resolves true if this
//                                account is allowed to drive the lesson
//
// In live mode a failed Firebase init no longer falls back to localStorage -
// that silently forked students into device-only voting that never reached the
// projector. createStore() instead resolves {failed: true} and the pages show
// a plain reconnect screen.
//
// Vote shape: { id, stage: string, choice: string, ts }
// State doc shape: { stage: int, epoch: int, stageReset: {stage, nonce}, ts }

const LESSON_ID = window.LESSON_ID || 'lesson';
const STATE_KEY = LESSON_ID + '_state_stage';
const VOTES_KEY = LESSON_ID + '_votes';

function createLocalStore() {
  const stageSubs = [];
  const voteSubs  = [];

  function readState() {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return {stage: 0, epoch: 0, stageReset: null};
    const s = JSON.parse(raw);
    return {stage: s.stage ?? 0, epoch: s.epoch ?? 0, stageReset: s.stageReset || null};
  }
  function writeState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify({...state, ts: Date.now()}));
  }
  function readVotes() {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function writeVotes(v) {
    localStorage.setItem(VOTES_KEY, JSON.stringify(v));
  }
  let lastSnapshotAt = 0;
  let lastVotesAt = 0;
  function emitState() { lastSnapshotAt = Date.now(); const s = readState(); stageSubs.forEach(cb => cb(s)); }
  function emitVotes() { lastVotesAt = Date.now(); const v = readVotes(); voteSubs.forEach(cb => cb(v)); }

  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY) emitState();
    if (e.key === VOTES_KEY) emitVotes();
  });

  return {
    isLive: false,
    onStage(cb) { stageSubs.push(cb); lastSnapshotAt = Date.now(); cb(readState()); },
    setStage(n) {
      const cur = readState();
      writeState({stage: n, epoch: cur.epoch, stageReset: cur.stageReset});
      emitState();
    },
    probeControl() { return Promise.resolve(true); },
    refreshStage() { emitState(); },
    msSinceSnapshot() { return Date.now() - lastSnapshotAt; },
    onVotes(cb) { voteSubs.push(cb); lastVotesAt = Date.now(); cb(readVotes()); },
    refreshVotes() { emitVotes(); },
    msSinceVotes() { return Date.now() - lastVotesAt; },
    addVote(stage, choice) {
      const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const v = readVotes();
      v.push({id, stage, choice, ts: Date.now()});
      writeVotes(v);
      emitVotes();
      return id;
    },
    removeVote(voteId) {
      const v = readVotes().filter(x => x.id !== voteId);
      writeVotes(v);
      emitVotes();
    },
    clearVotes() {
      writeVotes([]);
      const cur = readState();
      writeState({stage: cur.stage, epoch: (cur.epoch || 0) + 1, stageReset: cur.stageReset});
      emitState();
      emitVotes();
    },
    clearVotesForStage(stageId) {
      writeVotes(readVotes().filter(v => v.stage !== stageId));
      const cur = readState();
      writeState({stage: cur.stage, epoch: cur.epoch,
                  stageReset: {stage: stageId, nonce: Date.now()}});
      emitState();
      emitVotes();
      return Promise.resolve();
    },
    // Competition entries. In local-dev these stay on the device (no teacher
    // collection) — the button still works for testing.
    submitPoster(payload, id) {
      const KEY = LESSON_ID + '_posters';
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) {}
      if (id) {
        // One entry per device: overwrite this device's existing entry.
        const rec = { ...payload, __id: id, ts: Date.now() };
        const i = arr.findIndex(p => p.__id === id);
        if (i >= 0) arr[i] = rec; else arr.push(rec);
      } else {
        arr.push({ ...payload, ts: Date.now() });
      }
      localStorage.setItem(KEY, JSON.stringify(arr));
      return id || ('local_' + Date.now());
    }
  };
}

async function createFirebaseStore() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore, doc, collection, onSnapshot, setDoc, addDoc, getDoc, getDocs, deleteDoc, serverTimestamp }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app = initializeApp(window.FIREBASE_CONFIG);
  const db  = getFirestore(app);
  // Lesson-scoped Firestore paths: each lesson lives in its own state doc
  // and votes collection so multiple lessons can share one project safely.
  const stateRef = doc(db, LESSON_ID, 'state');
  const votesCol = collection(db, LESSON_ID + '_votes');

  // Stage subscription with auto-resubscribe + a manual refresh hook. Phones
  // that lock, background, or drop WiFi suspend the realtime listener and would
  // otherwise freeze on an old stage; refreshStage() (called on wake/reconnect
  // by vote.js/results.js) pulls the current stage so they snap back into sync.
  const stageSubs = [];
  let stageUnsub = null;
  let lastSnapshotAt = 0;   // when the listener last delivered fresh state
  function emitStage(data) {
    lastSnapshotAt = Date.now();
    const d = data || { stage: 0, epoch: 0 };
    const payload = { stage: d.stage ?? 0, epoch: d.epoch ?? 0, stageReset: d.stageReset || null };
    stageSubs.forEach(cb => cb(payload));
  }
  function subscribeStage() {
    if (stageUnsub) { try { stageUnsub(); } catch (_) {} }
    // includeMetadataChanges lets us re-emit when the SDK reconnects (the
    // fromCache -> server flip), so a phone that briefly dropped offline gets
    // the current stage back. Skip the projector's own optimistic write echo
    // (hasPendingWrites) - the confirmed server value arrives right after.
    stageUnsub = onSnapshot(stateRef, { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata && snap.metadata.hasPendingWrites) return;
        emitStage(snap.exists() ? snap.data() : null);
      },
      (err) => {
        console.warn('[' + LESSON_ID + '] state listener error, resubscribing:', err && (err.code || err.message));
        setTimeout(subscribeStage, 2000);
      });
  }

  // The live-results (votes) stream gets the same treatment as the stage stream:
  // auto-resubscribe on error + a refreshVotes() hook, so the projector's
  // results bars can't silently freeze if the listener stalls.
  const voteSubs = [];
  let votesUnsub = null;
  let lastVotesAt = 0;
  function pushVotes(snap) {
    lastVotesAt = Date.now();
    const votes = [];
    snap.forEach((d) => votes.push(d.data()));
    voteSubs.forEach(cb => cb(votes));
  }
  function subscribeVotes() {
    if (votesUnsub) { try { votesUnsub(); } catch (_) {} }
    votesUnsub = onSnapshot(votesCol,
      (snap) => pushVotes(snap),
      (err) => {
        console.warn('[' + LESSON_ID + '] votes listener error, resubscribing:', err && (err.code || err.message));
        setTimeout(subscribeVotes, 2000);
      });
  }

  return {
    isLive: true,
    onStage(cb) { stageSubs.push(cb); if (!stageUnsub) subscribeStage(); },
    async refreshStage() {
      try {
        const snap = await getDoc(stateRef);
        emitStage(snap.exists() ? snap.data() : null);
      } catch (e) { /* offline - the listener resumes and delivers when back */ }
    },
    msSinceSnapshot() { return Date.now() - lastSnapshotAt; },
    async setStage(n) {
      await setDoc(stateRef, { stage: n, ts: serverTimestamp() }, { merge: true });
    },
    onVotes(cb) { voteSubs.push(cb); if (!votesUnsub) subscribeVotes(); },
    async refreshVotes() {
      try { const snap = await getDocs(votesCol); pushVotes(snap); }
      catch (e) { /* offline - the listener resumes and delivers when back */ }
    },
    msSinceVotes() { return Date.now() - lastVotesAt; },
    async addVote(stage, choice) {
      const ref = await addDoc(votesCol, { stage, choice, ts: serverTimestamp() });
      return ref.id;
    },
    async removeVote(voteId) {
      // Rethrow: "Change my vote" needs the failure, or it clears the local
      // lock while the old vote is still counted - a silent double vote.
      try { await deleteDoc(doc(db, LESSON_ID + '_votes', voteId)); }
      catch (e) { console.warn('[' + LESSON_ID + '] removeVote failed:', e); throw e; }
    },
    async clearVotes() {
      // Bump epoch first so phones unlock as soon as they see the change.
      const cur = (await getDoc(stateRef));
      const epoch = (cur.exists() && typeof cur.data().epoch === 'number') ? cur.data().epoch + 1 : 1;
      await setDoc(stateRef, { epoch, ts: serverTimestamp() }, { merge: true });
      // Then delete the votes.
      const snap = await getDocs(votesCol);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    },
    // Re-run ONE question without destroying the rest of the lesson's results.
    // Stamping stageReset on the state doc is what unlocks the phones for just
    // that stage (vote.js watches the nonce), so stamp first, delete second -
    // mirroring clearVotes' epoch-first ordering.
    async clearVotesForStage(stageId) {
      await setDoc(stateRef, { stageReset: { stage: stageId, nonce: Date.now() },
                               ts: serverTimestamp() }, { merge: true });
      const snap = await getDocs(votesCol);
      await Promise.all(snap.docs
        .filter(d => d.data().stage === stageId)
        .map(d => deleteDoc(d.ref)));
    },
    // A harmless merge write to the state doc. The Firestore rules only allow
    // the teacher's account to write state, so success here means "this
    // account can drive the lesson" - which lets the projector tell a wrong
    // Google account apart from the right one WITHOUT shipping the teacher's
    // email to every student's browser.
    async probeControl() {
      try {
        await setDoc(stateRef, { probe: serverTimestamp() }, { merge: true });
        return true;
      } catch (e) {
        return false;
      }
    },
    // Competition entries per lesson. Students can create/update their own entry;
    // only the teacher (by email, in the rules) can read or delete them.
    async submitPoster(payload, id) {
      // A stable per-device id makes "Enter" an upsert: one entry per student,
      // editable, instead of a fresh doc on every tap. Needs `allow update` in
      // the Firestore rules. Without an id, fall back to a new doc.
      if (id) {
        await setDoc(doc(db, LESSON_ID + '_posters', id), { ...payload, ts: serverTimestamp() });
        return id;
      }
      const ref = await addDoc(collection(db, LESSON_ID + '_posters'), { ...payload, ts: serverTimestamp() });
      return ref.id;
    }
  };
}

async function createStore() {
  if (window.IS_LIVE) {
    try { return await createFirebaseStore(); }
    catch (e) {
      // Do NOT fall back to localStorage here. A student whose SDK import
      // failed (congested lecture WiFi) would get a fully working-looking
      // vote page whose votes never reach the projector. Fail loudly instead;
      // vote.js/results.js render a plain reconnect screen.
      console.warn('[' + LESSON_ID + '] Firebase init failed:', e);
      return { failed: true, error: e };
    }
  }
  return createLocalStore();
}

window.createStore = createStore;
