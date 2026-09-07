/*
 * cite.js — one way to link a paper.
 *
 * Every study mentioned on the page is linked to its DOI (PubMed when there
 * is no DOI). The interactives and module-01.js both need this, and an
 * interactive cannot import from module-01.js without a cycle, so it lives
 * here beside data.js.
 */

import { SOURCES } from './data.js';
import { h } from '../lib/figure.js';

/** The canonical link for a source: DOI first, PubMed otherwise. */
export function refUrl(src) {
  return src.doi ? `https://doi.org/${src.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`;
}

/** "Surname et al. (year)" — or "Surname (year)" for a single author. */
export function refLabel(src) {
  const surname = src.authors.split(',')[0].trim().split(' ')[0];
  return `${surname}${src.authors.includes(',') ? ' et al.' : ''} (${src.year})`;
}

/** An <a> to the paper, as an HTML string for `html:` attributes. */
export function refLink(key, text) {
  const s = SOURCES[key];
  return `<a href="${refUrl(s)}" target="_blank" rel="noopener">${text || refLabel(s)}</a>`;
}

/** The citation with its journal abbreviation in italics, e.g. <em>N Engl J Med</em> 2002;346:793-801. */
export function citationHtml(src) {
  return src.citation.replace(/^([A-Za-z .&]+?) (\d{4};)/, '<em>$1</em> $2');
}

/** A .v-source card listing one or more papers. */
export function sourceCard(label, keys, style) {
  return h('div', { class: 'v-source', style: style || 'margin:2rem auto 0' },
    h('div', { class: 'v-source-label' }, label),
    keys.map((k, i) => {
      const s = SOURCES[k];
      return h('div', { class: 'v-source-cite', style: i ? 'margin-top:0.75rem' : null, html:
        `<strong style="color:var(--secondary-color)">${s.title}</strong><br>` +
        `${s.authors}. ${citationHtml(s)}. ` +
        `<a href="${refUrl(s)}" target="_blank" rel="noopener">${s.doi ? 'doi:' + s.doi : 'PMID ' + s.pmid}</a>` +
        (s.abstractOnly ? ' &middot; <em>numbers from the abstract; full text not yet consulted</em>' : '') });
    })
  );
}
