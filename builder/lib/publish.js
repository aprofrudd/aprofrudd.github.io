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
    const res = await fetch('../presentations.json', { cache: 'no-store' });
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

// ---- publish ---------------------------------------------------------------

// Returns the live projector URL. spec = the presentation spec; mediaBlobs =
// { 'media/x.png': dataURL } uploaded images to commit alongside.
export async function publishPresentation(spec, mediaBlobs) {
  if (!getToken()) throw new Error('No GitHub token set.');
  const slug = spec.slug;
  if (!slug) throw new Error('Presentation has no slug.');

  const version = Date.now().toString(36);   // cache-buster for ?v=
  const { files } = buildPresentationFiles(spec, version);

  // Text blobs (utf-8) for the generated files...
  const tree = [];
  for (const [rel, text] of Object.entries(files)) {
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST', body: JSON.stringify({ content: text, encoding: 'utf-8' })
    });
    tree.push({ path: `${slug}/${rel}`, mode: '100644', type: 'blob', sha: blob.sha });
  }
  // ...and base64 blobs for every uploaded image.
  for (const [rel, dataUrl] of Object.entries(mediaBlobs || {})) {
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST', body: JSON.stringify({ content: dataUrlToBase64(dataUrl), encoding: 'base64' })
    });
    tree.push({ path: `${slug}/${rel}`, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // Update the root manifest in the SAME commit.
  const manifest = upsertManifest(await fetchManifest(), {
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

  return `https://alanruddock.com/${slug}/results.html`;
}
