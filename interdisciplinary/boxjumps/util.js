import { BOXES } from './content.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// localStorage can throw (private mode, blocked storage), so every call is guarded.
export const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function parse(v) {
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

export const fmtCm = (n) => (Math.round(Number(n) * 10) / 10).toFixed(1).replace(/\.0$/, '');

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Attempts chart: one line per athlete, x = attempt number, y = box (cm) or jump height (cm).
export function chartSVG(rows, phase, nameFn) {
  const box = phase === 'box';
  const ids = [...new Set(rows.map((r) => r.athlete))];
  const series = ids.map((id) => ({ id, pts: rows.filter((r) => r.athlete === id) }));
  const n = Math.max(...series.map((s) => s.pts.length));
  const vals = rows.map((r) => Number(box ? r.box_cm : r.height_cm));
  const yMin = box ? 40 : Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  const yMax = box ? 85 : Math.ceil((Math.max(...vals) + 5) / 10) * 10;
  const W = 600, H = 220, L = 44, R = 12, Tp = 14, B = 30;
  const x = (i) => L + ((i + 0.5) * (W - L - R)) / n;
  const y = (v) => Tp + (1 - (v - yMin) / (yMax - yMin)) * (H - Tp - B);
  const grid = box
    ? BOXES.map((b) => ({ v: b.cm, label: b.label }))
    : Array.from({ length: (yMax - yMin) / 10 + 1 }, (_, i) => ({ v: yMin + i * 10, label: `${yMin + i * 10}` }));
  const label = box ? 'Box height by attempt' : 'Jump height by attempt';
  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
      ${grid.map((g) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(g.v)}" y2="${y(g.v)}"/><text class="axis" x="${L - 6}" y="${y(g.v) + 4}" text-anchor="end">${g.label}</text>`).join('')}
      ${Array.from({ length: n }, (_, i) => `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`).join('')}
      ${series.map((s, si) => {
        const cls = `s${si + 1}`;
        const pts = s.pts.map((r, i) => [x(i), y(Number(box ? r.box_cm : r.height_cm)), r]);
        return `<polyline class="line ${cls}" points="${pts.map((p) => `${p[0]},${p[1]}`).join(' ')}"/>
          ${pts.map(([px, py, r]) => `<circle class="pt ${cls} ${box && !r.success ? 'miss' : ''}" cx="${px}" cy="${py}" r="6"><title>${esc(nameFn(s.id))}: ${box ? `${r.box_cm} cm ${r.success ? 'made it' : 'missed'}` : `${r.height_cm} cm`}${r.strategy ? ` · ${esc(r.strategy)}` : ''}</title></circle>`).join('')}`;
      }).join('')}
    </svg>
    <figcaption>${series.map((s, si) => `<span class="key s${si + 1}"><i></i>${esc(nameFn(s.id))}</span>`).join('')}${box ? '<span class="key"><i class="hollow"></i>missed</span>' : ''}<span class="muted small">x = attempt number</span></figcaption>
  </figure>`;
}
