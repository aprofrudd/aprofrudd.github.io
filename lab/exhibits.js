/* LabExhibits: small entrance effects for the CV sections in the lab panel.
 * Classic script, one global (window.LabExhibits). Optional: if it fails to load,
 * the sections are plain static HTML. Never changes wording, numbers or links.
 *
 *   LabExhibits.enter(el)   el is a section or any element containing sections
 *
 * All motion is CSS animation (fill-mode both) driven by a `lab-ex-play` class
 * on the section; a safety timeout always removes the class and every inline
 * variable, so nothing can be stranded invisible. Counted numbers are the only
 * JS-driven text, and always end by restoring the stored original string.
 */
(function () {
    'use strict';

    var PLAY = 'lab-ex-play';
    var SAFETY_MS = 2400;          // everything is cleared by now, whatever happened
    var COUNT_MS = 900;
    var COUNTERS = '.glance-number:not(.glance-number--text), .stat-number';

    // list selector -> per-item stagger ceiling (ms for whole list) handled below
    var LISTS = [
        '.timeline-item', '.publication-item', '.grant-item', '.talk-item',
        '.project-item', '.phd-item', '.faq-item'
    ].join(', ');
    var CHIPS = '.skill-tag, .credential';

    var timers = new WeakMap();    // section -> safety timeout id
    var counts = new WeakMap();    // counter element -> interval id
    var entered = new WeakSet();   // sections entered at least once
    var pubObserver = null;

    function reduced() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch (e) { return false; }
    }

    // ---- counting -------------------------------------------------------
    // "~£178,000", "1,800+", "38": prefix, digits (with commas / decimals), suffix.
    var NUM = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)([^\d]*)$/;

    function textNodeOf(el) {
        return el.childNodes.length === 1 && el.firstChild.nodeType === 3 ? el.firstChild : null;
    }

    function restore(el) {
        var id = counts.get(el);
        if (id) { clearInterval(id); counts.delete(el); }
        var orig = el.getAttribute('data-lab-ex-orig');
        if (orig !== null) {
            var tn = textNodeOf(el);
            if (tn) tn.data = orig;
        }
        el.classList.remove('lab-ex-counting');
    }

    function count(el) {
        restore(el);
        var tn = textNodeOf(el);
        if (!tn) return;
        var orig = el.getAttribute('data-lab-ex-orig');
        if (orig === null) {
            orig = tn.data;
            el.setAttribute('data-lab-ex-orig', orig);
        }
        var m = NUM.exec(orig);
        if (!m) return;
        var target = parseFloat(m[2].replace(/,/g, ''));
        if (!isFinite(target) || target <= 0) return;
        var dec = m[2].indexOf('.') < 0 ? 0 : m[2].length - m[2].indexOf('.') - 1;
        var commas = m[2].indexOf(',') >= 0;
        var start = Date.now();
        el.classList.add('lab-ex-counting');

        function fmt(v) {
            var s = dec ? v.toFixed(dec) : String(Math.round(v));
            if (commas) {
                var p = s.split('.');
                p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                s = p.join('.');
            }
            return m[1] + s + m[3];
        }

        function tick() {
            var k = Math.min(1, (Date.now() - start) / COUNT_MS);
            if (k >= 1) { restore(el); return; }
            var e = 1 - Math.pow(1 - k, 3);
            tn.data = fmt(target * e);
        }
        tn.data = fmt(0);
        // setInterval + Date.now (not rAF) so a backgrounded tab still lands.
        counts.set(el, setInterval(tick, 40));
    }

    // ---- staggering -----------------------------------------------------
    function indexList(items) {
        var n = items.length;
        // 50ms steps, but a long list still finishes within about 1s
        var step = n > 1 ? Math.min(50, 900 / (n - 1)) : 0;
        for (var i = 0; i < n; i++) {
            items[i].style.setProperty('--lab-ex-d', Math.round(i * step) + 'ms');
        }
    }

    function indexSection(sec) {
        // group items by their parent so separate lists stagger separately
        var items = sec.querySelectorAll(LISTS);
        var groups = [], parents = [];
        for (var i = 0; i < items.length; i++) {
            var p = items[i].parentNode, gi = parents.indexOf(p);
            if (gi < 0) { parents.push(p); groups.push([]); gi = parents.length - 1; }
            groups[gi].push(items[i]);
        }
        groups.forEach(indexList);

        var chips = sec.querySelectorAll(CHIPS);
        var cstep = chips.length > 1 ? Math.min(28, 700 / (chips.length - 1)) : 0;
        for (var c = 0; c < chips.length; c++) {
            chips[c].style.setProperty('--lab-ex-d', Math.round(c * cstep) + 'ms');
        }

        var beats = sec.querySelectorAll('.project-beats > dt, .project-beats > dd');
        for (var b = 0; b < beats.length; b++) {
            beats[b].style.setProperty('--lab-ex-b', String(
                Array.prototype.indexOf.call(beats[b].parentNode.children, beats[b])));
        }
    }

    function clearSection(sec) {
        sec.classList.remove(PLAY);
        var styled = sec.querySelectorAll('[style*="--lab-ex-"]');
        for (var i = 0; i < styled.length; i++) {
            styled[i].style.removeProperty('--lab-ex-d');
            styled[i].style.removeProperty('--lab-ex-b');
            if (!styled[i].getAttribute('style')) styled[i].removeAttribute('style');
        }
        var nums = sec.querySelectorAll(COUNTERS);
        for (var n = 0; n < nums.length; n++) {
            restore(nums[n]);
            nums[n].removeAttribute('data-lab-ex-orig');
        }
        timers.delete(sec);
    }

    function play(sec) {
        var t = timers.get(sec);
        if (t) clearTimeout(t);
        clearSection(sec);
        if (reduced()) return;

        indexSection(sec);
        void sec.offsetWidth;              // restart the animations on replay
        sec.classList.add(PLAY);
        var nums = sec.querySelectorAll(COUNTERS);
        for (var i = 0; i < nums.length; i++) count(nums[i]);
        entered.add(sec);
        timers.set(sec, setTimeout(function () { clearSection(sec); }, SAFETY_MS));
    }

    // ---- late content (OpenAlex replaces #publications-list) ------------
    function watchPublications() {
        if (pubObserver || !window.MutationObserver) return;
        var list = document.getElementById('publications-list');
        if (!list) return;
        pubObserver = new MutationObserver(function () {
            var sec = list.closest('section');
            // Only stagger the new items if the section is mid-entrance; otherwise
            // they simply appear, which is always safe.
            if (sec && sec.classList.contains(PLAY)) indexList(list.querySelectorAll('.publication-item'));
        });
        pubObserver.observe(list, { childList: true });
    }

    // a backgrounded tab: land every count immediately
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) return;
        var nums = document.querySelectorAll('.lab-ex-counting');
        for (var i = 0; i < nums.length; i++) restore(nums[i]);
    });

    window.LabExhibits = {
        enter: function (el) {
            try {
                if (!el || !el.querySelectorAll) return;
                watchPublications();
                var secs = el.tagName === 'SECTION' ? [el] : Array.prototype.slice.call(el.querySelectorAll('section'));
                if (!secs.length) secs = [el];
                secs.forEach(play);
            } catch (e) {}
        },
        get reduced() { return reduced(); }
    };
})();
