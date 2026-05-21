// Firebase project configuration.
//
// Replace the placeholder values below with the web-app config snippet from
// your Firebase project (Project settings → General → Your apps → Web).
// These keys are *public* — security comes from Firestore rules, not from
// hiding the keys.
//
// While FIREBASE_CONFIG.apiKey is left as the placeholder string the site
// runs in LOCAL-DEV MODE: votes and stage state live in localStorage only
// (no Firebase, no live sync between devices). Useful for content design
// and for one-laptop demos.

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDYbL0GirWc_zy7XjcKlahbpP89QLVG0m8',
  authDomain:        'worldcupweather.firebaseapp.com',
  projectId:         'worldcupweather',
  storageBucket:     'worldcupweather.firebasestorage.app',
  messagingSenderId: '255510158770',
  appId:             '1:255510158770:web:9ebc10cfe64f6ae3f818ab',
  measurementId:     'G-BQ6G32YXHM'
};

const IS_LIVE = FIREBASE_CONFIG.apiKey !== 'REPLACE_ME';

window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.IS_LIVE = IS_LIVE;
