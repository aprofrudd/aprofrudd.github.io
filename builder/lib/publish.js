// One-click publish to GitHub Pages via the Git Data API.
//
// A presentation is ~8 files + images. We assemble them into ONE atomic commit
// (ref -> base tree -> blobs -> tree(base_tree) -> commit -> patch ref), so a
// publish never leaves the site half-updated and never disturbs /engine/ or
// other presentations (base_tree carries them forward).

import { buildPresentationFiles } from './generate.js';

const OWNER = 'aprofrudd';
const REPO  = 'aprofrudd.github.io';
const BRANCH = 'main';
const API = 'https://api.github.com';
const TOKEN_KEY = 'builder_gh_token';

// ---- token -----------------------------------------------------------------
export function getToken()   { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(t)  { if (t) localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function gh(path, opts) {
  const token = getToken();
  return fetch(API + path, Object.assign({}, opts, {
    headers: Object.assign({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, opts && opts.headers)
  })).then(async res => {
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { const j = await res.json(); if (j.message) msg = j.message; } catch (e) {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  });
}

// ---- manifest (dashboard index) --------------------------------------------
// Read the deployed manifest (public, no auth). Missing -> empty list.
export async function fetchManifest() {
  try {
    // The ?t= matters: cache:'no-store' only skips the BROWSER cache, but
    // GitHub Pages' CDN still serves its cached copy for up to 10 minutes.
    // A fresh query string is a fresh CDN cache key, so this is always
    // current - publishing twice in quick succession used to re-read a stale
    // manifest and silently drop the earlier presentation from the list.
    const res = await fetch('../presentations.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? j : (j.presentations || []);
  } catch (e) { return []; }
}

function upsertManifest(list, entry) {
  const out = (list || []).filter(p => p.slug !== entry.slug);
  out.push(entry);
  out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return out;
}

// ---- helpers ---------------------------------------------------------------

function dataUrlToBase64(dataUrl) {
  const i = String(dataUrl).indexOf(',');
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

// The manifest AS THE REPO KNOWS IT - read through the authenticated Contents
// API, never the CDN. Publish/delete commits must build on the repo's actual
// HEAD manifest: the served copy lags a deploy behind, and upserting onto the
// stale copy silently dropped presentations published in the last few minutes.
async function fetchRepoManifest() {
  try {
    const f = await gh(`/repos/${OWNER}/${REPO}/contents/presentations.json?ref=${BRANCH}`);
    const bytes = Uint8Array.from(atob(String(f.content || '').replace(/\n/g, '')), c => c.charCodeAt(0));
    const j = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(j) ? j : (j.presentations || []);
  } catch (e) {
    if (e && e.status === 404) return [];   // no manifest yet
    // Fall back to the served copy rather than failing the whole publish.
    return fetchManifest();
  }
}

// ---- publish ---------------------------------------------------------------

// Returns { url, publishedAt }. spec = the presentation spec; mediaBlobs =
// { 'media/x.png': dataURL } uploaded images to commit alongside.
// onProgress(done, total, label) reports upload progress - a deck of images
// is a long serial upload and the button used to sit silent through it.
export async function publishPresentation(spec, mediaBlobs, onProgress) {
  if (!getToken()) throw new Error('No GitHub token set.');
  const slug = spec.slug;
  if (!slug) throw new Error('Presentation has no slug.');

  const version = Date.now().toString(36);   // cache-buster for ?v=
  const publishedAt = Date.now();            // deploy-poll marker
  const { files } = buildPresentationFiles(spec, version);
  // Stamp publishedAt into the committed presentation.json (not the editable
  // spec) so waitForDeploy() can poll the served file for this exact publish.
  files['presentation.json'] =
    JSON.stringify(Object.assign({}, spec, { publishedAt }), null, 2) + '\n';

  const totalSteps = Object.keys(files).length + Object.keys(mediaBlobs || {}).length + 1;
  let doneSteps = 0;
  const step = (label) => { doneSteps++; if (onProgress) onProgress(doneSteps, totalSteps, label); };

  // Text blobs (utf-8) for the generated files...
  const tree = [];
  for (const [rel, text] of Object.entries(files)) {
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST', body: JSON.stringify({ content: text, encoding: 'utf-8' })
    });
    tree.push({ path: `${slug}/${rel}`, mode: '100644', type: 'blob', sha: blob.sha });
    step('Uploading pages…');
  }
  // ...and base64 blobs for every uploaded image.
  for (const [rel, dataUrl] of Object.entries(mediaBlobs || {})) {
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST', body: JSON.stringify({ content: dataUrlToBase64(dataUrl), encoding: 'base64' })
    });
    tree.push({ path: `${slug}/${rel}`, mode: '100644', type: 'blob', sha: blob.sha });
    step('Uploading images…');
  }

  // Update the root manifest in the SAME commit.
  const manifest = upsertManifest(await fetchRepoManifest(), {
    slug, title: spec.title || slug, updated: Date.now(),
    hasMap: (spec.stages || []).some(s => s.type === 'map'),
    hasPoster: (spec.stages || []).some(s => s.type === 'poster')
  });
  const manBlob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST', body: JSON.stringify({ content: JSON.stringify(manifest, null, 2) + '\n', encoding: 'utf-8' })
  });
  tree.push({ path: 'presentations.json', mode: '100644', type: 'blob', sha: manBlob.sha });

  // Atomic commit, retrying once if the ref moved under us.
  async function commitOnce() {
    const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    const baseSha = ref.object.sha;
    const baseCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`);
    const newTree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
      method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree })
    });
    const commit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
      method: 'POST', body: JSON.stringify({
        message: `Publish presentation: ${slug}`, tree: newTree.sha, parents: [baseSha]
      })
    });
    await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false })
    });
  }
  try { await commitOnce(); }
  catch (e) { if (e.status === 422) await commitOnce(); else throw e; }
  step('Committing…');

  return { url: `https://alanruddock.com/${slug}/results.html`, publishedAt };
}

// Poll the served presentation.json until THIS publish is what the site
// returns. "Published" used to mean "the commit landed" - but the page 404s
// until the Pages build finishes, so the success message was a lie for a
// minute or two. The ?probe= query gives the CDN a fresh cache key each time.
export async function waitForDeploy(slug, publishedAt, onTick) {
  const deadline = Date.now() + 4 * 60 * 1000;
  let n = 0;
  while (Date.now() < deadline) {
    n++;
    if (onTick) onTick(n);
    try {
      const res = await fetch(`../${slug}/presentation.json?probe=` + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.publishedAt === publishedAt) return true;
      }
    } catch (e) { /* transient - keep polling */ }
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

// Take a presentation off the site: one atomic commit that removes every file
// under <slug>/ (tree entries with sha:null) and drops the manifest row.
export async function deletePresentation(slug) {
  if (!getToken()) throw new Error('No GitHub token set.');

  async function commitOnce() {
    const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    const baseSha = ref.object.sha;
    const baseCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`);
    const full = await gh(`/repos/${OWNER}/${REPO}/git/trees/${baseCommit.tree.sha}?recursive=1`);
    const tree = (full.tree || [])
      .filter(t => t.type === 'blob' && t.path.startsWith(slug + '/'))
      .map(t => ({ path: t.path, mode: t.mode, type: 'blob', sha: null }));
    if (!tree.length) return;   // nothing published under that slug

    const manifest = (await fetchRepoManifest()).filter(p => p.slug !== slug);
    const manBlob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST', body: JSON.stringify({ content: JSON.stringify(manifest, null, 2) + '\n', encoding: 'utf-8' })
    });
    tree.push({ path: 'presentations.json', mode: '100644', type: 'blob', sha: manBlob.sha });

    const newTree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
      method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree })
    });
    const commit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
      method: 'POST', body: JSON.stringify({
        message: `Remove presentation: ${slug}`, tree: newTree.sha, parents: [baseSha]
      })
    });
    await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false })
    });
  }
  try { await commitOnce(); }
  catch (e) { if (e.status === 422) await commitOnce(); else throw e; }
}

// Check a pasted token actually works for this repo before storing it, so a
// typo'd or under-scoped token fails HERE with a plain message instead of at
// the first publish.
export async function validateToken(token) {
  try {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}`, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (res.status === 401) return { ok: false, error: "GitHub doesn't recognise that token - check you copied the whole thing." };
    if (res.status === 403 || res.status === 404) return { ok: false, error: "That token can't see this site's repository - when creating it, grant access to " + OWNER + '/' + REPO + '.' };
    if (!res.ok) return { ok: false, error: 'GitHub replied ' + res.status + ' - try again in a minute.' };
    const repo = await res.json();
    if (!repo.permissions || !repo.permissions.push) {
      return { ok: false, error: 'That token is read-only - it needs "Contents: read and write" to publish.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not reach GitHub - check your connection.' };
  }
}

// Raw API errors ("Bad credentials", "Not Found") mean nothing to an
// academic mid-publish. Translate the common ones.
export function friendlyPublishError(e) {
  const msg = String((e && e.message) || e);
  const status = e && e.status;
  if (status === 401 || /bad credentials/i.test(msg)) {
    return 'GitHub rejected the publishing token - it may have expired. Open the token settings (top right of the dashboard) and paste a fresh one.';
  }
  if (status === 403 && /rate limit/i.test(msg)) {
    return "GitHub's rate limit was hit - wait a few minutes and publish again.";
  }
  if (status === 404) {
    return "The publishing token can't reach the site's repository - re-create it with access to " + OWNER + '/' + REPO + '.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'No connection to GitHub - check your internet and try again. Your work is safe in this browser.';
  }
  return 'Publishing failed: ' + msg + ' - your work is safe in this browser; try again.';
}
