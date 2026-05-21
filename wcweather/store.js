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
  const STAGE_KEY = 'wcw_state_stage';
  const VOTES_KEY = 'wcw_votes';
  const stageSubs = [];
  const voteSubs  = [];

  function readStage() {
    const raw = localStorage.getItem(STAGE_KEY);
    return raw ? JSON.parse(raw).stage : 0;
  }
  function readVotes() {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function writeVotes(v) {
    localStorage.setItem(VOTES_KEY, JSON.stringify(v));
  }
  function emitStage() { const s = readStage(); stageSubs.forEach(cb => cb({stage: s})); }
  function emitVotes() { const v = readVotes(); voteSubs.forEach(cb => cb(v)); }

  // Same-page subscribers fire from setStage/addVote directly;
  // cross-tab sync uses the storage event.
  window.addEventListener('storage', (e) => {
    if (e.key === STAGE_KEY) emitStage();
    if (e.key === VOTES_KEY) emitVotes();
  });

  return {
    isLive: false,
    onStage(cb) { stageSubs.push(cb); cb({stage: readStage()}); },
    setStage(n) {
      localStorage.setItem(STAGE_KEY, JSON.stringify({stage: n, ts: Date.now()}));
      emitStage();
    },
    onVotes(cb) { voteSubs.push(cb); cb(readVotes()); },
    addVote(stage, choice) {
      const v = readVotes();
      v.push({stage, choice, ts: Date.now()});
      writeVotes(v);
      emitVotes();
    },
    clearVotes() { writeVotes([]); emitVotes(); }
  };
}

async function createFirebaseStore() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore, doc, collection, onSnapshot, setDoc, addDoc, getDocs, deleteDoc, serverTimestamp }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app = initializeApp(window.FIREBASE_CONFIG);
  const db  = getFirestore(app);
  const stateRef = doc(db, 'wcweather', 'state');
  const votesCol = collection(db, 'wcweather_votes');

  return {
    isLive: true,
    onStage(cb) {
      onSnapshot(stateRef, (snap) => {
        const data = snap.exists() ? snap.data() : {stage: 0};
        cb({stage: data.stage ?? 0});
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
      await addDoc(votesCol, { stage, choice, ts: serverTimestamp() });
    },
    async clearVotes() {
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
