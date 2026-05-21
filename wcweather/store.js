// Storage abstraction. Same API whether we're talking to Firebase Firestore
// or the localStorage fallback (used while FIREBASE_CONFIG is the placeholder
// or for offline content design).
//
// Public surface (returned by createStore()):
//   onStage(cb)        - subscribe to stage index changes; cb({stage}) fires now + on change
//   setStage(n)        - set current stage (projector only)
//   onVotes(cb)        - subscribe to all votes; cb(votes[]) fires now + on change
//   addVote(stage,id)  - record a vote
//   clearVotes()       - wipe all votes (reset)
//
// Vote shape: { stage: string, choice: string, ts: number }

function createLocalStore() {
  const STATE_KEY = 'wcw_state_stage';
  const VOTES_KEY = 'wcw_votes';
  const stageSubs = [];
  const voteSubs  = [];

  function readState() {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return {stage: 0, epoch: 0};
    const s = JSON.parse(raw);
    return {stage: s.stage ?? 0, epoch: s.epoch ?? 0};
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
  function emitState() { const s = readState(); stageSubs.forEach(cb => cb(s)); }
  function emitVotes() { const v = readVotes(); voteSubs.forEach(cb => cb(v)); }

  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY) emitState();
    if (e.key === VOTES_KEY) emitVotes();
  });

  return {
    isLive: false,
    onStage(cb) { stageSubs.push(cb); cb(readState()); },
    setStage(n) {
      const cur = readState();
      writeState({stage: n, epoch: cur.epoch});
      emitState();
    },
    onVotes(cb) { voteSubs.push(cb); cb(readVotes()); },
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
      writeState({stage: cur.stage, epoch: (cur.epoch || 0) + 1});
      emitState();
      emitVotes();
    }
  };
}

async function createFirebaseStore() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore, doc, collection, onSnapshot, setDoc, addDoc, getDoc, getDocs, deleteDoc, serverTimestamp }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app = initializeApp(window.FIREBASE_CONFIG);
  const db  = getFirestore(app);
  const stateRef = doc(db, 'wcweather', 'state');
  const votesCol = collection(db, 'wcweather_votes');

  return {
    isLive: true,
    onStage(cb) {
      onSnapshot(stateRef, (snap) => {
        const data = snap.exists() ? snap.data() : {stage: 0, epoch: 0};
        cb({stage: data.stage ?? 0, epoch: data.epoch ?? 0});
      });
    },
    async setStage(n) {
      await setDoc(stateRef, { stage: n, ts: serverTimestamp() }, { merge: true });
    },
    onVotes(cb) {
      onSnapshot(votesCol, (snap) => {
        const votes = [];
        snap.forEach((d) => votes.push(d.data()));
        cb(votes);
      });
    },
    async addVote(stage, choice) {
      const ref = await addDoc(votesCol, { stage, choice, ts: serverTimestamp() });
      return ref.id;
    },
    async removeVote(voteId) {
      try { await deleteDoc(doc(db, 'wcweather_votes', voteId)); }
      catch (e) { console.warn('[wcweather] removeVote failed:', e); }
    },
    async clearVotes() {
      // Bump the epoch first so phones unlock as soon as they see the change
      const cur = (await getDoc(stateRef));
      const epoch = (cur.exists() && typeof cur.data().epoch === 'number') ? cur.data().epoch + 1 : 1;
      await setDoc(stateRef, { epoch, ts: serverTimestamp() }, { merge: true });
      // Then delete the votes
      const snap = await getDocs(votesCol);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
  };
}

async function createStore() {
  if (window.IS_LIVE) {
    try { return await createFirebaseStore(); }
    catch (e) {
      console.warn('[wcweather] Firebase init failed, falling back to localStorage:', e);
      return createLocalStore();
    }
  }
  return createLocalStore();
}

window.createStore = createStore;
