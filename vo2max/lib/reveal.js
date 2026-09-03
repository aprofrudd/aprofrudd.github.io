/*
 * reveal.js — reading progress, scroll reveal, and focus mode.
 *
 * The rest of the site has no scroll-driven motion at all. This is a
 * deliberate addition for the learning modules: charts that draw themselves
 * in when you reach them direct attention and give a narrator something to
 * talk over. It is one 600ms entrance per element, on first sight only, and
 * it is switched off entirely under prefers-reduced-motion.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fill a bar across the top of the page as the reader scrolls. */
export function progressBar() {
  const bar = document.querySelector('.v-progress-bar');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    bar.style.width = pct + '%';
    ticking = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    // Fall back to a timer when the tab is hidden: rAF does not fire there,
    // which would otherwise strand `ticking` and kill every later update.
    if (document.hidden) setTimeout(update, 100);
    else requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/**
 * Reveal elements as they enter the viewport, and run an optional callback
 * the first time each one is seen. Charts use the callback to start drawing.
 */
export function revealOnScroll(selector = '.v-reveal') {
  const items = Array.from(document.querySelectorAll(selector));
  if (!items.length) return;

  if (reduced() || !('IntersectionObserver' in window)) {
    items.forEach(show);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

  items.forEach((n) => io.observe(n));

  // Anything already on screen is revealed straight away rather than waiting
  // for the observer. Without this, landing directly on a section — a deep
  // link, a restored scroll position, or focus mode — can leave its chart
  // blank forever, because no scroll ever happens to trigger the callback.
  const sweep = () => {
    let remaining = 0;
    items.forEach((n) => {
      if (n.__entered) return;
      const r = n.getBoundingClientRect();
      const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (r.height > 0 && visible / Math.min(r.height, window.innerHeight) >= 0.15) {
        show(n);
        io.unobserve(n);
      } else {
        remaining += 1;
      }
    });
    return remaining;
  };
  requestAnimationFrame(sweep);
  // One more pass once web fonts and images have settled the layout.
  window.addEventListener('load', () => { if (sweep() === 0) return; });
}

function show(node) {
  node.classList.add('is-in');
  runEnter(node);
}

function runEnter(node) {
  if (node.__entered) return;
  node.__entered = true;
  if (typeof node.__onEnter === 'function') node.__onEnter();
}

/**
 * Register a callback to run the first time `node` is scrolled into view.
 * Charts call this instead of drawing immediately, so the animation is not
 * wasted above the fold or off screen.
 */
export function onFirstView(node, fn) {
  node.classList.add('v-reveal');
  node.__onEnter = fn;
}

/**
 * Highlight the nav link for the section currently in view.
 * Same probe-line approach as the homepage: find whichever section straddles
 * a line just under the fixed navbar.
 */
export function sectionSpy() {
  const navbar = document.querySelector('.navbar');
  const links = Array.from(document.querySelectorAll('.nav-menu a[href^="#"]'));
  const pairs = links
    .map((a) => ({ a, section: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter((p) => p.section);
  if (!pairs.length) return;

  let ticking = false;
  const update = () => {
    const probe = (navbar ? navbar.getBoundingClientRect().height : 0) + 4;
    let current = null;
    pairs.forEach((p) => {
      const r = p.section.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) current = p;
    });
    if (!current) {
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atEnd) current = pairs[pairs.length - 1];
      else if (pairs[0].section.getBoundingClientRect().top > probe) current = null;
    }
    pairs.forEach((p) => p.a.classList.toggle('is-current', p === current));
    ticking = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    if (document.hidden) setTimeout(update, 100);
    else requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', update);
  document.addEventListener('visibilitychange', onScroll);
  update();
}

/** The mobile nav toggle, same behaviour as the homepage. */
export function navToggle() {
  const btn = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    menu.classList.toggle('active', !open);
  });
  menu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('active');
    });
  });
}

/**
 * Focus mode: ?focus=<section-id> dims everything but one section so a single
 * concept can be screen-recorded without scrolling past anything else.
 */
export function focusMode() {
  const id = new URLSearchParams(location.search).get('focus');
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;

  document.body.classList.add('v-focus-mode');
  target.classList.add('is-focus');

  // Charts normally draw themselves only when scrolled into view, which makes
  // the page grow as you go. Scrolling straight to a section therefore aims at
  // a position that is about to move, and the target's own chart never draws
  // because nothing ever scrolls past it. In focus mode we give up the lazy
  // rendering: build everything first, then jump once the height is final.
  document.querySelectorAll('.v-reveal').forEach(show);

  // The browser restores the previous scroll position on reload, which lands
  // after our jump and undoes it. In focus mode we own the scroll position.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const jump = () => {
    const top = target.getBoundingClientRect().top + window.scrollY;
    const offset = Math.max(0, (window.innerHeight - target.offsetHeight) / 2);
    // The site sets scroll-behavior: smooth on <html>, and behavior:'auto'
    // defers to it rather than jumping. Suppress it for this one hop —
    // animating ten thousand pixels is not what focus mode wants.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, top - offset));
    root.style.scrollBehavior = previous;
  };
  requestAnimationFrame(() => requestAnimationFrame(jump));
  window.addEventListener('load', () => { jump(); setTimeout(jump, 120); });

  const banner = document.createElement('div');
  banner.className = 'v-focus-banner';
  banner.innerHTML = 'Focus mode &mdash; one section only. ';
  const link = document.createElement('a');
  link.href = location.pathname + '#' + id;
  link.textContent = 'Show the whole page';
  banner.appendChild(link);
  document.body.appendChild(banner);
}

/** Wire up everything a module page needs. */
export function initModulePage() {
  navToggle();
  progressBar();
  sectionSpy();
  revealOnScroll();
  focusMode();
}
