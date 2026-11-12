/* lab/chrome.js: optional helpers for lab/chrome.css. Classic script;
   decoration only.

   The name plate (.hero) is painted as the lab's ceiling carried on up the
   page. So that there is no seam where it meets the illustration, this
   draws the scene's own ceiling furniture (the tile joints, the duct and its
   brackets, the vents: the coordinates and colours in lab/scene.js's shell)
   into the header's background, placed from the scene's live camera, as
   CSS gradient layers in --ch-joints. The colours are the scene's under its
   night veil (#0b1430 at .6). Nothing here adds DOM, text or focus stops;
   without it the header is the same ceiling, just without the joints. */
(function () {
    'use strict';

    var root = document.documentElement;
    var SW = 4520;                       // scene width (lab/scene.js)

    // scene colours under the night veil: 0.4 * c + 0.6 * #0b1430
    var BAND = '#1b2134';                // ceiling/wall joint #33353a
    var DUCT = '#31384b';                // #6b6e73
    var DUCT_HI = '#3c4255';             // #85888c
    var DUCT_LO = '#242b3e';             // #4a4d52
    var BRACKET = '#2b3141';             // #5a5d62
    var BRACKET_CAP = '#232a3d';         // #45484c
    var VENT = '#2d3346';                // #5f6267
    var GRILLE = '#192131';              // #2e3034

    // Ceiling joints: the scene's nine (lab/scene.js), then the same
    // perspective carried on toward the viewer (each gap about 1.4x the last).
    var JOINTS = [50, 40, 26, 6, -22, -62, -118, -196, -300, -446, -650, -936, -1336];

    var hero, stage, svg, last = '', queued = false;

    function px(n) { return (Math.round(n * 100) / 100) + 'px'; }

    // A flat rectangle as a background layer. x and w in px from the
    // header's left edge (null: full width); bottom in px above the header's
    // bottom edge.
    function layer(color, x, w, bottom, h) {
        var pos = (x === null ? '0' : px(x)) + ' calc(100% - ' + px(bottom) + ')';
        var size = (w === null ? '100%' : px(w)) + ' ' + px(h);
        return 'linear-gradient(' + color + ',' + color + ') ' + pos + ' / ' + size + ' no-repeat';
    }

    function paint() {
        queued = false;
        if (!hero || !stage || !svg) return;
        // Only while the stage sits directly under the header (not while a
        // room has the lab fixed behind the drawer).
        var hr = hero.getBoundingClientRect();
        var st = stage.getBoundingClientRect();
        if (Math.abs(hr.bottom - st.top) > 2 || hr.height < 10) return;
        var sv = svg.getBoundingClientRect();
        if (!sv.width) return;

        var k = sv.width / SW;           // css px per scene unit
        var yTop = (st.top - sv.top) / k; // scene y at the top of the stage
        var x0 = sv.left - hr.left;       // scene x = 0, in header px
        var out = [];

        // Rect in scene units [y0, y1], clipped to what lies above the stage.
        function rect(color, sx, sw, y0, y1) {
            if (y0 >= yTop) return;
            y1 = Math.min(y1, yTop);
            var bottom = (yTop - y1) * k, h = (y1 - y0) * k;
            if (bottom > hr.height || h <= 0) return;
            out.push(layer(color, sx === null ? null : x0 + sx * k, sw === null ? null : sw * k, bottom, Math.max(h, 1)));
        }

        // the joint between ceiling and wall (only when the camera cuts it)
        rect(BAND, null, null, 56, 66);
        // duct brackets, then the duct (drawn first = on top)
        for (var dj = 120; dj < SW; dj += 520) {
            rect(BRACKET_CAP, dj - 2, 26, -74, -68);
            rect(BRACKET, dj, 22, -74, -2);
        }
        rect(DUCT_LO, null, null, -16, -6);
        rect(DUCT_HI, null, null, -70, -56);
        rect(DUCT, null, null, -70, -6);
        // vents with their grilles
        [600, 1700, 2900, 4000].forEach(function (vx) {
            for (var g = 0; g < 6; g++) rect(GRILLE, vx + 8, 104, 18 + g * 3.6, 19.6 + g * 3.6);
            rect(VENT, vx, 120, 14, 40);
        });
        // tile joints, fading as they come toward the viewer
        JOINTS.forEach(function (y, i) {
            var a = Math.max(0, 0.16 - i * 0.012) * 0.9 * Math.min(1, 2 * k);
            if (a <= 0.004 || y + 1 >= yTop) return;
            var bottom = (yTop - (y + 1)) * k;
            if (bottom > hr.height) return;
            out.push(layer('rgb(0 0 0 / ' + a.toFixed(3) + ')', null, null, bottom, Math.max(2 * k, 1)));
        });

        // the tile joints that run front to back: straight lines in this
        // front-on view, every 240 units, fading out toward the top of the page
        if (yTop > -600) {
            var vb = Math.max(0, (yTop - 56) * k), vh = hr.height - vb;
            if (vh > 0) {
                var va = (0.09 * 0.9 * Math.min(1, 2 * k)).toFixed(3);
                for (var cx = 80; cx < SW; cx += 240) {
                    var lx = x0 + cx * k;
                    if (lx < -2 || lx > hr.width + 2) continue;
                    out.push('linear-gradient(to top, rgb(0 0 0 / ' + va + '), rgb(0 0 0 / ' + va + ') 35%, rgb(0 0 0 / 0)) ' +
                        px(lx) + ' calc(100% - ' + px(vb) + ') / ' + px(Math.max(2 * k, 1)) + ' ' + px(vh) + ' no-repeat');
                }
            }
        }

        var value = out.length ? out.join(',') : '';
        if (value === last) return;
        last = value;
        if (value) hero.style.setProperty('--ch-joints', value);
        else hero.style.removeProperty('--ch-joints');
    }

    function queue() {
        if (queued) return;
        queued = true;
        (window.requestAnimationFrame || setTimeout)(paint);
    }

    function start() {
        if (!root.classList.contains('lab-live')) return;
        hero = document.querySelector('.hero');
        stage = document.getElementById('lab-stage');
        svg = stage && stage.querySelector('svg');
        if (!hero || !svg) return;
        paint();
        window.addEventListener('resize', queue);
        // The camera moves the scene by its inline transform: follow it.
        if (window.MutationObserver) {
            new MutationObserver(queue).observe(svg, { attributes: true, attributeFilter: ['style', 'width', 'height'] });
            new MutationObserver(queue).observe(root, { attributes: true, attributeFilter: ['class'] });
        }
        // lab.js measures the rail into --lab-nav-h the instant lab-live is
        // set; if anything was still settling then (fonts, a transition),
        // correct it once things are still, so the drawer tucks under exactly.
        function navFit() {
            var nav = document.querySelector('.navbar');
            if (!nav) return;
            var h = nav.getBoundingClientRect().height;
            var cur = parseFloat(root.style.getPropertyValue('--lab-nav-h'));
            if (h && Math.abs(h - cur) > 0.5) root.style.setProperty('--lab-nav-h', h + 'px');
        }
        window.addEventListener('load', navFit);
        setTimeout(navFit, 450);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(navFit);

        // fonts and late layout can move the header
        window.addEventListener('load', queue);
        setTimeout(queue, 600);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
