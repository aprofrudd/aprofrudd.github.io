// Draft media storage, backed by IndexedDB.
//
// Specs are small and stay in localStorage. Media does not: importing a 40-slide
// deck produces ~40 slide images as data URLs, which is tens of megabytes and
// blows localStorage's ~5MB quota instantly (silently, on some browsers). So the
// mediaBlobs map for each draft lives here instead.
//
// One record per draft, keyed by slug, value = { 'media/x.jpg': dataURL, ... }.
// Whole-map writes are fine because media only changes on import or an image
// pick - never on a keystroke - so callers save it behind a dirty flag rather
// than on the normal debounced draft save.

const DB_NAME = 'builder_media';
const DB_VERSION = 1;
const STORE = 'drafts';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.onerror = () => reject(t.error || new Error('media transaction failed'));
    t.oncomplete = () => resolve(req ? req.result : undefined);
  }));
}

// Failures used to be swallowed with a console.warn - which meant an imported
// deck's images could silently vanish. The app registers a handler and tells
// the user instead.
let onError = null;
export function setMediaErrorHandler(fn) { onError = fn; }

export function loadMedia(slug) {
  if (!slug) return Promise.resolve({});
  return tx('readonly', s => s.get(slug))
    .then(v => v || {})
    .catch(e => { console.warn('media load failed', e); if (onError) onError('load', e); return {}; });
}

export function saveMedia(slug, blobs) {
  if (!slug) return Promise.resolve();
  return tx('readwrite', s => s.put(blobs || {}, slug))
    .catch(e => { console.warn('media save failed', e); if (onError) onError('save', e); });
}

export function deleteMedia(slug) {
  if (!slug) return Promise.resolve();
  return tx('readwrite', s => s.delete(slug)).catch(() => {});
}

// Rough byte size of a media map, for the "this deck is large" warning.
export function mediaBytes(blobs) {
  let n = 0;
  for (const k in blobs) n += Math.round((String(blobs[k]).length * 3) / 4);
  return n;
}
