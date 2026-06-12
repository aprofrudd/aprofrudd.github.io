// Take-home lesson recap (read-only). Renders the whole lesson from
// window.STAGES so students can revisit the content at home and build their
// poster. No voting, no Firebase - a static study page generated from the same
// data the projector uses, so it never drifts out of sync.
//
// Lesson-agnostic: it reads window.STAGES (stages.js), window.CITIES (cities.js)
// and window.POSTER (poster-template.js, for the consolidated references).

(function () {
  const STAGES = window.STAGES || [];
  const T = window.POSTER || {};
  const root = document.getElementById('recap-root');
  if (!root) return;

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function figure(src, caption) {
    const fig = el('figure', 'recap-figure');
    const img = el('img');
    img.src = src; img.alt = caption || ''; img.loading = 'lazy';
    img.onerror = () => { fig.style.display = 'none'; };
    fig.appendChild(img);
    if (caption) { const fc = el('figcaption'); fc.textContent = caption; fig.appendChild(fc); }
    return fig;
  }

  function buildTable(t) {
    const wrap = el('div', 'recap-table-wrap');
    const tbl = el('table', 'recap-table');
    if (t.headers) {
      const thead = el('thead'), tr = el('tr');
      t.headers.forEach(h => { const th = el('th'); th.textContent = h; tr.appendChild(th); });
      thead.appendChild(tr); tbl.appendChild(thead);
    }
    const tbody = el('tbody');
    const top = Number.isInteger(t.highlightTop) ? t.highlightTop : 0;
    (t.rows || []).forEach((row, i) => {
      const tr = el('tr');
      if (i < top) tr.classList.add('highlight');
      row.forEach((cell, ci) => {
        const td = el('td'); td.textContent = cell;
        if (ci === 0) td.classList.add('rowlabel');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl);
    return wrap;
  }

  function quoteBlock(stage) {
    const q = el('blockquote', 'recap-quote');
    q.innerHTML = `“${stage.quote}”`;
    if (stage.citation) {
      const cite = el('cite');
      if (stage.link) {
        const safe = String(stage.link).replace(/"/g, '&quot;');
        cite.innerHTML = `- <a href="${safe}" target="_blank" rel="noopener">${stage.citation} ↗</a>`;
      } else {
        cite.textContent = '- ' + stage.citation;
      }
      q.appendChild(cite);
    }
    return q;
  }

  STAGES.forEach(stage => {
    if (stage.type === 'poster') return;   // handled as the call-to-action below

    const sec = el('section', 'recap-section');
    const h = el('h2', 'recap-h2');
    h.textContent = stage.title || '';
    sec.appendChild(h);

    if (stage.blurb) {
      const b = el('p', 'recap-blurb');
      b.innerHTML = stage.blurb;   // blurbs are author-written and may contain entities (e.g. &gt;)
      sec.appendChild(b);
    }

    if (stage.figure) sec.appendChild(figure(stage.figure, stage.figureCaption));
    if (stage.table)  sec.appendChild(buildTable(stage.table));
    if (stage.sideFigure) sec.appendChild(figure(stage.sideFigure, stage.sideFigureCaption));

    if (stage.quote) sec.appendChild(quoteBlock(stage));
    else if (stage.link) {
      const p = el('p', 'recap-link');
      const safe = String(stage.link).replace(/"/g, '&quot;');
      p.innerHTML = `<a href="${safe}" target="_blank" rel="noopener">${stage.citation || 'Read the source'} ↗</a>`;
      sec.appendChild(p);
    }

    // For the questions we voted on, list the choices as a study prompt.
    if (stage.type === 'mcq' && Array.isArray(stage.options) && stage.options.length) {
      const note = el('p', 'recap-q-note');
      note.textContent = stage.maxSelect > 1
        ? `In class we picked up to ${stage.maxSelect} from:`
        : 'In class we chose from:';
      sec.appendChild(note);
      const ul = el('ul', 'recap-options');
      stage.options.forEach(o => {
        const li = el('li');
        li.textContent = o.label + (o.sublabel ? ' - ' + o.sublabel : '');
        ul.appendChild(li);
      });
      sec.appendChild(ul);
    }

    root.appendChild(sec);
  });

  // Consolidated reference list (verified citations from the poster template).
  if (Array.isArray(T.references) && T.references.length) {
    const sec = el('section', 'recap-section recap-refs');
    const h = el('h2', 'recap-h2'); h.textContent = 'References';
    sec.appendChild(h);
    const ol = el('ol');
    T.references.forEach(r => { const li = el('li'); li.textContent = r; ol.appendChild(li); });
    sec.appendChild(ol);
    root.appendChild(sec);
  }
})();
