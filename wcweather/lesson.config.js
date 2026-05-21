// Per-lesson configuration. The engine reads window.LESSON_ID to namespace
// Firestore collections and localStorage keys, so multiple lessons can share
// one Firebase project and one origin without colliding.
//
// LESSON_ID must be lowercase, kebab-case, stable. Don't change it after the
// lesson has been used in class (existing votes are keyed by this value).

window.LESSON_ID = 'wcweather';
