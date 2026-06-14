// Shared Firebase project (public keys; security is in Firestore rules).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDYbL0GirWc_zy7XjcKlahbpP89QLVG0m8",
  authDomain: "worldcupweather.firebaseapp.com",
  projectId: "worldcupweather",
  storageBucket: "worldcupweather.firebasestorage.app",
  messagingSenderId: "255510158770",
  appId: "1:255510158770:web:9ebc10cfe64f6ae3f818ab",
  measurementId: "G-BQ6G32YXHM"
};
const IS_LIVE = FIREBASE_CONFIG.apiKey !== 'REPLACE_ME';
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.IS_LIVE = IS_LIVE;
