/*
 * slides.js — one section at a time, for narrating over.
 *
 * Every element carrying .v-slide (the hero and each section) becomes a
 * slide. Next / Back buttons and the arrow keys move between them, nav links
 * jump straight to one, and the URL hash follows so any slide is linkable.
 * Scrolling still works inside a slide — the three-chart card is taller than
 * a screen — it is only movement between sections that becomes a transition.
 *
 * Charts render lazily on first sight, so showing a slide force-reveals
 * everything inside it rather than waiting for an IntersectionObserver that
 * a display:none element never triggers.
 */

import { navToggle, revealOnScroll, revealAll } from './reveal.js';
import { h } from './figure.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSlides() {
  const slides = Array.from(document.querySelectorAll('.v-slide'));
  if (slides.length < 2) return false;

  document.body.classList.add('v-slides');
  const navLinks = Array.from(document.querySelectorAll('.nav-menu a[href^="#"]'));
  const navMenu = document.querySelector('.nav-menu');
  const navBtn = document.querySelector('.nav-toggle');
  const bar = document.querySelector('.v-progress-bar');
  let index = 0;

  const prev = h('button', { class: 'v-btn', type: 'button', 'aria-label': 'Previous section' }, '← Back');
  const next = h('button', { class: 'v-btn v-btn-primary', type: 'button', 'aria-label': 'Next section' }, 'Next →');
  const count = h('span', { class: 'v-slidebar-count', 'aria-live': 'polite' });
  document.body.appendChild(h('div', { class: 'v-slidebar', role: 'navigation', 'aria-label': 'Sections' }, prev, count, next));

  const indexFor = (id) => slides.findIndex((s) => s.id === id);

  function show(i, { push = true } = {}) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    index = i;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    document.body.classList.toggle('is-last', i === slides.length - 1);

    // Always start a slide at the top, instantly — the site's smooth
    // scroll-behavior would otherwise animate the jump.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;

    revealAll(slides[i]);
    count.textContent = `${i + 1} / ${slides.length}`;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    if (bar) bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + slides[i].id));
    if (navMenu && navBtn) { navMenu.classList.remove('active'); navBtn.setAttribute('aria-expanded', 'false'); }

    if (push) {
      const url = slides[i].id ? '#' + slides[i].id : location.pathname + location.search;
      history.pushState({ slide: i }, '', url);
    }
  }

  navLinks.forEach((a) => a.addEventListener('click', (e) => {
    const k = indexFor(a.getAttribute('href').slice(1));
    if (k >= 0) { e.preventDefault(); show(k); }
  }));
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));

  document.addEventListener('keydown', (e) => {
    // Leave the arrow keys to controls that use them (sliders, text fields).
    // A focused button does not, and Next/Back keep focus after a click.
    const t = e.target;
    if (t && typeof t.matches === 'function' && t.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); show(index + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(index - 1); }
  });

  window.addEventListener('popstate', (e) => {
    const k = e.state && typeof e.state.slide === 'number' ? e.state.slide : indexFor(location.hash.slice(1));
    show(k >= 0 ? k : 0, { push: false });
  });

  navToggle();
  revealOnScroll();

  // `?focus=id` still opens on that section; so does a plain #id.
  const focus = new URLSearchParams(location.search).get('focus');
  const start = Math.max(0, focus ? indexFor(focus) : indexFor(location.hash.slice(1)));
  history.replaceState({ slide: start }, '', location.href);
  show(start, { push: false });
  return true;
}
