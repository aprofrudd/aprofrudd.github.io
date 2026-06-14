// Teacher gallery - reads the competition entries and re-renders each as a
// finished poster with a per-entry PNG download.
//
// Two modes (mirrors the rest of the engine):
//   - LIVE (window.IS_LIVE): Firebase. Teacher signs in with Google; reads are
//     allowed only for the authorised email (Firestore rules). Reads the
//     <LESSON_ID>_posters collection.
//   - LOCAL-DEV: reads entries from localStorage (<LESSON_ID>_posters) with no
//     auth - for testing the rendering.
//
// The poster markup mirrors poster.js so entries render identically. Figures,
// references, footer and kicker come from poster-template.js (window.POSTER);
// the per-section text comes from the stored entry.

(function () {
  const LESSON_ID = window.LESSON_ID || 'lesson';
  const T = window.POSTER || {};
  const comp = T.competition || {};
  const KICKER = T.kicker || 'Research Poster';
  const BYLINE_TAG = comp.bylineTag || '';
  const POSTER_W = 1000;

  const authEl   = document.getElementById('g-auth');
  const statusEl = document.getElementById('g-status');
  const gridEl   = document.getElementById('g-grid');

  // Set per data-source (Firebase / local). Given a rendered entry, removes it
  // from the backing store and resolves; null until a source is wired up.
  let removeEntry = null;
  let localEntries = [];

  function status(msg) { statusEl.textContent = msg; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- build one poster's inner HTML from a stored entry ------------------
  function posterHTML(entry) {
    const title = entry.title || T.defaultTitle || '';
    const schoolLine = entry.year ? `${entry.school}, ${entry.year}` : entry.school;
    const bylineBits = [entry.name, schoolLine, BYLINE_TAG].filter(Boolean);
    const templSections = T.sections || [];

    const logos = Array.isArray(T.logos) ? T.logos : [];
    const logosHtml = logos.length
      ? `<div class="p-logos">${logos.map(s =>
          `<img src="${esc(s)}" alt="" crossorigin="anonymous" onerror="this.style.display='none'">`).join('')}</div>`
      : '';

    let html = `<header class="p-head${logos.length ? ' p-head-logos' : ''}">
      ${logosHtml}
      <div class="p-kicker">${esc(KICKER)}</div>
      <h1 class="p-title">${esc(title)}</h1>
      <div class="p-byline">${esc(bylineBits.join('  ·  '))}</div>
    </header><div class="p-body">`;

    (entry.sections || []).forEach((sec, i) => {
      const tmpl = templSections[i] || {};
      html += `<section class="p-section${tmpl.wide ? ' p-section--wide' : ''}"><h2 class="p-h2">${esc(sec.heading)}</h2>`;
      if (tmpl.figure) {
        html += `<figure class="p-figure">
          <img src="${esc(tmpl.figure)}" alt="" crossorigin="anonymous">
          ${tmpl.figureCaption ? `<figcaption>${esc(tmpl.figureCaption)}</figcaption>` : ''}
        </figure>`;
      }
      html += `<p class="p-text">${esc(sec.text)}</p></section>`;
    });
    html += '</div>';

    if (T.references && T.references.length) {
      html += `<section class="p-refs"><h2 class="p-h2">References</h2><ol>`;
      T.references.forEach(r => { html += `<li>${esc(r)}</li>`; });
      html += `</ol></section>`;
    }
    if (T.footer) html += `<footer class="p-foot">${esc(T.footer)}</footer>`;
    return html;
  }

  function tsToText(ts) {
    // Firestore Timestamp has .toDate(); local entries store a number.
    try {
      const d = ts && ts.toDate ? ts.toDate() : (typeof ts === 'number' ? new Date(ts) : null);
      return d ? d.toLocaleString() : '';
    } catch (_) { return ''; }
  }

  function safeFilename(s) {
    return (s || 'student').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  }

  // ---- render the grid ----------------------------------------------------
  function renderGallery(entries) {
    gridEl.innerHTML = '';
    if (!entries.length) {
      status('No entries yet.');
      return;
    }
    // Newest first.
    entries.sort((a, b) => {
      const an = a.ts && a.ts.toMillis ? a.ts.toMillis() : (a.ts || 0);
      const bn = b.ts && b.ts.toMillis ? b.ts.toMillis() : (b.ts || 0);
      return bn - an;
    });

    entries.forEach((entry, i) => {
      const card = document.createElement('div');
      card.className = 'g-card';
      card.innerHTML = `
        <div class="g-card-head">
          <div class="g-card-meta">
            <strong>${esc(entry.name || '-')}</strong>
            <span>${esc([entry.school, entry.year].filter(Boolean).join(' · '))}</span>
            <span class="g-card-ts">${esc(tsToText(entry.ts))}</span>
          </div>
          <div class="g-card-actions">
            <button type="button" class="g-dl" data-i="${i}">⬇ PNG</button>
            <button type="button" class="g-del" data-i="${i}">🗑 Delete</button>
          </div>
        </div>
        <div class="g-frame" id="g-frame-${i}">
          <div class="g-scaler" id="g-scaler-${i}">
            <div class="poster" id="g-poster-${i}"></div>
          </div>
        </div>`;
      gridEl.appendChild(card);
      card.querySelector('.poster').innerHTML = posterHTML(entry);
      card.querySelector('.g-dl').addEventListener('click', () => downloadCard(i, entry));
      card.querySelector('.g-del').addEventListener('click', e => handleDelete(entry, card, e.currentTarget));
    });

    fitCards();
    setTimeout(fitCards, 300);
    setTimeout(fitCards, 1000);
    status(entries.length + ' ' + (entries.length === 1 ? 'entry' : 'entries'));
  }

  function fitCards() {
    document.querySelectorAll('.g-frame').forEach(frame => {
      const i = frame.id.replace('g-frame-', '');
      const scaler = document.getElementById('g-scaler-' + i);
      const poster = document.getElementById('g-poster-' + i);
      if (!scaler || !poster) return;
      const scale = Math.min(1, (frame.clientWidth || POSTER_W) / POSTER_W);
      scaler.style.setProperty('--poster-scale', scale);
      frame.style.height = (poster.offsetHeight * scale) + 'px';
    });
  }
  window.addEventListener('resize', fitCards);

  async function downloadCard(i, entry) {
    const node = document.getElementById('g-poster-' + i);
    if (!node || !window.html2canvas) return;
    try {
      await Promise.all(Array.from(node.querySelectorAll('img')).map(img =>
        img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })));
      const canvas = await window.html2canvas(node, {
        scale: 2, useCORS: true, backgroundColor: '#faf4e6', logging: false,
        width: POSTER_W, height: node.offsetHeight, windowWidth: POSTER_W,
        onclone: (doc) => {
          const sc = doc.getElementById('g-scaler-' + i);
          if (sc) { sc.style.transform = 'none'; sc.style.setProperty('--poster-scale', '1'); }
        }
      });
      const link = document.createElement('a');
      link.download = safeFilename(entry.name) + '-poster.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link); link.click(); link.remove();
    } catch (e) { console.warn('[gallery] download failed:', e); }
  }

  // Error strip shown ON the card itself - the top status line is off-screen
  // when the teacher is scrolled down at a card, so a failure there reads as
  // "nothing happened".
  function cardError(card) {
    let strip = card.querySelector('.g-card-err');
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'g-card-err';
      card.querySelector('.g-card-head').after(strip);
    }
    return strip;
  }

  async function handleDelete(entry, card, btn) {
    const who = entry.name ? `"${entry.name}"` : 'this entry';
    const errEl = cardError(card);
    errEl.textContent = '';
    if (!removeEntry) {
      errEl.textContent = 'Delete is not ready - reload the page and try again.';
      return;
    }
    if (!window.confirm(`Permanently delete ${who}? This cannot be undone.`)) return;
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
      // Firestore's deleteDoc only settles on server acknowledgement, so it
      // hangs forever offline - race a timeout to surface that as an error.
      await Promise.race([
        removeEntry(entry),
        new Promise((_, rej) => setTimeout(
          () => rej(new Error('timed out - check your internet connection and reload')), 10000))
      ]);
      card.remove();
      const remaining = gridEl.querySelectorAll('.g-card').length;
      status(remaining
        ? remaining + ' ' + (remaining === 1 ? 'entry' : 'entries')
        : 'No entries yet.');
    } catch (e) {
      console.warn('[gallery] delete failed:', e);
      btn.disabled = false;
      btn.textContent = '🗑 Delete';
      const msg = /permission|insufficient/i.test(e.message || '')
        ? 'Not allowed - the Firestore rules need "allow delete" for your account (see firebase-setup). (' + e.message + ')'
        : 'Could not delete - ' + e.message;
      errEl.textContent = msg;
      status('Could not delete ' + who + ' - ' + e.message);
    }
  }

  // ---- data sources -------------------------------------------------------
  function loadLocal() {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(LESSON_ID + '_posters')) || []; } catch (_) {}
    localEntries = arr;
    removeEntry = async (entry) => {
      const i = localEntries.indexOf(entry);
      if (i >= 0) {
        localEntries.splice(i, 1);
        localStorage.setItem(LESSON_ID + '_posters', JSON.stringify(localEntries));
      }
    };
    authEl.innerHTML = '<span class="g-badge">Local-dev mode - showing entries on this device</span>';
    renderGallery(arr);
  }

  async function initFirebase() {
    status('Connecting…');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const { getFirestore, collection, getDocs, doc, deleteDoc } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const app  = initializeApp(window.FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db   = getFirestore(app);
    removeEntry = async (entry) => { await deleteDoc(doc(db, LESSON_ID + '_posters', entry.__id)); };

    function showSignedOut() {
      authEl.innerHTML = '<button type="button" class="g-signin">Sign in with Google</button>';
      authEl.querySelector('.g-signin').addEventListener('click', async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); }
        catch (e) { status('Sign-in failed: ' + e.message); }
      });
      gridEl.innerHTML = '';
      status('Sign in with the Google account you authorised in the Firestore rules.');
    }
    function showSignedIn(user) {
      // Don't print the email (in case the screen is shared); just confirm.
      authEl.innerHTML = `<span class="g-user">Signed in</span>
        <button type="button" class="g-signout">Sign out</button>`;
      authEl.querySelector('.g-signout').addEventListener('click', () => signOut(auth));
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) { showSignedOut(); return; }
      showSignedIn(user);
      status('Loading entries…');
      try {
        const snap = await getDocs(collection(db, LESSON_ID + '_posters'));
        // Signed out while the read was in flight - don't repopulate the grid.
        if (auth.currentUser !== user) return;
        const entries = []; snap.forEach(d => { const data = d.data(); data.__id = d.id; entries.push(data); });
        renderGallery(entries);
      } catch (e) {
        gridEl.innerHTML = '';
        status('Could not read entries - this Google account may not be authorised in the Firestore rules. (' + e.message + ')');
      }
    });
  }

  // `?local=1` forces the localStorage view (offline preview / testing).
  const forceLocal = /[?&]local=1\b/.test(location.search);
  if (window.IS_LIVE && !forceLocal) {
    initFirebase().catch(e => status('Firebase error: ' + e.message));
  } else {
    loadLocal();
  }
})();
