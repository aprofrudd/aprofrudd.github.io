/* lab/scene.js — "The lab, after hours".
 *
 * A front-on illustrated physiology lab, built as inline SVG at run time.
 * Classic script, no dependencies, no image files. Exposes one global:
 *
 *   window.LabScene.mount(container, { sfx: fn(name), reduced: bool })
 *     -> { focus(zoneKey|null, inset), mark(zoneKey|null), play(bool), zones }
 *
 * Structure of the SVG, back to front:
 *   art      the room. Hotspots are <a href="#section"> wrapping their object;
 *            toys are <g role="button">. Screens and windows are drawn here too.
 *   dark-on  a navy veil over everything (night), masked with holes where light
 *   dark-off   sources are, so screens/window/lamp pool stay bright. Two veils,
 *            lamp-on and lamp-off, crossfaded, so the masks never re-render.
 *   glow     additive-looking soft light: lamp cone, screen halos, door spill.
 *   ui       floor labels (room links), hover rings and tags, toy bubbles.
 * Scene units: 4520 x 1200. Floor meets wall at y=980.
 */
(function () {
    'use strict';

    var SW = 4520, SH = 1200, FL = 980;
    var ZONES = [
        { key: 'reception', name: 'Reception', x0: 0, x1: 700 },
        { key: 'lab', name: 'Performance Lab', x0: 700, x1: 1490 },
        { key: 'ergo', name: 'Ergometer Bay', x0: 1490, x1: 2100 },
        { key: 'office', name: 'Office', x0: 2100, x1: 2780 },
        { key: 'print', name: 'Print Room', x0: 2780, x1: 3320 },
        { key: 'seminar', name: 'Seminar Room', x0: 3320, x1: 3990 },
        { key: 'desk', name: 'Front Desk', x0: 3990, x1: 4520 }
    ];
    var FOCUS_Y0 = 130, FOCUS_Y1 = 1185;
    // Tight art bounds [x0, y0, x1, y1] for hotspots whose click box is much taller or wider
    // than the object. Used for hover rings, the reading rim and close-up framing only.
    var FIT = {};
    // Close-up scale cap (see focusOn).
    var CLOSE_MAX = 1.5, CLOSE_FILL = 0.55;
    var uid = 0;

    // ------------------------------------------------------------------
    // Tiny SVG string helpers
    // ------------------------------------------------------------------
    function n(v) { return Math.round(v * 10) / 10; }
    function x_(ex) { return ex ? ' ' + ex : ''; }
    function R(x, y, w, h, f, ex) { return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" fill="' + f + '"' + x_(ex) + '/>'; }
    function C(cx, cy, r, f, ex) { return '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '" fill="' + f + '"' + x_(ex) + '/>'; }
    function E(cx, cy, rx, ry, f, ex) { return '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="' + f + '"' + x_(ex) + '/>'; }
    function P(d, f, ex) { return '<path d="' + d + '" fill="' + (f || 'none') + '"' + x_(ex) + '/>'; }
    function S(d, st, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + st + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + x_(ex) + '/>'; }
    function L(x1, y1, x2, y2, st, w, ex) { return S('M' + n(x1) + ' ' + n(y1) + 'L' + n(x2) + ' ' + n(y2), st, w, ex); }
    function T(x, y, txt, size, f, ex) { return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + size + '" fill="' + f + '"' + x_(ex) + '>' + txt + '</text>'; }
    function G(inner, ex) { return '<g' + x_(ex) + '>' + inner + '</g>'; }
    var MID = 'text-anchor="middle"';
    var BOLD = 'font-weight="700"';

    function rng(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // ------------------------------------------------------------------
    // The drawing. Returns markup for each layer plus hotspot/toy boxes.
    // ------------------------------------------------------------------
    function draw(pre) {
        function U(id) { return 'url(#' + pre + id + ')'; }
        function I(id) { return pre + id; }
        var holes = [], lampHoles = [], covers = [], hots = [], toys = [];
        var glow = '';

        function soft(cx, cy, rx, ry, op) { holes.push(E(cx, cy, rx, ry, U('holeSoft'), 'opacity="' + (op || 0.6) + '"')); }
        function hole(x, y, w, h, rx) { holes.push(R(x, y, w, h, '#000', rx ? 'rx="' + rx + '"' : '')); }
        function shadow(cx, cy, rx, ry, op) { return E(cx, cy, rx, ry, U('shadow'), op ? 'opacity="' + op + '"' : ''); }
        function hot(id, label, aria, box, inner) {
            hots.push({ id: id, label: label, box: box, fit: FIT[id] || box, aria: aria });
            return '<a href="#' + id + '" class="lab-sc-hot" data-hot="' + id + '" aria-label="' + aria + '">' +
                R(box[0], box[1], box[2] - box[0], box[3] - box[1], '#000', 'fill-opacity="0"') + inner + '</a>';
        }
        function toy(name, aria, box, inner) {
            toys.push({ name: name, box: box });
            return '<g class="lab-sc-toy lab-sc-toy-' + name + '" role="button" tabindex="0" data-toy="' + name + '" aria-label="' + aria + '">' +
                R(box[0], box[1], box[2] - box[0], box[3] - box[1], '#000', 'fill-opacity="0" class="lab-sc-toyhit"') + inner + '</g>';
        }
        function scribble(x, y, len, col, r, w) {
            var d = '', cx = x;
            while (cx < x + len - 6) {
                var end = Math.min(cx + 10 + r() * 34, x + len);
                d += 'M' + n(cx) + ' ' + n(y);
                for (var px = cx; px < end; px += 4.5) {
                    d += 'L' + n(px + 2.2) + ' ' + n(y - 3 - r() * 5) + 'L' + n(px + 4.5) + ' ' + n(y + r() * 1.5);
                }
                cx = end + 7 + r() * 5;
            }
            return S(d, col, w || 2);
        }

        // ---------------- defs ----------------
        var defs = '' +
            '<linearGradient id="' + I('wall') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#a39f97"/><stop offset=".55" stop-color="#bbb6aa"/><stop offset="1" stop-color="#c3bdb0"/></linearGradient>' +
            '<linearGradient id="' + I('ceil') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#55575c"/><stop offset="1" stop-color="#7a7b7e"/></linearGradient>' +
            '<linearGradient id="' + I('floor') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#6c706b"/><stop offset=".35" stop-color="#5b5f5b"/><stop offset="1" stop-color="#3e423f"/></linearGradient>' +
            '<radialGradient id="' + I('shadow') + '"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".6" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
            '<linearGradient id="' + I('sky') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#0f1730"/><stop offset=".45" stop-color="#2b3765"/><stop offset=".72" stop-color="#7a5f86"/><stop offset=".9" stop-color="#d98b6a"/><stop offset="1" stop-color="#e9a56f"/></linearGradient>' +
            '<linearGradient id="' + I('corr') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#fff7de"/><stop offset=".7" stop-color="#f6dca3"/><stop offset="1" stop-color="#e9c27c"/></linearGradient>' +
            '<radialGradient id="' + I('warm') + '"><stop offset="0" stop-color="#ffc56e" stop-opacity=".55"/><stop offset=".45" stop-color="#ffb457" stop-opacity=".2"/><stop offset="1" stop-color="#ffa040" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('cool') + '"><stop offset="0" stop-color="#8fd3ff" stop-opacity=".38"/><stop offset="1" stop-color="#8fd3ff" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('green') + '"><stop offset="0" stop-color="#6cf08a" stop-opacity=".34"/><stop offset="1" stop-color="#6cf08a" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('amber') + '"><stop offset="0" stop-color="#ffb347" stop-opacity=".3"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('red') + '"><stop offset="0" stop-color="#ff4b4b" stop-opacity=".4"/><stop offset="1" stop-color="#ff4b4b" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('white') + '"><stop offset="0" stop-color="#e8f0ff" stop-opacity=".3"/><stop offset="1" stop-color="#e8f0ff" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('dusk') + '"><stop offset="0" stop-color="#8a9be0" stop-opacity=".22"/><stop offset="1" stop-color="#8a9be0" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('tube') + '"><stop offset="0" stop-color="#fffbe8" stop-opacity=".55"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('mark') + '"><stop offset="0" stop-color="#ffd58a" stop-opacity=".42"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="' + I('hole') + '"><stop offset="0" stop-color="#000"/><stop offset=".3" stop-color="#151515"/><stop offset=".5" stop-color="#444"/><stop offset=".68" stop-color="#8c8c8c"/><stop offset=".84" stop-color="#cfcfcf"/><stop offset="1" stop-color="#fff"/></radialGradient>' +
            '<radialGradient id="' + I('holeSoft') + '"><stop offset="0" stop-color="#555"/><stop offset="1" stop-color="#fff"/></radialGradient>' +
            '<linearGradient id="' + I('spill') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#ffe2a0" stop-opacity=".62"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></linearGradient>' +
            '<linearGradient id="' + I('beam') + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#ffe6b0" stop-opacity=".5"/><stop offset="1" stop-color="#ffd890" stop-opacity=".1"/></linearGradient>' +
            '<linearGradient id="' + I('bag') + '" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#4f1514"/><stop offset=".35" stop-color="#84241f"/><stop offset=".7" stop-color="#a1362e"/><stop offset="1" stop-color="#5e1a18"/></linearGradient>' +
            '<linearGradient id="' + I('cyl') + '" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#2f5440"/><stop offset=".45" stop-color="#5f9473"/><stop offset="1" stop-color="#2a4a38"/></linearGradient>' +
            '<linearGradient id="' + I('steel') + '" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#5b646d"/><stop offset=".5" stop-color="#9aa3ac"/><stop offset="1" stop-color="#59626a"/></linearGradient>' +
            '<linearGradient id="' + I('slide') + '" x1="0" y1="0" x2="1" y2="1">' +
                '<stop offset="0" stop-color="#f6f7f3"/><stop offset="1" stop-color="#d9dde0"/></linearGradient>' +
            '<radialGradient id="' + I('crt') + '" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#0e2611"/><stop offset="1" stop-color="#020802"/></radialGradient>' +
            '<radialGradient id="' + I('ball') + '" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e3e3dd"/><stop offset="1" stop-color="#a9aaa4"/></radialGradient>' +
            '<radialGradient id="' + I('dome') + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9ced3"/><stop offset="1" stop-color="#7f878f"/></radialGradient>' +
            '<pattern id="' + I('cork') + '" width="16" height="16" patternUnits="userSpaceOnUse">' +
                R(0, 0, 16, 16, '#b98a55') + C(3, 4, 1.4, '#9a6d3e') + C(11, 9, 1.1, '#a87a48') + C(6, 13, 1.2, '#cfa06a') + C(14, 2, 0.9, '#8d6236') + '</pattern>' +
            '<pattern id="' + I('peg') + '" width="20" height="20" patternUnits="userSpaceOnUse">' +
                R(0, 0, 20, 20, '#c4a273') + C(10, 10, 2.4, '#7d6040') + '</pattern>' +
            '<pattern id="' + I('slat') + '" width="12" height="13" patternUnits="userSpaceOnUse">' +
                R(0, 0, 12, 13, '#e2dbcb') + R(0, 11, 12, 2, '#c3bba8') + R(0, 0, 12, 1.5, '#f0ebdf') + '</pattern>' +
            '<pattern id="' + I('scan') + '" width="6" height="3" patternUnits="userSpaceOnUse">' +
                R(0, 0, 6, 1.2, '#000', 'opacity=".35"') + '</pattern>' +
            '<pattern id="' + I('belt') + '" width="14" height="14" patternUnits="userSpaceOnUse">' +
                R(0, 0, 14, 14, '#1b1d20') + R(0, 0, 3, 14, '#2c2f34') + '</pattern>' +
            '<clipPath id="' + I('cGlass') + '">' + R(2306, 216, 268, 416, '#000') + '</clipPath>' +
            '<clipPath id="' + I('cMet') + '">' + R(1076, 574, 108, 90, '#000') + '</clipPath>' +
            '<clipPath id="' + I('cCrt') + '">' + R(1908, 600, 124, 106, '#000', 'rx="12"') + '</clipPath>' +
            '<clipPath id="' + I('cBelt') + '">' + R(760, 940, 250, 11, '#000') + '</clipPath>' +
            '<clipPath id="' + I('cTicker') + '">' + R(3832, 270, 140, 8, '#000') + '</clipPath>' +
            '<clipPath id="' + I('cFeed') + '">' + R(1890, 820, 130, 64, '#000') + '</clipPath>';

        // ---------------- shell ----------------
        var shell = '' +
            R(-3000, -3000, SW + 6000, 3060, U('ceil')) +
            R(-3000, 60, SW + 6000, FL - 60, U('wall')) +
            R(-3000, 56, SW + 6000, 10, '#33353a') +
            R(-3000, 66, SW + 6000, 5, '#000', 'opacity=".18"');
        // ceiling tiles (seen from below, receding to the wall line) and a duct
        [50, 40, 26, 6, -22, -62, -118, -196, -300].forEach(function (y, i) {
            shell += L(-3000, y, SW + 3000, y, '#000', 2, 'opacity="' + (0.16 - i * 0.012).toFixed(3) + '"');
        });
        for (var cx2 = 80; cx2 < SW; cx2 += 240) shell += L(cx2, 56, cx2, -600, '#000', 2, 'opacity=".09"');
        shell += R(-3000, -70, SW + 6000, 64, '#6b6e73') + R(-3000, -70, SW + 6000, 14, '#85888c') + R(-3000, -16, SW + 6000, 10, '#4a4d52');
        for (var dj = 120; dj < SW; dj += 520) shell += R(dj, -74, 22, 72, '#5a5d62') + R(dj - 2, -74, 26, 6, '#45484c');
        [600, 1700, 2900, 4000].forEach(function (vx) {
            shell += R(vx, 14, 120, 26, '#5f6267', 'rx="2"');
            for (var vg = 0; vg < 6; vg++) shell += R(vx + 8, 18 + vg * 3.6, 104, 1.6, '#2e3034');
        });
        // two-tone wall: institutional lower panel below a dado rail
        shell += R(-3000, 600, SW + 6000, 346, '#959d97') + R(-3000, 594, SW + 6000, 10, '#d6d1c4') + R(-3000, 604, SW + 6000, 3, '#000', 'opacity=".15"');
        // service pipe along the ceiling
        shell += R(-3000, 112, SW + 6000, 10, '#7d8186') + R(-3000, 112, SW + 6000, 3, '#a1a5aa');
        for (var px = 40; px < SW; px += 420) shell += R(px, 106, 10, 22, '#5d6166');
        // panel seams
        for (var sx = 320; sx < SW; sx += 320) shell += L(sx, 130, sx, 860, '#000', 2, 'opacity=".05"');
        // cable trunking and sockets
        shell += R(-3000, 862, SW + 6000, 20, '#cfcbc1') + R(-3000, 880, SW + 6000, 3, '#000', 'opacity=".18"') + R(-3000, 862, SW + 6000, 2, '#e6e2d8');
        [360, 1230, 2050, 2700, 3460, 3950, 4370].forEach(function (x) {
            shell += R(x, 856, 42, 30, '#ebe7dd', 'rx="3"') + R(x + 9, 866, 4, 9, '#5d6166') + R(x + 22, 866, 4, 9, '#5d6166') + R(x + 33, 862, 5, 5, '#c0392b', 'rx="1"');
        });
        // skirting
        shell += R(-3000, 946, SW + 6000, 34, '#3b3e44') + R(-3000, 946, SW + 6000, 3, '#55595f');
        // floor
        shell += R(-3000, FL, SW + 6000, 3000, U('floor')) + R(-3000, FL, SW + 6000, 12, '#000', 'opacity=".22"');
        [996, 1014, 1038, 1068, 1106, 1154, 1214, 1290, 1390].forEach(function (y, i) {
            shell += L(-3000, y, SW + 3000, y, '#fff', 2, 'opacity="' + (0.035 + i * 0.006).toFixed(3) + '"');
        });
        for (var fx = 40; fx < SW; fx += 240) shell += L(fx, FL, fx, 1700, '#fff', 2, 'opacity=".035"');
        // strip lights (off unless the wall switch is on)
        [250, 820, 1390, 1960, 2530, 3100, 3670, 4240].forEach(function (x) {
            shell += R(x - 156, 72, 312, 14, '#2a2c31', 'rx="3"') + R(x - 146, 86, 292, 9, '#d6d9da', 'rx="4" class="lab-sc-tube"') +
                L(x - 120, 66, x - 120, 72, '#2a2c31', 3) + L(x + 120, 66, x + 120, 72, '#2a2c31', 3);
            glow += E(x, 140, 360, 120, U('tube'), 'class="lab-sc-dayglow"');
        });

        // ================= 1 RECEPTION =================
        var rec = '';
        // exit sign
        rec += R(96, 292, 108, 40, '#13813f', 'rx="5"') + T(136, 320, 'EXIT', 22, '#f4fff7', BOLD + ' ' + MID) +
            P('M170 302 L190 312 L170 322 L170 316 L160 316 L160 308 L170 308Z', '#f4fff7');
        hole(96, 292, 108, 40, 5);
        glow += E(150, 312, 120, 60, U('green'));
        // door: frame, lit corridor, leaf ajar
        rec += R(32, 348, 236, 634, '#2c3036') +
            R(50, 366, 200, 616, U('corr')) +
            R(50, 880, 200, 100, '#e3c07c', 'opacity=".55"') +
            R(214, 420, 30, 300, '#e9d3a2', 'opacity=".6"');           // far corridor wall door
        hole(198, 366, 52, 616);
        rec += P('M50 366 L202 354 L202 994 L50 982Z', '#46616e') +
            P('M68 392 L186 384 L186 956 L68 952Z', '#3e5763') +
            P('M110 428 L162 425 L162 624 L110 626Z', '#fff0c8') +
            S('M110 470 L162 440 M110 520 L162 490 M110 570 L162 540 M110 620 L162 590 M130 428 L162 470', '#c8b585', 1.5, 'opacity=".6"') +
            P('M56 902 L198 904 L198 978 L56 974Z', '#8f989f') + L(56, 914, 198, 916, '#b3bbc1', 2) +
            R(178, 646, 12, 64, '#c9ced3', 'rx="5"') + R(172, 668, 20, 8, '#a8afb5', 'rx="3"') +
            L(202, 354, 202, 994, '#fff3d0', 3);
        hole(110, 425, 52, 201);
        rec += R(32, 976, 236, 8, '#5b5f66');
        glow += P('M198 984 L250 984 L330 1110 L160 1110Z', U('spill'), 'class="lab-sc-corr"') +
            E(225, 680, 110, 360, U('warm'), 'class="lab-sc-corr" opacity=".55"');
        // fire extinguisher on a wall bracket
        rec += R(276, 900, 28, 6, '#2a2d33') + R(274, 776, 34, 126, '#b8241f', 'rx="12"') + R(280, 790, 8, 96, '#e0473f', 'rx="4"', '') +
            R(280, 816, 22, 30, '#f2efe6', 'rx="2"') + R(284, 822, 14, 3, '#b8241f') + R(284, 830, 10, 3, '#9a9a9a') +
            R(282, 760, 18, 18, '#1d1f24', 'rx="3"') + S('M300 764 L316 760 L320 772', '#1d1f24', 4) + S('M282 768 Q262 790 270 830', '#1d1f24', 4) +
            shadow(291, 908, 22, 4, 0.5);
        // light switch (toy)
        rec += toy('switch', 'Wall light switch: turn the strip lights on or off', [304, 648, 374, 742],
            R(324, 670, 34, 50, '#000', 'opacity=".2" rx="5"') + R(320, 666, 34, 50, '#e9e5db', 'rx="5"') + R(322, 668, 30, 46, '#f3efe6', 'rx="4"') +
            G(R(330, 676, 14, 30, '#d4cec0', 'rx="2"') + R(330, 676, 14, 12, '#bdb6a6', 'rx="2"'), 'class="lab-sc-rocker"') + C(351, 672, 1.6, '#c8372d'));
        // scoreboard -> at-a-glance
        var sb = R(330, 150, 8, 18, '#2a2d33') + R(634, 150, 8, 18, '#2a2d33') +
            R(298, 164, 380, 162, '#1d2026', 'rx="8"') + R(308, 174, 360, 142, '#0b0d10', 'rx="4"');
        hole(308, 174, 360, 142, 4);
        [['38', 'PAPERS', 368], ['15', 'TITLE FIGHTS', 488], ['7', 'PROJECTS', 608]].forEach(function (c, i) {
            sb += T(c[2], 258, c[0].length > 1 ? '88' : '8', 76, '#2a1c0a', BOLD + ' ' + MID + ' class="lab-sc-mono"') +
                T(c[2], 258, c[0], 76, '#ffb347', BOLD + ' ' + MID + ' class="lab-sc-mono lab-sc-led"') +
                T(c[2], 298, c[1], 15, '#d79c4f', MID + ' letter-spacing="1"');
            if (i) sb += L(c[2] - 60, 186, c[2] - 60, 304, '#262a30', 2);
        });
        rec += hot('at-a-glance', 'At a glance', 'Scoreboard: at a glance', [290, 146, 686, 334], sb);
        glow += E(488, 250, 260, 150, U('amber'));
        soft(488, 250, 260, 160, 0.4);
        // noticeboard -> about
        var nb = R(298, 378, 210, 262, '#000', 'opacity=".2"') +
            R(294, 372, 210, 262, '#7a4f2e', 'rx="4"') + R(304, 382, 190, 242, U('cork'));
        nb += G(R(318, 396, 86, 108, '#000', 'opacity=".18"') + R(314, 392, 86, 108, '#f7f3ea') + R(320, 398, 74, 72, '#7d98a8') +
            C(357, 425, 13, '#2c3a44') + P('M331 470 Q333 446 357 443 Q381 446 383 470Z', '#2c3a44') +
            R(322, 478, 54, 5, '#7b7b7b') + R(322, 488, 38, 4, '#b3b3b3') + C(357, 396, 5, '#d23c2f'),
            'transform="rotate(-3 357 446)"');
        nb += G(R(416, 396, 70, 64, '#f2d15a') + scribble(424, 418, 52, '#5b5030', rng(3), 1.6) + scribble(424, 434, 44, '#5b5030', rng(4), 1.6) + C(451, 400, 5, '#2f6fb0'),
            'transform="rotate(4 451 428)"');
        nb += G(R(416, 472, 72, 100, '#f3f1ea') + R(424, 482, 44, 7, '#2f3b45') + scribble(424, 504, 56, '#6d6d6d', rng(5), 1.4) +
            scribble(424, 518, 50, '#6d6d6d', rng(6), 1.4) + scribble(424, 532, 56, '#6d6d6d', rng(7), 1.4) + scribble(424, 546, 40, '#6d6d6d', rng(8), 1.4) + C(452, 476, 5, '#2f8a57'),
            'transform="rotate(-2 452 520)"');
        nb += G(R(318, 524, 78, 66, '#f0a2b2') + scribble(326, 548, 58, '#6b2a3a', rng(9), 1.6) + scribble(326, 566, 46, '#6b2a3a', rng(10), 1.6) + C(357, 528, 5, '#e2b022'),
            'transform="rotate(-6 357 556)"');
        nb += G(R(404, 584, 62, 36, '#ffffff') + R(410, 592, 30, 4, '#1f3a5f') + R(410, 602, 44, 3, '#9a9a9a') + R(410, 609, 36, 3, '#9a9a9a'),
            'transform="rotate(3 435 602)"');
        rec += hot('about', 'About', 'Noticeboard with staff card: about', [286, 364, 512, 642], nb);
        // whiteboard on a stand -> now
        var r1 = rng(11);
        var wb = shadow(608, 1018, 130, 12) +
            L(530, 650, 526, 1010, '#8f979e', 7) + L(686, 650, 690, 1010, '#8f979e', 7) +
            L(498, 1012, 556, 1012, '#4f545b', 9) + L(660, 1012, 718, 1012, '#4f545b', 9) +
            C(502, 1020, 6, '#24272c') + C(552, 1020, 6, '#24272c') + C(664, 1020, 6, '#24272c') + C(714, 1020, 6, '#24272c') +
            R(512, 396, 184, 268, '#c4c9cf', 'rx="6"') + R(520, 404, 168, 244, '#eef1ef') +
            P('M600 404 L660 404 L560 648 L520 648 L520 600Z', '#fff', 'opacity=".35"') +
            G(T(532, 438, 'THIS WEEK', 22, '#2456a6', BOLD + ' letter-spacing="1"') +
                S('M532 446 Q580 442 640 447', '#2456a6', 2.5), 'transform="rotate(-1.5 580 438)"');
        for (var wi = 0; wi < 6; wi++) {
            var wy = 476 + wi * 28, col = ['#1d1f24', '#2456a6', '#1d1f24', '#b8322b', '#1d1f24', '#2456a6'][wi];
            wb += R(530, wy - 10, 11, 11, 'none', 'stroke="' + col + '" stroke-width="2"') + scribble(550, wy, 70 + r1() * 60, col, r1, 2);
            if (wi < 2) wb += S('M531 ' + (wy - 5) + ' L536 ' + wy + ' L545 ' + (wy - 16), '#2f8a57', 2.5);
        }
        wb += R(516, 648, 176, 9, '#9aa1a8', 'rx="2"') + R(540, 642, 30, 6, '#b8322b', 'rx="3"') + R(578, 642, 30, 6, '#2456a6', 'rx="3"') + R(640, 641, 24, 7, '#f4f4f4', 'rx="2"');
        rec += hot('now', 'Now', 'Whiteboard, this week: now', [500, 388, 720, 1026], wb);

        // ================= 2 PERFORMANCE LAB =================
        var lab = '';
        // world map -> collaboration
        var mp = R(732, 194, 288, 182, '#000', 'opacity=".2"') + R(726, 186, 290, 184, '#23272d', 'rx="3"') + R(734, 194, 274, 168, '#2b4a63');
        function mpt(u, v) { return n(738 + u * 266) + ' ' + n(198 + v * 160); }
        var cont = [
            [[0.05, 0.18], [0.17, 0.10], [0.31, 0.13], [0.34, 0.22], [0.28, 0.30], [0.25, 0.42], [0.21, 0.49], [0.17, 0.43], [0.11, 0.35], [0.07, 0.27]],
            [[0.26, 0.52], [0.33, 0.55], [0.37, 0.62], [0.33, 0.76], [0.29, 0.88], [0.27, 0.78], [0.25, 0.63]],
            [[0.46, 0.18], [0.53, 0.14], [0.57, 0.20], [0.55, 0.30], [0.49, 0.33], [0.46, 0.27]],
            [[0.46, 0.38], [0.55, 0.36], [0.61, 0.45], [0.58, 0.58], [0.54, 0.71], [0.50, 0.66], [0.48, 0.52], [0.44, 0.45]],
            [[0.57, 0.13], [0.70, 0.08], [0.86, 0.12], [0.93, 0.21], [0.87, 0.32], [0.79, 0.43], [0.70, 0.45], [0.64, 0.38], [0.58, 0.31]],
            [[0.80, 0.62], [0.88, 0.59], [0.93, 0.68], [0.88, 0.76], [0.81, 0.72]],
            [[0.455, 0.19], [0.47, 0.18], [0.475, 0.24], [0.46, 0.25]]
        ];
        cont.forEach(function (c) { mp += P('M' + c.map(function (p) { return mpt(p[0], p[1]); }).join(' L') + 'Z', '#a9bca6'); });
        mp += S('M734 278 L1008 278', '#fff', 1, 'opacity=".12"') + S('M871 194 L871 362', '#fff', 1, 'opacity=".12"');
        var hub = [0.468, 0.21];
        [[0.20, 0.30], [0.27, 0.22], [0.52, 0.24], [0.55, 0.20], [0.88, 0.70], [0.90, 0.66], [0.53, 0.60], [0.75, 0.30]].forEach(function (p) {
            var a = mpt(hub[0], hub[1]).split(' '), b = mpt(p[0], p[1]).split(' ');
            var mx = (+a[0] + +b[0]) / 2, my = Math.min(+a[1], +b[1]) - 26;
            mp += S('M' + a[0] + ' ' + a[1] + ' Q' + n(mx) + ' ' + n(my) + ' ' + b[0] + ' ' + b[1], '#f1dfae', 1.6, 'opacity=".9"') +
                C(+b[0], +b[1], 4.5, '#e2b022') + C(+b[0] - 1.2, +b[1] - 1.2, 1.4, '#fff3c4');
        });
        mp += C(+mpt(hub[0], hub[1]).split(' ')[0], +mpt(hub[0], hub[1]).split(' ')[1], 6.5, '#d23c2f') + R(726, 186, 290, 6, '#3a3e45');
        lab += hot('collaboration', 'Collaborations', 'World map with pinned threads: collaborations', [720, 180, 1022, 382], mp);

        // treadmill (toy)
        var tm;
        tm = shadow(870, 1016, 175, 12) +
            R(744, 988, 20, 22, '#1e2024', 'rx="3"') + R(976, 988, 20, 22, '#1e2024', 'rx="3"') +
            P('M748 950 L1004 950 Q1014 950 1014 962 L1014 984 Q1014 994 1004 994 L748 994Z', '#2c2f34') +
            R(760, 952, 250, 5, '#45494f') + R(760, 984, 250, 3, '#1f2125') +
            G(G(R(756, 940, 280, 11, U('belt')), 'class="lab-sc-belt"'), 'clip-path="' + U('cBelt') + '"') +
            C(1002, 946, 9, '#3a3e45') + C(1002, 946, 3.5, '#9aa1a8') +
            P('M724 994 L724 930 Q724 912 744 912 L792 912 Q808 912 810 928 L816 994Z', '#3a3e45') + R(730, 926, 72, 6, '#c8372d', 'rx="3"') + R(732, 960, 50, 3, '#4d525a') + R(732, 968, 50, 3, '#4d525a') +
            S('M784 918 L812 690', '#3d4248', 16) + S('M784 918 L812 690', '#6a7079', 5) +
            S('M810 706 L918 710 L924 730', '#5d646c', 9) + S('M806 716 L912 720 L918 740', '#9aa3ac', 9) +
            G(R(752, 628, 128, 60, '#22252a', 'rx="10"') + R(752, 628, 128, 10, '#2e3238', 'rx="6"') + R(764, 640, 70, 30, '#081610', 'rx="3"') +
                T(799, 662, '0.0', 19, '#6cf08a', MID + ' class="lab-sc-mono lab-sc-tmread"') + T(799, 682, 'km/h', 8, '#8d96a0', MID) +
                C(852, 648, 6, '#c8372d') + C(852, 668, 6, '#2f8a57') + R(844, 678, 18, 3, '#4a4f57'),
                'transform="rotate(-8 816 658)"');
        hole(764, 636, 70, 40, 3);
        lab += toy('treadmill', 'Treadmill: start or stop the belt', [716, 626, 1006, 1022], tm);
        // stopwatch hanging on the rail (toy)
        lab += toy('stopwatch', 'Stopwatch: start or stop', [852, 712, 936, 810],
            L(892, 720, 892, 742, '#2f6fb0', 3) + R(887, 740, 10, 8, '#9aa1a8', 'rx="2"') +
            C(892, 770, 23, '#c7ccd1') + C(892, 770, 18, '#f7f7f1') +
            R(909, 748, 7, 7, '#9aa1a8', 'transform="rotate(40 912 751)"') +
            G(L(892, 770, 892, 756, '#c8372d', 2.5), 'class="lab-sc-swhand"') + C(892, 770, 2.5, '#1d1f24'));

        // capability: douglas bags, metabolic cart, mouthpiece, cylinder
        var cp = L(1018, 248, 1206, 248, '#8d96a0', 6) + R(1020, 240, 8, 16, '#5d6166') + R(1196, 240, 8, 16, '#5d6166');
        [1052, 1112, 1172].forEach(function (cx, i) {
            var hgt = i === 1 ? 150 : 128, wd = i === 1 ? 27 : 23, top = 302, bot = top + hgt;
            cp += G(L(cx, 248, cx, 258, '#5d6166', 3) + R(cx - 6, 256, 12, 22, '#3b4048', 'rx="3"') + C(cx, 284, 11, '#2f343b') + C(cx, 284, 5, '#8d96a0') +
                R(cx - 4, 293, 8, 12, '#3b4048') +
                P('M' + (cx - wd + 4) + ' ' + top + ' Q' + (cx - wd - 3) + ' ' + (top + hgt / 2) + ' ' + (cx - wd + 2) + ' ' + bot + ' Q' + cx + ' ' + (bot + 6) + ' ' + (cx + wd - 2) + ' ' + bot +
                    ' Q' + (cx + wd + 3) + ' ' + (top + hgt / 2) + ' ' + (cx + wd - 4) + ' ' + top + ' Q' + cx + ' ' + (top - 5) + ' ' + (cx - wd + 4) + ' ' + top + 'Z', '#b9c4c9') +
                P('M' + (cx - wd + 4) + ' ' + top + ' Q' + (cx - wd - 3) + ' ' + (top + hgt / 2) + ' ' + (cx - wd + 2) + ' ' + bot + ' Q' + cx + ' ' + (bot + 6) + ' ' + (cx + wd - 2) + ' ' + bot +
                    ' Q' + (cx + wd + 3) + ' ' + (top + hgt / 2) + ' ' + (cx + wd - 4) + ' ' + top + ' Q' + cx + ' ' + (top - 5) + ' ' + (cx - wd + 4) + ' ' + top + 'Z', 'none', 'stroke="#7d8a92" stroke-width="3"') +
                S('M' + (cx - 8) + ' ' + (top + 14) + ' Q' + (cx - 14) + ' ' + (top + hgt / 2) + ' ' + (cx - 6) + ' ' + (bot - 14), '#8a979f', 2) +
                S('M' + (cx + 9) + ' ' + (top + 12) + ' Q' + (cx + 5) + ' ' + (top + hgt / 2.2) + ' ' + (cx + 11) + ' ' + (bot - 30), '#eef4f6', 4, 'opacity=".7"') +
                R(cx - 9, bot - 34, 18, 12, '#f4f1e4') + T(cx, bot - 25, String(i + 1), 9, '#333', MID + ' ' + BOLD),
                'class="lab-sc-sway" style="animation-delay:-' + (i * 1.7) + 's"');
        });
        cp += shadow(1130, 1016, 90, 10) +
            R(1062, 698, 7, 304, '#6a7078') + R(1191, 698, 7, 304, '#6a7078') +
            R(1056, 694, 148, 10, '#8a9097', 'rx="2"') + R(1056, 818, 148, 9, '#8a9097', 'rx="2"') + R(1056, 930, 148, 9, '#8a9097', 'rx="2"') +
            C(1066, 1010, 10, '#1e2125') + C(1194, 1010, 10, '#1e2125') + C(1066, 1010, 3.5, '#8d96a0') + C(1194, 1010, 3.5, '#8d96a0') +
            R(1118, 672, 24, 24, '#2a2d33') + R(1100, 690, 60, 6, '#2a2d33', 'rx="2"') +
            R(1068, 566, 124, 108, '#23262b', 'rx="7"') + R(1076, 574, 108, 90, '#06121a', 'rx="2"');
        hole(1076, 574, 108, 90, 2);
        var met = '';
        for (var gy = 590; gy < 664; gy += 18) met += L(1076, gy, 1184, gy, '#1d3a44', 1);
        for (var gx = 1094; gx < 1184; gx += 18) met += L(gx, 574, gx, 664, '#1d3a44', 1);
        function trace(base, amp, seed, col) {
            var r = rng(seed), pts = [], period = 108, i;
            var ys = [];
            for (i = 0; i <= 27; i++) ys.push(base - Math.sin(i / 27 * Math.PI * 2) * amp * 0.4 - (r() - 0.5) * amp);
            ys[27] = ys[0];
            for (var rep = 0; rep < 3; rep++) for (i = 0; i <= 27; i++) pts.push(n(1076 + rep * period + i * 4) + ' ' + n(ys[i]));
            return S('M' + pts.join(' L'), col, 2);
        }
        met += G(trace(612, 14, 21, '#6cf08a') + trace(638, 12, 22, '#ffb347') + trace(652, 6, 23, '#7fd0ff'), 'class="lab-sc-trace"');
        cp += G(met, 'clip-path="' + U('cMet') + '"') +
            R(1080, 577, 18, 4, '#6cf08a') + R(1102, 577, 18, 4, '#ffb347') + R(1124, 577, 18, 4, '#7fd0ff');
        glow += E(1130, 620, 170, 150, U('cool')) + E(1130, 1030, 120, 14, '#8fd3ff', 'opacity=".05" class="lab-sc-floorglow"');
        soft(1130, 640, 190, 170, 0.55);
        cp += R(1068, 756, 124, 62, '#d6d8d2', 'rx="5"') + R(1068, 756, 124, 8, '#e8eae4', 'rx="4"') +
            R(1078, 772, 44, 18, '#10261a') + T(1100, 786, '16.2', 12, '#6cf08a', MID + ' class="lab-sc-mono"') +
            C(1140, 781, 6, '#5d6166') + C(1160, 781, 6, '#5d6166') + C(1178, 781, 3, '#2f8a57') +
            R(1080, 798, 40, 10, '#bfc2bb', 'rx="2"') + R(1134, 798, 46, 10, '#3b4048', 'rx="2"');
        hole(1078, 772, 44, 18);
        cp += R(1070, 878, 116, 52, '#3b4047', 'rx="4"') + R(1078, 888, 50, 4, '#555b63') + R(1078, 898, 50, 4, '#555b63') + C(1172, 892, 3, '#6cf08a');
        cp += R(1206, 770, 20, 234, U('cyl'), 'rx="9"') + R(1209, 752, 14, 22, '#9aa1a8', 'rx="3"') + R(1206, 786, 20, 6, '#e8e4d8') + C(1216, 748, 5, '#5d6166');
        cp += shadow(1032, 1014, 30, 6) + L(1032, 1008, 1032, 724, '#8d96a0', 5) + L(1010, 1010, 1054, 1010, '#4a4f57', 7) +
            L(1032, 728, 1002, 728, '#8d96a0', 4) + R(982, 714, 26, 22, '#3b4048', 'rx="6"') + R(964, 720, 20, 12, '#d6c7a2', 'rx="5"') +
            S('M1000 716 C 1004 640, 1060 630, 1066 700 S 1056 792, 1070 790', '#b6c3cb', 11) +
            S('M1000 716 C 1004 640, 1060 630, 1066 700 S 1056 792, 1070 790', '#7f8d96', 11, 'stroke-dasharray="2 5" stroke-linecap="butt"');
        lab += hot('capability', 'Capability', 'Metabolic cart and Douglas bags: capability', [1008, 230, 1236, 1020], cp);

        // heavy bag (toy)
        lab += R(1250, 56, 30, 12, '#2a2d33', 'rx="2"');
        lab += toy('bag', 'Heavy bag: throw a punch', [1212, 370, 1318, 766],
            G(S('M1265 66 L1265 370', '#9aa1a8', 4, 'stroke-dasharray="7 4" stroke-linecap="butt"') +
                C(1265, 374, 7, 'none', 'stroke="#9aa1a8" stroke-width="3"') +
                S('M1265 378 L1234 420 M1265 378 L1252 416 M1265 378 L1278 416 M1265 378 L1296 420', '#9aa1a8', 2.5, 'stroke-dasharray="5 3" stroke-linecap="butt"') +
                R(1226, 414, 78, 344, U('bag'), 'rx="18"') + R(1229, 410, 72, 16, '#3f1110', 'rx="7"') +
                R(1226, 446, 78, 9, '#4d1513') + R(1226, 718, 78, 9, '#4d1513') +
                L(1250, 460, 1250, 712, '#d9a39a', 1.5, 'stroke-dasharray="5 5" opacity=".45"') +
                R(1282, 436, 8, 300, '#fff', 'opacity=".09" rx="4"') + E(1265, 754, 34, 6, '#3f1110'),
                'class="lab-sc-bagswing"') + G(shadow(1265, 1020, 70, 9), 'class="lab-sc-bagshadow"'));

        // posters + gloves -> applied projects
        var ap = G(R(1336, 206, 74, 114, '#000', 'opacity=".22"') + R(1332, 200, 74, 114, '#1a1c21') + R(1332, 200, 74, 24, '#c8102e') +
            T(1369, 217, 'FIGHT', 12, '#fff', MID + ' ' + BOLD + ' letter-spacing="2"') +
            C(1354, 254, 8, '#e9c46a') + P('M1342 294 Q1344 266 1354 264 Q1366 266 1368 294Z', '#e9c46a') +
            C(1384, 254, 8, '#9fb3c8') + P('M1372 294 Q1374 266 1384 264 Q1394 266 1396 294Z', '#9fb3c8') +
            C(1365, 270, 5, '#c8102e') + C(1373, 270, 5, '#2456a6') +
            R(1340, 298, 58, 5, '#e9c46a') + R(1346, 306, 46, 3, '#888'), 'transform="rotate(-2.5 1369 257)"') +
            G(R(1416, 214, 74, 114, '#000', 'opacity=".22"') + R(1412, 208, 74, 114, '#e8c547') +
                T(1449, 238, 'TITLE', 17, '#16181c', MID + ' ' + BOLD) + T(1449, 256, 'NIGHT', 17, '#16181c', MID + ' ' + BOLD) +
                P('M1449 266 L1454 278 L1467 278 L1457 286 L1461 298 L1449 291 L1437 298 L1441 286 L1431 278 L1444 278Z', '#c8102e') +
                R(1420, 304, 58, 5, '#16181c') + R(1426, 312, 46, 3, '#6b5a1a'), 'transform="rotate(2 1449 265)"');
        ap += C(1456, 466, 5, '#9aa1a8') + S('M1456 468 L1436 500 M1456 468 L1466 512', '#e9e2d0', 2);
        ap += G(R(1422, 498, 28, 18, '#efebe0', 'rx="4"') + P('M1418 514 Q1410 562 1426 584 Q1444 596 1456 578 Q1466 554 1454 514Z', '#b5252a') +
            P('M1418 530 Q1406 540 1414 560 Q1420 566 1424 556Z', '#951c21') + S('M1432 540 Q1440 560 1436 580', '#d9504e', 3, 'opacity=".5"'), '') +
            G(R(1452, 510, 28, 18, '#efebe0', 'rx="4"') + P('M1448 526 Q1440 574 1456 596 Q1474 608 1486 590 Q1496 566 1484 526Z', '#9e1f24') +
                P('M1484 542 Q1496 552 1488 572 Q1482 578 1480 568Z', '#7f171b'), '');
        lab += hot('applied-projects', 'Projects', 'Fight posters and gloves: applied projects', [1322, 192, 1500, 612], ap);

        // bench + laptop -> software
        var r2 = rng(31);
        var sw = shadow(1404, 1014, 90, 9) +
            R(1334, 802, 8, 202, '#5d636b') + R(1468, 802, 8, 202, '#5d636b') + R(1330, 928, 150, 8, '#5d636b') +
            R(1346, 892, 64, 36, '#a37b4c') + R(1346, 892, 64, 6, '#b88d5a') + R(1418, 902, 44, 26, '#2f4a6b') +
            R(1326, 786, 158, 18, '#6b7179', 'rx="2"') + R(1326, 786, 158, 4, '#8a9097') +
            P('M1342 786 L1472 786 L1466 775 L1348 775Z', '#b9bec4') + R(1386, 779, 40, 3, '#9aa0a6') +
            R(1354, 688, 106, 89, '#2a2d33', 'rx="6"') + R(1360, 694, 94, 74, '#0d1520');
        hole(1360, 694, 94, 74);
        for (var cl = 0; cl < 9; cl++) {
            var ind = [0, 8, 16, 16, 8, 0, 8, 16, 8][cl], cxs = 1366 + ind;
            var segs = 1 + Math.floor(r2() * 3);
            for (var sg = 0; sg < segs; sg++) {
                var wl = 8 + r2() * 22;
                if (cxs + wl > 1448) break;
                sw += R(cxs, 700 + cl * 7.4, wl, 3.6, ['#7fd0ff', '#ffb86b', '#b5e48c', '#e6e6e6', '#c792ea'][Math.floor(r2() * 5)], 'rx="1"');
                cxs += wl + 4;
            }
        }
        glow += E(1406, 740, 130, 110, U('cool'));
        soft(1406, 760, 140, 110, 0.45);
        lab += hot('software', 'Software', 'Laptop on the bench: software', [1324, 680, 1486, 1012], sw);

        // ================= 3 ERGOMETER BAY =================
        var erg = '';
        // clock (real time)
        erg += C(1630, 248, 62, '#000', 'opacity=".2"') + C(1626, 244, 62, '#25282d') + C(1626, 244, 54, '#f2eee5');
        for (var tk = 0; tk < 60; tk++) {
            var ta = tk * Math.PI / 30, big = tk % 5 === 0;
            erg += L(1626 + Math.sin(ta) * (big ? 42 : 47), 244 - Math.cos(ta) * (big ? 42 : 47), 1626 + Math.sin(ta) * 50, 244 - Math.cos(ta) * 50, '#2a2d33', big ? 3.5 : 1.2);
        }
        erg += G(L(1626, 252, 1626, 212, '#1d1f24', 6), 'class="lab-sc-hh"') +
            G(L(1626, 254, 1626, 200, '#1d1f24', 4), 'class="lab-sc-mh"') +
            G(L(1626, 258, 1626, 198, '#c8372d', 1.8) + C(1626, 208, 3.5, '#c8372d'), 'class="lab-sc-sh"') +
            C(1626, 244, 5, '#1d1f24');
        // lab environment display (temperature / humidity / pressure)
        erg += R(1706, 206, 104, 66, '#000', 'opacity=".2"') + R(1702, 200, 104, 66, '#2a2d33', 'rx="5"') + R(1710, 208, 88, 50, '#0b0f0c', 'rx="2"') +
            T(1754, 228, '21.4\u00b0C', 15, '#ffb347', MID + ' class="lab-sc-mono"') + T(1754, 248, '46% RH', 11, '#7fd0ff', MID + ' class="lab-sc-mono"');
        hole(1710, 208, 88, 50, 2);
        glow += E(1754, 233, 90, 60, U('amber'), 'opacity=".6"');
        // velodrome poster
        erg += R(1836, 194, 224, 150, '#000', 'opacity=".2"') + R(1830, 188, 224, 150, '#1f2328', 'rx="2"') + R(1838, 196, 208, 134, '#ece5d4') +
            E(1942, 272, 86, 40, 'none', 'stroke="#c99b62" stroke-width="18"') + E(1942, 272, 74, 30, 'none', 'stroke="#2f6fb0" stroke-width="2"') +
            E(1942, 272, 70, 27, 'none', 'stroke="#c8372d" stroke-width="2"') + E(1942, 272, 58, 18, '#7aa26f') +
            C(1880, 292, 4, '#1d1f24') + L(1876, 298, 1888, 296, '#1d1f24', 3) +
            T(1846, 214, 'TRACK', 11, '#2a2d33', BOLD + ' letter-spacing="3"');
        // ergometer + micro + printer -> wingate
        var F = '#dfe2df', D = '#2a2d33';
        var wg = shadow(1665, 1016, 200, 13) + shadow(1970, 1016, 140, 11);
        wg += R(1520, 992, 104, 15, D, 'rx="7"') + R(1684, 992, 136, 15, D, 'rx="7"') +
            S('M1572 994 L1602 862', F, 15) + S('M1602 866 L1748 878', F, 13) + S('M1604 870 L1660 902', F, 12) +
            S('M1750 994 L1748 880', F, 14) + S('M1736 884 L1716 694', F, 12) +
            S('M1602 866 L1594 724', '#b9bdbb', 10) +
            P('M1554 718 Q1590 704 1634 712 L1632 724 Q1594 730 1558 727Z', '#1b1d21') +
            S('M1698 688 L1742 684 Q1774 682 1780 704', '#1b1d21', 9) + C(1722, 740, 13, '#2a2d33') + C(1722, 740, 9, '#f2eee5') + L(1722, 740, 1728, 733, '#c8372d', 1.6);
        var holesFly = '';
        for (var fh = 0; fh < 5; fh++) { var fa = fh * Math.PI * 2 / 5; holesFly += C(1750 + Math.cos(fa) * 44, 880 + Math.sin(fa) * 44, 13, '#0d0e10'); }
        wg += C(1750, 880, 88, '#1b1d21') + C(1750, 880, 84, '#a2abb3') + C(1750, 880, 77, '#c8372d') + C(1750, 880, 62, '#a92d25') +
            G(holesFly + C(1750, 880, 88, 'none'), 'class="lab-sc-fly"') +
            P('M1690 830 A 78 78 0 0 1 1800 822', 'none', 'stroke="#fff" stroke-opacity=".25" stroke-width="5" stroke-linecap="round"') +
            C(1750, 880, 17, '#a2abb3') + C(1750, 880, 6, D);
        wg += S('M1665 852 A 90 90 0 0 1 1836 852', '#c79b3c', 4) + L(1836, 852, 1842, 904, '#c79b3c', 3) +
            R(1826, 904, 34, 7, D) + R(1829, 911, 28, 8, '#565c64') + R(1829, 920, 28, 8, '#6a7079') + R(1829, 929, 28, 8, '#565c64') + L(1843, 937, 1843, 950, D, 3);
        wg += S('M1660 880 L1750 868 M1660 924 L1750 892', '#1b1d21', 3, 'stroke-dasharray="3 2"') + C(1750, 880, 12, '#3a3f46') + C(1660, 902, 22, '#3a3f46') + C(1660, 902, 15, '#555b63') + C(1660, 902, 8, '#9aa1a8') +
            L(1660, 902, 1692, 948, '#9aa1a8', 6) + L(1660, 902, 1628, 856, '#9aa1a8', 6) + R(1680, 946, 28, 8, D, 'rx="2"') + R(1614, 850, 28, 8, D, 'rx="2"');
        wg += S('M1660 926 C 1680 1002, 1780 1004, 1862 1000 S 1866 900, 1870 806', '#1b1d21', 3);
        // trolley
        wg += R(1860, 806, 8, 198, '#565c64') + R(2072, 806, 8, 198, '#565c64') + R(1854, 934, 232, 8, '#5d636b') +
            C(1864, 1010, 8, '#1e2125') + C(2076, 1010, 8, '#1e2125') + R(1850, 792, 240, 14, '#5d636b', 'rx="2"') + R(1850, 792, 240, 3, '#7a8088');
        // printer on the lower shelf
        wg += G(G(R(1898, 838, 114, 50, '#f5f2e8') + R(1898, 838, 8, 50, '#eae5d6') + R(2004, 838, 8, 50, '#eae5d6') +
            C(1902, 846, 1.6, '#bfb8a4') + C(1902, 858, 1.6, '#bfb8a4') + C(1902, 870, 1.6, '#bfb8a4') + C(2008, 846, 1.6, '#bfb8a4') + C(2008, 858, 1.6, '#bfb8a4') + C(2008, 870, 1.6, '#bfb8a4') +
            R(1912, 846, 50, 2.5, '#6f6f6f') + R(1912, 854, 76, 2.5, '#6f6f6f') + R(1912, 862, 34, 2.5, '#6f6f6f') + R(1906, 868, 98, 7, '#d7ead2'),
            'class="lab-sc-feed"'), 'clip-path="' + U('cFeed') + '"') +
            R(1880, 882, 152, 52, '#cbc4b1', 'rx="6"') + R(1880, 882, 152, 8, '#ddd7c6', 'rx="4"') + R(1894, 880, 124, 7, '#34322d', 'rx="2"') +
            C(2038, 902, 9, '#3a3833') + R(1890, 914, 40, 5, '#a8a18e') + C(1990, 914, 2.5, '#6cf08a') + C(2000, 914, 2.5, '#e2b022');
        wg += P('M1906 942 L2004 942 L2010 984 L1912 984Z', '#ece8dc') + R(1906, 942, 98, 4, '#d9d4c5') +
            R(1912, 952, 92, 7, '#d7ead2', 'opacity=".9"') + R(1914, 968, 92, 7, '#d7ead2', 'opacity=".9"') +
            R(1918, 962, 46, 2, '#8a8a8a') + R(1920, 978, 64, 2, '#8a8a8a');
        for (var pf = 0; pf < 5; pf++) {
            var py = 984 + pf * 6, off2 = (pf % 2 ? 6 : 0);
            wg += P('M' + (1902 + off2) + ' ' + py + ' L' + (2018 + off2) + ' ' + py + ' L' + (2022 + off2) + ' ' + (py + 6) + ' L' + (1898 + off2) + ' ' + (py + 6) + 'Z', pf % 2 ? '#e3dfd2' : '#f4f1e8') +
                L(1898 + off2, py + 6, 2022 + off2, py + 6, '#bdb6a4', 1);
        }
        // the micro
        wg += P('M1866 792 L1874 760 L2066 754 L2076 792 Z', '#d8cba5') + R(1874, 754, 192, 8, '#e7ddbf', 'rx="2"') +
            R(1866, 786, 210, 6, '#b8aa84') + R(1888, 765, 132, 20, '#3a342c', 'rx="2"');
        for (var kr = 0; kr < 3; kr++) for (var kc = 0; kc < 13; kc++) wg += R(1891 + kc * 10 + (kr % 2) * 3, 767 + kr * 6, 7.5, 4.2, '#ebe3cb', 'rx=".8"');
        for (var fk = 0; fk < 10; fk++) wg += R(1891 + fk * 12.9, 758.5, 10.5, 4.4, '#cf3b2c', 'rx=".8"');
        wg += R(2028, 765, 36, 20, '#3a342c', 'rx="2"') + R(2031, 768, 8, 6, '#ebe3cb') + R(2042, 768, 8, 6, '#ebe3cb') + R(2053, 768, 8, 6, '#ebe3cb') + R(2031, 777, 30, 5, '#ebe3cb') +
            C(2058, 760, 1.8, '#ff5a3c');
        // the monitor
        wg += R(1912, 744, 116, 12, '#b5a981', 'rx="3"') + R(1886, 578, 168, 170, '#cbbf9b', 'rx="12"') + R(2036, 584, 14, 160, '#b4a881', 'rx="6"') +
            R(1898, 590, 144, 126, '#2a2620', 'rx="9"') + R(1908, 600, 124, 106, U('crt'), 'rx="12"');
        hole(1908, 600, 124, 106, 12);
        var crt = T(1916, 616, 'WINGATE  30 s', 9.5, '#7cf59a', 'class="lab-sc-mono"') + L(1916, 690, 2024, 690, '#2f7a3f', 1);
        [62, 68, 66, 60, 55, 50, 45, 41, 37, 34].forEach(function (h, i) {
            crt += R(1918 + i * 10.6, 690 - h, 8, h, '#6cf08a', 'class="lab-sc-bar" style="transition-delay:' + (i * 0.11).toFixed(2) + 's"');
        });
        crt += T(1916, 701, '&gt;RUN', 8, '#7cf59a', 'class="lab-sc-mono"') + R(1945, 694, 6, 8, '#7cf59a', 'class="lab-sc-cursor"') +
            R(1908, 600, 124, 106, U('scan'));
        wg += G(crt, 'clip-path="' + U('cCrt') + '"') + P('M1916 606 Q1970 600 2024 606 L2020 620 Q1970 612 1920 620Z', '#fff', 'opacity=".06"') +
            C(1912, 732, 3, '#e2412e') + C(2010, 732, 5, '#8f8566') + C(2024, 732, 5, '#8f8566') + R(1936, 728, 50, 3, '#a89c78') + R(1936, 734, 50, 3, '#a89c78');
        glow += E(1970, 660, 190, 160, U('green')) + E(1970, 1030, 150, 14, '#6cf08a', 'opacity=".05" class="lab-sc-floorglow"');
        soft(1970, 690, 220, 190, 0.6);
        erg += hot('wingate', 'Wingate test', 'Cycle ergometer, home computer and printer: the Wingate test', [1506, 572, 2094, 1022], wg);

        // ================= 4 OFFICE =================
        var off = '';
        // certificates -> education
        var ed = R(2132, 242, 136, 96, '#000', 'opacity=".2"') + R(2126, 236, 136, 96, '#22252a') + R(2134, 244, 120, 80, '#f3eee2') +
            R(2154, 256, 80, 6, '#6b5a3b') + R(2148, 272, 92, 3, '#9a9080') + R(2152, 280, 84, 3, '#9a9080') + R(2160, 288, 68, 3, '#9a9080') +
            C(2230, 306, 10, '#b8892e') + P('M2224 312 L2220 324 L2226 320 L2230 326 L2232 314Z', '#b8892e') + R(2148, 306, 50, 2, '#6b5a3b');
        ed += R(2140, 352, 116, 88, '#000', 'opacity=".2"') + R(2134, 346, 116, 88, '#6e4c30') + R(2142, 354, 100, 72, '#f6f2e8') +
            C(2192, 372, 9, '#2c4a7a') + R(2158, 388, 68, 4, '#2c4a7a') + R(2164, 398, 56, 3, '#9a9080') + R(2168, 406, 48, 3, '#9a9080');
        ed += R(2146, 456, 104, 76, '#000', 'opacity=".2"') + R(2140, 450, 104, 76, '#22252a') + R(2147, 457, 90, 62, '#efe9da') +
            R(2160, 468, 64, 5, '#3c3c3c') + R(2158, 480, 68, 3, '#9a9080') + R(2162, 488, 60, 3, '#9a9080') + C(2218, 504, 8, '#a8322d');
        off += hot('education', 'Education', 'Framed certificates: education', [2120, 228, 2272, 536], ed);
        // window (blind is a toy)
        off += R(2286, 196, 308, 456, '#d4cfc3', 'rx="3"') + R(2296, 206, 288, 436, '#9c968a') + R(2306, 216, 268, 416, U('sky'));
        hole(2306, 216, 268, 416);
        var r3 = rng(41), ow = '';
        for (var st = 0; st < 22; st++) ow += C(2310 + r3() * 260, 222 + r3() * 160, 0.8 + r3() * 1.1, '#fff', 'opacity="' + (0.3 + r3() * 0.5).toFixed(2) + '"');
        ow += P('M2306 530 Q2350 488 2402 506 T2500 486 T2574 498 L2574 632 L2306 632Z', '#2a3458');
        var bx = 2300;
        while (bx < 2580) {
            var bw = 22 + r3() * 34, bh = 40 + r3() * 70, by = 632 - bh;
            ow += R(bx, by, bw, bh + 2, '#141a2e');
            for (var wy2 = by + 8; wy2 < 624; wy2 += 11) for (var wx2 = bx + 5; wx2 < bx + bw - 6; wx2 += 9) {
                if (r3() < 0.22) ow += R(wx2, wy2, 4, 5, r3() < 0.7 ? '#ffd27a' : '#bfe0ff', 'opacity="' + (0.6 + r3() * 0.4).toFixed(2) + '"');
            }
            bx += bw + 2 + r3() * 8;
        }
        ow += C(2340, 600, 2.4, '#ffb45c') + C(2470, 606, 2.4, '#ffb45c') + C(2540, 598, 2.4, '#ffb45c');
        function rainTile(seed, cnt, len, op, wd) {
            var r = rng(seed), d = '';
            for (var k = 0; k < cnt; k++) {
                var rx = 2300 + r() * 290, ry = 216 + r() * 416, l = len * (0.6 + r() * 0.8);
                d += 'M' + n(rx) + ' ' + n(ry) + 'l' + n(-l * 0.18) + ' ' + n(l);
            }
            return S(d, '#c7d8f5', wd, 'opacity="' + op + '"');
        }
        ow += G(G(rainTile(51, 46, 26, 0.5, 1.4), 'transform="translate(0 -416)"') + rainTile(51, 46, 26, 0.5, 1.4), 'class="lab-sc-rain"') +
            G(G(rainTile(52, 34, 16, 0.3, 1), 'transform="translate(0 -416)"') + rainTile(52, 34, 16, 0.3, 1), 'class="lab-sc-rain lab-sc-rain2"');
        var r4 = rng(43);
        for (var dr = 0; dr < 26; dr++) ow += E(2312 + r4() * 256, 230 + r4() * 390, 1.6 + r4() * 1.6, 2 + r4() * 2.2, '#dfeaff', 'opacity=".38"');
        ow += P('M2306 216 L2380 216 L2306 330Z', '#fff', 'opacity=".05"') + P('M2470 216 L2500 216 L2306 520 L2306 470Z', '#fff', 'opacity=".04"');
        off += G(ow, 'clip-path="' + U('cGlass') + '"');
        off += R(2436, 216, 8, 416, '#d4cfc3') + R(2306, 420, 268, 8, '#d4cfc3') + R(2430, 430, 20, 8, '#b2ac9f', 'rx="2"');
        covers.push(R(2436, 216, 8, 416, '#fff') + R(2306, 420, 268, 8, '#fff'));
        off += R(2278, 640, 324, 16, '#e3ded2', 'rx="2"') + R(2286, 656, 308, 6, '#000', 'opacity=".22"');
        glow += E(2440, 430, 300, 330, U('dusk'));
        soft(2440, 430, 260, 320, 0.4);
        off += toy('blind', 'Window blind: raise or lower', [2286, 190, 2594, 650],
            R(2294, 198, 292, 16, '#cfc7b6', 'rx="5"') + R(2294, 198, 292, 4, '#e2dccd', 'rx="2"') +
            R(2302, 214, 276, 96, U('slat'), 'class="lab-sc-blindpanel"') +
            R(2300, 306, 280, 7, '#b8af9c', 'rx="3" class="lab-sc-blindbar"') +
            L(2566, 214, 2566, 352, '#9a937f', 1.5, 'class="lab-sc-cord"') + C(2566, 352, 4, '#9a937f', 'class="lab-sc-bead"'));
        // pegboard -> skills
        var sk = R(2618, 224, 156, 336, '#000', 'opacity=".2"') + R(2612, 218, 156, 336, U('peg')) + R(2612, 218, 156, 336, 'none', 'stroke="#9c7d55" stroke-width="3"');
        sk += L(2650, 236, 2650, 246, '#5d6166', 3) + C(2650, 272, 25, '#c9ced3') + C(2650, 272, 19, '#f7f7f1') + R(2645, 242, 10, 8, '#9aa1a8') +
            L(2650, 272, 2660, 260, '#1d1f24', 2) + C(2650, 272, 2, '#1d1f24') + R(2668, 246, 7, 6, '#c8372d', 'transform="rotate(40 2671 249)"');
        sk += L(2740, 228, 2740, 238, '#5d6166', 3) + R(2735, 236, 11, 190, '#c5cbd0', 'rx="1"') + R(2746, 236, 26, 10, '#b3b9bf') + R(2746, 258, 20, 8, '#b3b9bf') +
            R(2733, 280, 15, 24, '#9aa1a8', 'rx="2"');
        for (var vt = 0; vt < 14; vt++) sk += L(2735, 310 + vt * 8, 2740, 310 + vt * 8, '#5d6166', 1);
        sk += L(2664, 330, 2664, 340, '#5d6166', 3) + C(2664, 360, 18, '#e8e0c4') + C(2664, 360, 13, '#fbf8ee') + L(2664, 360, 2672, 352, '#c8372d', 1.6) +
            S('M2654 374 L2640 462', '#c5cbd0', 6) + S('M2674 374 L2690 462', '#c5cbd0', 6) + S('M2640 462 L2648 468', '#c5cbd0', 4) + S('M2690 462 L2682 468', '#c5cbd0', 4) +
            R(2650, 378, 28, 10, '#e2b022', 'rx="3"');
        sk += L(2712, 444, 2712, 452, '#5d6166', 3) + C(2716, 480, 24, '#e2b022') + C(2716, 480, 9, '#2a2d33') + R(2738, 492, 16, 8, '#f2e5a8') + R(2690, 474, 6, 12, '#2a2d33');
        sk += L(2650, 486, 2650, 494, '#5d6166', 3) + S('M2626 534 Q2650 498 2682 534', '#1d1f24', 4) + R(2640, 508, 22, 12, '#3a3f46', 'rx="4"') + C(2651, 514, 2, '#6cf08a');
        off += hot('skills', 'Skills', 'Pegboard of instruments: skills', [2606, 212, 2776, 566], sk);
        // filing cabinet -> experience
        var ex = shadow(2176, 1012, 80, 9) +
            R(2124, 560, 40, 46, '#2f4a6b', 'rx="2"') + C(2144, 582, 6, '#1e3047') + R(2168, 568, 44, 38, '#8a2f2b', 'rx="2"') + C(2190, 588, 5, '#5e1f1c') +
            R(2112, 604, 128, 398, '#6e7c86', 'rx="3"') + R(2228, 604, 12, 398, '#5a6670') + R(2108, 598, 136, 10, '#82909a', 'rx="2"');
        for (var dw = 0; dw < 4; dw++) {
            var dy = 616 + dw * 96;
            ex += R(2120, dy, 104, 88, '#7a8892', 'rx="2"') + R(2120, dy + 84, 104, 4, '#5c6871') +
                R(2150, dy + 14, 44, 18, '#c5cbd0', 'rx="2"') + R(2154, dy + 17, 36, 12, '#f3efe4') + R(2158, dy + 21, 22, 2.5, '#6b6b6b') + R(2158, dy + 25, 14, 2, '#9a9a9a') +
                R(2146, dy + 44, 52, 9, '#c7ccd1', 'rx="4"') + R(2146, dy + 49, 52, 4, '#9aa1a8', 'rx="2"');
        }
        ex += R(2112, 1000, 128, 6, '#2f3439');
        off += hot('experience', 'Experience', 'Filing cabinet: experience', [2104, 552, 2246, 1014], ex);
        // desk
        off += shadow(2455, 1014, 230, 12) +
            R(2262, 768, 386, 150, '#3f2a1b') + R(2262, 768, 112, 234, '#654428') + R(2272, 784, 92, 64, '#6f4b2d', 'rx="2"') + R(2272, 856, 92, 64, '#6f4b2d', 'rx="2"') + R(2272, 928, 92, 64, '#6f4b2d', 'rx="2"') +
            R(2304, 808, 28, 6, '#c9a46a', 'rx="3"') + R(2304, 880, 28, 6, '#c9a46a', 'rx="3"') + R(2304, 952, 28, 6, '#c9a46a', 'rx="3"') +
            R(2624, 768, 24, 234, '#654428') + R(2250, 752, 410, 18, '#7b5535', 'rx="2"') + R(2250, 752, 410, 4, '#a0724a', 'rx="2"');
        off += G(R(2440, 742, 82, 9, '#f4f0e6') + R(2446, 735, 78, 8, '#e9e3d4') + R(2452, 739, 50, 1.5, '#9a9a9a'), 'transform="rotate(-2 2480 745)"') +
            L(2530, 748, 2560, 742, '#2456a6', 3);
        // squash racket leaning on the desk
        off += shadow(2672, 1010, 26, 5) + S('M2668 1004 L2694 836', '#1d1f24', 9) + S('M2668 1004 L2680 926', '#c9c2b0', 10) +
            G(E(0, 0, 32, 44, '#000', 'fill-opacity=".05" stroke="#25466b" stroke-width="7"') +
                S('M-24 -24 L24 -24 M-30 -10 L30 -10 M-30 4 L30 4 M-26 18 L26 18 M-16 32 L16 32 M-16 -38 L-16 38 M0 -44 L0 44 M16 -38 L16 38', '#d8d2c0', 1, 'opacity=".7"'),
                'transform="translate(2708 794) rotate(10)"');
        // lamp (toy)
        off += toy('lamp', 'Desk lamp: switch on or off', [2412, 562, 2632, 762],
            E(2592, 750, 34, 7, '#1d1f24') + R(2566, 738, 52, 12, '#2a2d33', 'rx="4"') +
            S('M2592 740 L2614 618', '#2a2d33', 6) + S('M2600 736 L2620 626', '#5d6166', 1.5, 'stroke-dasharray="3 2"') +
            C(2614, 616, 7, '#3a3f46') + S('M2614 616 L2494 590', '#2a2d33', 6) + S('M2604 606 L2500 584', '#5d6166', 1.5, 'stroke-dasharray="3 2"') +
            G(C(2492, 588, 8, '#3a3f46') + P('M2476 582 L2506 590 L2520 642 L2428 642Z', '#3b6b5a') + P('M2476 582 L2490 586 L2470 642 L2440 642Z', '#4f8a74', 'opacity=".6"') +
                E(2474, 642, 46, 8, '#ffefc4', 'class="lab-sc-bulb"'), 'class="lab-sc-lamphead"'));
        lampHoles.push(E(2474, 642, 46, 8, '#000'));
        glow += G(P('M2430 644 L2518 644 L2610 754 L2350 754Z', U('beam')) +
            E(2480, 600, 430, 380, U('warm')) + E(2480, 756, 170, 16, '#ffe6b0', 'opacity=".45"') + E(2470, 1070, 320, 60, U('warm'), 'opacity=".7"'),
            'class="lab-sc-lampglow"');
        glow += G(G(E(0, 0, 4, 2.6, '#d9cbb0') + G(E(-3, -1, 4.5, 2.6, '#efe4cc', 'opacity=".85"') + E(3, -1, 4.5, 2.6, '#efe4cc', 'opacity=".85"'), 'class="lab-sc-wings"'),
            'class="lab-sc-mothpath"'), 'class="lab-sc-moth" transform="translate(2474 600)"');
        // mug (toy)
        off += toy('mug', 'Coffee mug: take a sip', [2282, 664, 2354, 762],
            G(S('M2310 704 q-6 -10 0 -18 t0 -18', '#e8e2d6', 2.5, 'opacity=".5"') + S('M2322 706 q6 -10 0 -18 t0 -16', '#e8e2d6', 2.5, 'opacity=".4"'), 'class="lab-sc-steam"') +
            G(R(2298, 712, 36, 41, '#2f6f8f', 'rx="4"') + R(2298, 712, 36, 5, '#3f86aa', 'rx="2"') + S('M2334 722 q14 0 14 12 t-14 12', '#2f6f8f', 5) +
                R(2304, 726, 14, 14, '#f2efe6', 'rx="2"'), 'class="lab-sc-mugbody"'));
        // lactate analyser (toy)
        off += toy('lactate', 'Lactate analyser: take a reading', [2356, 676, 2438, 764],
            R(2372, 722, 46, 31, '#e8e6dc', 'rx="6"') + R(2372, 722, 46, 6, '#f6f4ec', 'rx="4"') + R(2378, 728, 34, 14, '#0f1d17', 'rx="2"') +
            T(2395, 739, '- -', 10, '#6cf08a', MID + ' class="lab-sc-mono lab-sc-lacread"') + C(2386, 747, 2.4, '#c8372d') + C(2396, 747, 2.4, '#5d6166') +
            R(2392, 712, 8, 12, '#d6d2c2') + R(2394, 704, 4, 9, '#f2f0ea'));
        hole(2378, 728, 34, 14, 2);

        // ================= 5 PRINT ROOM =================
        var prn = '';
        var r5 = rng(61);
        var pb = shadow(2905, 1012, 120, 10) +
            R(2812, 232, 186, 770, '#30251c') + R(2800, 226, 12, 776, '#5a4330') + R(2998, 226, 12, 776, '#5a4330') + R(2794, 218, 222, 12, '#6b5039', 'rx="2"');
        var spineCols = ['#2f5d8a', '#b5432d', '#e0b13c', '#3c7d5a', '#ece6d6', '#6b4e8a', '#1f2a36', '#c9a46a', '#8c2f39', '#4f7fb6'];
        [[232, 376], [386, 526], [536, 676], [686, 826], [836, 988]].forEach(function (bay, bi) {
            var x = 2816, bottom = bay[1];
            while (x < 2992) {
                var kind = r5();
                if (kind < 0.18 && x < 2950) {
                    var bwf = 36, bhf = Math.min(112, bottom - bay[0] - 14), cf = ['#2e3f55', '#8a2f2b', '#3d5a45', '#5b4a3a'][Math.floor(r5() * 4)];
                    pb += R(x, bottom - bhf, bwf, bhf, cf) + C(x + bwf / 2, bottom - bhf * 0.32, 5, '#000', 'opacity=".45"') + R(x + 6, bottom - bhf + 10, bwf - 12, 18, '#ede6d2');
                    x += bwf + 2;
                } else if (kind < 0.24 && x > 2840) {
                    var jc2 = ['#2f5d8a', '#8c2f39', '#3c7d5a', '#c9a46a'][Math.floor(r5() * 4)];
                    for (var js = 0; js < 7; js++) {
                        var jo = (r5() - 0.5) * 5;
                        pb += R(x + 2 + jo, bottom - 8 - js * 8, 56, 8, js % 3 === 1 ? '#e9e3d3' : jc2) + R(x + 2 + jo, bottom - 8 - js * 8, 56, 1.5, '#000', 'opacity=".25"');
                    }
                    x += 64;
                } else {
                    var jw = 9 + r5() * 9, jh = Math.min(bottom - bay[0] - 8, 74 + r5() * 50), jc = spineCols[Math.floor(r5() * spineCols.length)];
                    if (x + jw > 2994) break;
                    pb += R(x, bottom - jh, jw, jh, jc) + R(x + 2, bottom - jh + 10, jw - 4, 3, '#000', 'opacity=".25"') + R(x + 2, bottom - 18, jw - 4, 2, '#fff', 'opacity=".35"');
                    x += jw + 0.8;
                }
            }
            if (bi < 4) pb += R(2812, bay[1], 186, 10, '#6b5039');
        });
        pb += R(2800, 988, 210, 16, '#4a3627');
        pb += shadow(3110, 1014, 100, 10) +
            R(3028, 804, 164, 196, '#d4d6d1', 'rx="6"') + R(3176, 806, 16, 192, '#b9bcb6', 'rx="4"') + R(3022, 790, 174, 18, '#a7aba5', 'rx="4"') +
            R(3040, 768, 64, 22, '#f1eee6') + R(3040, 775, 64, 8, '#4f7fb6') + R(3108, 772, 74, 20, '#3a3f45', 'rx="3"') + R(3114, 776, 28, 11, '#7fd0ff', 'rx="1"') +
            C(3154, 782, 3, '#6cf08a') + C(3166, 782, 3, '#e2b022') +
            L(3036, 870, 3176, 870, '#a9ada7', 2) + L(3036, 930, 3176, 930, '#a9ada7', 2) + R(3086, 880, 48, 8, '#9aa0a6', 'rx="4"') + R(3086, 940, 48, 8, '#9aa0a6', 'rx="4"') +
            R(3000, 846, 30, 6, '#b9bcb6') + R(2996, 836, 34, 10, '#f6f4ee') + R(2998, 832, 30, 4, '#ebe7dc') +
            C(3040, 1004, 6, '#1e2125') + C(3180, 1004, 6, '#1e2125');
        hole(3114, 776, 28, 11, 1);
        prn += hot('publications', 'Publications', 'Journal shelf and photocopier: publications', [2790, 210, 3198, 1016], pb);
        glow += E(3128, 790, 70, 40, U('cool'));
        // year planner on the wall
        var pl = R(3046, 306, 254, 170, '#000', 'opacity=".18"') + R(3040, 300, 254, 170, '#f4f2ea') + R(3040, 300, 254, 20, '#2f5d8a') +
            T(3050, 315, 'YEAR PLANNER', 11, '#fff', BOLD + ' letter-spacing="2"');
        var r6 = rng(77);
        for (var pr = 0; pr < 12; pr++) {
            pl += L(3040, 326 + pr * 12, 3294, 326 + pr * 12, '#d6d2c6', 1);
            for (var pc = 0; pc < 3; pc++) if (r6() < 0.5) {
                var x0 = 3062 + r6() * 200;
                pl += R(x0, 328 + pr * 12, 14 + r6() * 40, 8, ['#e2b022', '#c2410c', '#2f8a57', '#2f6fb0', '#c8372d'][Math.floor(r6() * 5)], 'opacity=".85" rx="2"');
            }
        }
        pl += L(3060, 326, 3060, 470, '#d6d2c6', 1) + R(3040, 300, 254, 170, 'none', 'stroke="#c9c4b6" stroke-width="2"');
        prn += pl;
        // grants safe
        var gr = shadow(3258, 1012, 70, 8) +
            R(3204, 864, 112, 138, '#2f3c35', 'rx="6"') + R(3214, 874, 92, 118, '#3a4a41', 'rx="4"') + R(3304, 874, 4, 118, '#25302a') +
            C(3250, 928, 18, '#c7ccd1') + C(3250, 928, 12, '#2a2d33') + L(3250, 928, 3250, 918, '#c7ccd1', 2) +
            L(3284, 916, 3284, 944, '#c7ccd1', 6) + R(3208, 888, 6, 14, '#1d1f24') + R(3208, 960, 6, 14, '#1d1f24') +
            G(R(3296, 872, 16, 26, '#f1ecdc') + R(3300, 878, 8, 2, '#8a8a8a'), 'transform="rotate(14 3304 885)"') +
            R(3210, 1000, 14, 8, '#1d1f24') + R(3296, 1000, 14, 8, '#1d1f24');
        gr += R(3208, 848, 104, 18, '#6e4c30', 'rx="2"') + R(3214, 826, 46, 26, '#f3eee2', 'transform="rotate(-4 3236 839)"') + R(3240, 822, 54, 28, '#e8dfc9', 'transform="rotate(3 3266 836)"') +
            C(3270, 838, 6, '#a8322d') + R(3208, 848, 104, 5, '#8a6440');
        prn += hot('grants', 'Grants', 'Award letters and the safe: grants', [3198, 812, 3320, 1016], gr);
        // football (toy)
        prn += toy('ball', 'Football: give it a bounce', [3108, 938, 3196, 1024],
            G(shadow(3152, 1016, 34, 6), 'class="lab-sc-ballshadow"') +
            G(G(C(0, 0, 30, U('ball')) + P('M0 -10 L9.5 -3 L6 8 L-6 8 L-9.5 -3Z', '#1d1f24') +
                P('M0 -30 L7 -26 L0 -20 L-7 -26Z', '#1d1f24') + P('M28 -9 L30 2 L22 4 L20 -5Z', '#1d1f24') + P('M-28 -9 L-30 2 L-22 4 L-20 -5Z', '#1d1f24') +
                P('M18 24 L10 29 L6 21 L13 16Z', '#1d1f24') + P('M-18 24 L-10 29 L-6 21 L-13 16Z', '#1d1f24') +
                S('M0 -10 L0 -20 M9.5 -3 L20 -5 M6 8 L13 16 M-6 8 L-13 16 M-9.5 -3 L-20 -5', '#6d6d6d', 1.2), 'class="lab-sc-ballspin"'),
                'class="lab-sc-ball" transform="translate(3152 986)"'));

        // ================= 6 SEMINAR ROOM =================
        var sem = '';
        // projector screen + lectern -> talks
        var tk2 = R(3340, 126, 292, 22, '#24272c', 'rx="7"') + R(3352, 148, 268, 268, U('slide')) +
            R(3370, 170, 176, 15, '#1f2a44') + R(3370, 194, 112, 8, '#8a93a6') +
            L(3380, 384, 3600, 384, '#5b6475', 2) + L(3380, 228, 3380, 384, '#5b6475', 2) +
            S('M3382 370 C3424 370 3440 262 3500 250 S 3580 242 3602 242', '#2f6fb0', 4) +
            S('M3382 376 C3440 376 3470 320 3530 306 S 3584 300 3602 300', '#c2410c', 3, 'stroke-dasharray="7 5"') +
            R(3540, 324, 54, 4, '#8a93a6') + R(3540, 334, 40, 4, '#8a93a6') +
            R(3350, 408, 272, 9, '#24272c', 'rx="3"') + L(3486, 417, 3486, 452, '#5d6166', 1.5) + C(3486, 456, 4, 'none', 'stroke="#5d6166" stroke-width="2"');
        hole(3352, 148, 268, 268);
        glow += E(3486, 282, 300, 250, U('white'));
        soft(3486, 300, 330, 300, 0.6);
        tk2 += shadow(3606, 1012, 70, 8) + P('M3548 738 L3662 726 L3666 746 L3552 758Z', '#5a3c26') +
            P('M3562 756 L3654 746 L3646 1000 L3570 1000Z', '#6e4a2f') + P('M3578 776 L3640 770 L3634 980 L3584 980Z', '#7d5636') +
            R(3554, 996, 108, 10, '#3e2a1b', 'rx="2"') + S('M3640 736 Q3652 700 3626 682', '#2a2d33', 4) + E(3622, 680, 7, 5, '#3a3f46') +
            R(3586, 722, 44, 6, '#f2efe6', 'transform="rotate(-6 3608 725)"');
        sem += hot('talks', 'Talks', 'Projector screen and lectern: talks', [3334, 118, 3672, 1012], tk2);
        // bound theses -> phds
        var ph = shadow(3742, 1012, 80, 9) +
            R(3670, 716, 144, 288, '#5d4430') + R(3680, 728, 124, 262, '#271d15') + R(3666, 710, 152, 10, '#6b5039', 'rx="2"') + R(3680, 856, 124, 9, '#5d4430');
        ['#1f3a5f', '#7a1f2b', '#2f5d3a', '#1d1d1f', '#5a2a6e', '#8a5a1a', '#1f4f6f', '#7a1f2b'].forEach(function (c, i) {
            var hgt = 108 + (i % 3) * 5, x = 3686 + i * 14.6;
            ph += R(x, 856 - hgt, 13, hgt, c) + R(x + 3, 856 - hgt + 12, 7, 2.2, '#d4b06a') + R(x + 3, 856 - hgt + 18, 7, 1.6, '#d4b06a') + R(x + 3, 840, 7, 2, '#d4b06a');
        });
        ph += R(3690, 900, 36, 90, '#2e3f55') + C(3708, 960, 5, '#000', 'opacity=".4"') + R(3730, 912, 36, 78, '#3d5a45') + C(3748, 966, 5, '#000', 'opacity=".4"') +
            G(R(3772, 896, 14, 94, '#7a1f2b') + R(3788, 896, 12, 94, '#1f3a5f'), 'transform="rotate(-8 3786 990)"');
        ph += P('M3704 698 L3746 688 L3790 698 L3746 708Z', '#1d1d1f') + R(3728, 702, 36, 12, '#26262a', 'rx="3"') + C(3746, 698, 2.5, '#e2b022') +
            S('M3746 698 L3780 700 L3782 722', '#e2b022', 2) + R(3779, 720, 6, 10, '#e2b022', 'rx="2"');
        sem += hot('phds', 'PhDs', 'Shelf of bound doctoral theses: PhDs', [3662, 684, 3820, 1012], ph);
        // running spikes on a hook (decor)
        sem += C(3744, 500, 5, '#9aa1a8') + S('M3744 502 L3728 548 M3744 502 L3760 552', '#f2efe6', 2) +
            spike(3728, 548, '#2aa3c7', 70) + spike(3760, 552, '#1f8fb3', 58);
        function spike(x, y, col, rot) {
            // a running spike seen side-on, hung from the hook by its heel loop
            return G(P('M0 30 L0 12 Q2 2 14 2 L30 4 Q42 10 56 14 L80 20 Q93 24 90 32Z', col) +
                P('M0 30 L90 32 L88 39 L2 37Z', '#f6f3ea') + P('M44 38 L88 39 L86 44 L46 42Z', '#f2672e') +
                P('M52 42 l3 7 l3 -7 M64 43 l3 7 l3 -7 M76 43 l3 7 l3 -7', '#c7ccd1') +
                S('M10 22 Q34 10 62 26', '#f6f3ea', 3) + S('M30 8 L36 14 M38 10 L44 16', '#1d1f24', 2, 'opacity=".5"'),
                'transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"');
        }
        // media: on-air sign, TV, mic on a boom
        var md = R(3844, 324, 100, 34, '#2a1214', 'rx="5"') + T(3894, 348, 'ON AIR', 17, '#ff5a52', MID + ' ' + BOLD + ' letter-spacing="2"');
        hole(3844, 324, 100, 34, 5);
        glow += E(3894, 340, 110, 60, U('red'));
        md += R(3894, 288, 16, 26, '#2a2d33') + R(3824, 194, 156, 96, '#14161a', 'rx="5"') + R(3830, 200, 144, 82, '#21416b');
        hole(3830, 200, 144, 82);
        md += R(3830, 200, 144, 82, '#2b5a8f', 'opacity=".5"') + R(3910, 210, 54, 34, '#3b74b0', 'opacity=".7"') +
            C(3878, 228, 9, '#0e1a2e') + P('M3858 256 Q3860 238 3878 236 Q3896 238 3898 256Z', '#0e1a2e') +
            R(3834, 204, 24, 9, '#c1121f') + T(3846, 211, 'LIVE', 6.5, '#fff', MID + ' ' + BOLD) +
            R(3830, 254, 144, 16, '#c1121f') + R(3836, 258, 70, 5, '#fff') + R(3836, 265, 46, 2.5, '#ffd6d6') + R(3830, 270, 144, 12, '#0b0f1a') +
            G(G(R(3834, 273, 30, 4, '#cfd6e6') + R(3870, 273, 20, 4, '#cfd6e6') + R(3896, 273, 34, 4, '#cfd6e6') + R(3936, 273, 24, 4, '#cfd6e6') +
                R(3974, 273, 30, 4, '#cfd6e6') + R(4010, 273, 20, 4, '#cfd6e6') + R(4036, 273, 34, 4, '#cfd6e6') + R(4076, 273, 24, 4, '#cfd6e6'), 'class="lab-sc-ticker"'),
                'clip-path="' + U('cTicker') + '"');
        glow += E(3902, 242, 170, 120, U('cool'));
        soft(3900, 280, 170, 150, 0.5);
        md += shadow(3912, 1012, 44, 6) + L(3912, 1004, 3882, 1012, '#2a2d33', 4) + L(3912, 1004, 3944, 1012, '#2a2d33', 4) + L(3912, 1004, 3912, 640, '#2a2d33', 5) +
            S('M3912 640 L3860 578', '#2a2d33', 5) + L(3912, 640, 3930, 662, '#2a2d33', 5) + C(3932, 664, 7, '#3a3f46') +
            C(3856, 572, 15, 'none', 'stroke="#5d6166" stroke-width="2"') + R(3848, 552, 16, 36, '#3a3f46', 'rx="8"') + R(3850, 556, 12, 14, '#5d6166', 'rx="6"') +
            C(3832, 584, 17, '#000', 'opacity=".25"') + C(3832, 584, 17, 'none', 'stroke="#5d6166" stroke-width="2"') +
            S('M3856 590 Q3884 640 3910 660', '#1d1f24', 2);
        sem += hot('media', 'Media', 'Television, on-air light and microphone: media', [3818, 186, 3986, 1016], md);

        // ================= 7 FRONT DESK =================
        var dk = '';
        // sign hanging over the counter
        dk += L(4130, 56, 4130, 214, '#3a3d42', 2) + L(4250, 56, 4250, 214, '#3a3d42', 2) +
            R(4100, 212, 180, 52, '#2a2d33', 'rx="6"') + R(4106, 218, 168, 40, '#f6efdc', 'rx="3"') +
            T(4190, 245, 'FRONT DESK', 19, '#1f3a46', MID + ' ' + BOLD + ' letter-spacing="3"');
        hole(4106, 218, 168, 40, 3);
        glow += E(4190, 240, 170, 80, U('warm'), 'opacity=".6"');
        soft(4190, 330, 260, 260, 0.35);
        // wall phone -> contact
        var ct = R(4154, 424, 92, 150, '#000', 'opacity=".2"') + R(4150, 420, 92, 150, '#e3dccb', 'rx="10"') + R(4180, 438, 50, 16, '#2a2d33', 'rx="2"') +
            R(4184, 442, 26, 8, '#7fd0ff', 'opacity=".55"');
        for (var kr2 = 0; kr2 < 4; kr2++) for (var kc2 = 0; kc2 < 3; kc2++) ct += R(4184 + kc2 * 16, 466 + kr2 * 18, 12, 12, '#cbc3ae', 'rx="2"');
        ct += R(4136, 426, 30, 140, '#d4ccb7', 'rx="13"') + R(4132, 426, 36, 30, '#cbc3ae', 'rx="12"') + R(4132, 536, 36, 30, '#cbc3ae', 'rx="12"') +
            S('M4150 566 q-10 8 0 12 t0 12 t0 12 t0 12 t4 12 q10 8 20 0 t14 -40 L4196 570', '#c9c1ab', 3);
        dk += hot('contact', 'Contact', 'Wall telephone: contact', [4124, 410, 4256, 632], ct);
        // counter -> available
        var av = shadow(4192, 1014, 210, 12) +
            R(4004, 754, 376, 248, '#2d5263') + R(4004, 754, 376, 6, '#1f3a46');
        for (var cs = 4028; cs < 4380; cs += 26) av += L(cs, 762, cs, 988, '#3a6477', 2);
        av += R(4004, 990, 376, 12, '#1d3440') + R(3996, 730, 392, 22, '#e9e5dc', 'rx="2"') + R(3996, 748, 392, 6, '#c3beb2') +
            R(4092, 798, 208, 84, '#000', 'opacity=".25"') + R(4086, 794, 208, 84, '#f3ecdc', 'rx="6"') +
            T(4190, 836, 'OPEN', 32, '#2f7d4f', MID + ' ' + BOLD + ' letter-spacing="3"') +
            T(4190, 862, 'CONSULTANCY · TALKS · COACHING', 9, '#5b5f66', MID + ' letter-spacing=".5"');
        dk += hot('available', 'Available for', 'Front counter, open sign: available for', [3992, 724, 4392, 1014], av);
        // mobile phone (toy)
        dk += toy('mobile', 'Mobile phone: let it ring', [4020, 660, 4100, 744],
            G(P('M4040 730 L4050 690 L4082 690 L4078 730Z', '#2a2d33') + R(4046, 672, 32, 58, '#15171b', 'rx="6"') + R(4049, 678, 26, 46, '#2b2f5e', 'rx="2"') + R(4049, 700, 26, 24, '#5b3f7a', 'rx="2"', '') + T(4062, 694, '21:47', 6.5, '#e6e9ff', MID + ' class="lab-sc-mono"') +
                G(R(4049, 678, 26, 46, '#2f8a57', 'rx="2"') + C(4062, 694, 5, '#e9f7ee') + R(4054, 708, 16, 3, '#e9f7ee') + C(4062, 717, 4, '#ffffff'), 'class="lab-sc-call"'),
                'class="lab-sc-mobilebody"'));
        hole(4049, 678, 26, 46, 2);
        // service bell (toy)
        dk += toy('bell', 'Service bell: ring for attention', [4256, 656, 4364, 750],
            G(S('M4280 694 q-10 -10 -4 -24 M4340 694 q10 -10 4 -24 M4292 684 q-6 -6 -2 -14 M4328 684 q6 -6 2 -14', '#ffe3a0', 2.5), 'class="lab-sc-dings"') +
            E(4310, 732, 32, 6, '#1d1f24') + R(4280, 724, 60, 9, '#2a2d33', 'rx="3"') +
            G(R(4307, 692, 6, 12, '#9aa1a8') + E(4310, 691, 7, 3.5, '#c7ccd1'), 'class="lab-sc-plunger"') +
            P('M4284 725 A26 25 0 0 1 4336 725Z', U('dome')));
        // FAQ poster + leaflets
        var fq = R(4404, 282, 112, 150, '#000', 'opacity=".2"') + R(4400, 276, 112, 150, '#f2c94c', 'rx="4"') +
            C(4456, 348, 42, '#1d1f24') + T(4456, 372, '?', 66, '#f2c94c', MID + ' ' + BOLD) + T(4456, 416, 'FAQ', 16, '#1d1f24', MID + ' ' + BOLD + ' letter-spacing="3"');
        fq += R(4404, 498, 104, 190, '#bfc5cb', 'rx="4"') + R(4404, 498, 104, 6, '#d8dde1', 'rx="3"');
        [[506, '#e9f0f7', '#f2c94c'], [566, '#c8e6d4', '#f3e3e7'], [626, '#f7e1c6', '#d9e4f2']].forEach(function (row) {
            fq += R(4414, row[0], 40, 50, row[1], 'transform="rotate(-3 4434 ' + (row[0] + 25) + ')"') + R(4458, row[0] + 4, 40, 46, row[2], 'transform="rotate(2 4478 ' + (row[0] + 25) + ')"') +
                R(4410, row[0] + 32, 92, 24, '#dfe4e8', 'rx="2"') + R(4410, row[0] + 32, 92, 3, '#f2f4f6');
        });
        dk += hot('faq', 'FAQ', 'Question poster and leaflet rack: FAQ', [4392, 266, 4518, 694], fq);
        // pot plant (decor)
        dk += shadow(4466, 1012, 50, 7) + P('M4432 940 L4500 940 L4492 1006 L4440 1006Z', '#b5643c') + R(4428, 934, 76, 12, '#c8774c', 'rx="3"') +
            S('M4466 936 Q4460 860 4430 800 M4466 936 Q4470 850 4500 790 M4466 936 Q4466 880 4466 770', '#2c5a3f', 3) +
            E(4430, 800, 26, 13, '#3f8a5f', 'transform="rotate(-40 4430 800)"') + E(4500, 790, 26, 13, '#2f6b4f', 'transform="rotate(35 4500 790)"') +
            E(4466, 770, 14, 26, '#3f8a5f') + E(4444, 860, 22, 11, '#2f6b4f', 'transform="rotate(-20 4444 860)"') + E(4492, 850, 22, 11, '#3f8a5f', 'transform="rotate(25 4492 850)"');

        var art = shell + rec + lab + erg + off + prn + sem + dk;
        return { defs: defs, art: art, glow: glow, holes: holes.join(''), lampHoles: lampHoles.join(''), covers: covers.join(''), hots: hots, toys: toys };
    }

    // ------------------------------------------------------------------
    // Mount
    // ------------------------------------------------------------------
    function mount(container, opts) {
        opts = opts || {};
        var reduced = !!opts.reduced;
        try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) reduced = true; } catch (e) { /* ignore */ }
        var pre = 'lsc' + (++uid) + '-';
        var d = draw(pre);
        function U(id) { return 'url(#' + pre + id + ')'; }
        function sfx(name) { try { if (typeof opts.sfx === 'function') opts.sfx(name); } catch (e) { /* ignore */ } }

        var BIG = 'x="-3000" y="-3000" width="' + (SW + 6000) + '" height="' + (SH + 6000) + '"';
        var maskOn = '<mask id="' + pre + 'mOn" maskUnits="userSpaceOnUse" ' + BIG + '>' +
            '<rect ' + BIG + ' fill="#fff"/>' + d.holes + d.lampHoles +
            '<ellipse cx="2470" cy="720" rx="440" ry="400" fill="' + U('hole') + '"/>' +
            '<ellipse cx="225" cy="760" rx="150" ry="420" fill="' + U('holeSoft') + '" opacity=".6"/>' +
            d.covers + '<rect class="lab-sc-blindmask" x="2302" y="214" width="276" height="96" fill="#fff"/></mask>';
        var maskOff = '<mask id="' + pre + 'mOff" maskUnits="userSpaceOnUse" ' + BIG + '>' +
            '<rect ' + BIG + ' fill="#fff"/>' + d.holes +
            '<ellipse cx="225" cy="760" rx="150" ry="420" fill="' + U('holeSoft') + '" opacity=".6"/>' +
            d.covers + '<rect class="lab-sc-blindmask" x="2302" y="214" width="276" height="96" fill="#fff"/></mask>';

        var ui = '';
        ZONES.forEach(function (z, i) {
            var cx = (z.x0 + z.x1) / 2;
            ui += '<g class="lab-sc-zone" data-zone="' + z.key + '">' +
                '<ellipse class="lab-sc-zmark" cx="' + cx + '" cy="1110" rx="' + ((z.x1 - z.x0) / 2) + '" ry="110" fill="' + U('mark') + '"/>' +
                '<a href="#room-' + z.key + '" class="lab-sc-zlabel" aria-label="Room ' + (i + 1) + ': ' + z.name + '">' +
                '<rect class="lab-sc-zpad" x="' + (cx - 150) + '" y="1110" width="300" height="70" fill="#000" fill-opacity="0"/>' +
                '<text class="lab-sc-ztext" x="' + cx + '" y="1150" text-anchor="middle"><tspan class="lab-sc-znum">0' + (i + 1) + '</tspan> ' + z.name.toUpperCase() + '</text></a></g>';
        });
        var rings = '';
        d.hots.forEach(function (h) {
            var b = h.fit;
            rings += '<g class="lab-sc-ring" data-ring="' + h.id + '"><rect class="lab-sc-ringglow" x="' + (b[0] - 8) + '" y="' + (b[1] - 8) + '" width="' + (b[2] - b[0] + 16) + '" height="' + (b[3] - b[1] + 16) + '" rx="18"/>' +
                '<rect class="lab-sc-ringline" x="' + (b[0] - 8) + '" y="' + (b[1] - 8) + '" width="' + (b[2] - b[0] + 16) + '" height="' + (b[3] - b[1] + 16) + '" rx="18"/></g>';
        });
        d.toys.forEach(function (t) {
            var b = t.box;
            rings += '<g class="lab-sc-ring lab-sc-ring-toy" data-ring="toy-' + t.name + '"><rect class="lab-sc-ringline" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] - b[0] + 8) + '" height="' + (b[3] - b[1] + 8) + '" rx="14"/></g>';
        });

        var root = document.createElement('div');
        root.className = 'lab-sc' + (reduced ? ' lab-sc-reduced' : '');
        root.innerHTML =
            '<svg class="lab-sc-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SW + ' ' + SH + '" role="group" aria-label="Illustrated physiology lab after hours. Objects link to sections of the page.">' +
            '<defs>' + d.defs + maskOn + maskOff +
            '<radialGradient id="' + pre + 'rdDim" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"><stop offset="0" stop-color="#05070f" stop-opacity="0"/><stop offset=".55" stop-color="#05070f" stop-opacity="0"/><stop offset="1" stop-color="#05070f" stop-opacity="1"/></radialGradient>' +
            '<radialGradient id="' + pre + 'rdWarm" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"><stop offset="0" stop-color="#ffd58a" stop-opacity=".2"/><stop offset=".7" stop-color="#ffd58a" stop-opacity=".08"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>' +
            '</defs>' +
            '<g class="lab-sc-art">' + d.art + '</g>' +
            '<rect class="lab-sc-dark lab-sc-dark-on" ' + BIG + ' mask="url(#' + pre + 'mOn)" aria-hidden="true"/>' +
            '<rect class="lab-sc-dark lab-sc-dark-off" ' + BIG + ' mask="url(#' + pre + 'mOff)" aria-hidden="true"/>' +
            '<g class="lab-sc-glow" aria-hidden="true">' + d.glow + '</g>' +
            '<g class="lab-sc-reading" aria-hidden="true">' +
                '<rect class="lab-sc-rdim" ' + BIG + ' fill="' + U('rdDim') + '"/>' +
                '<ellipse class="lab-sc-rwarm" fill="' + U('rdWarm') + '"/>' +
                '<rect class="lab-sc-rhalo" rx="16"/><rect class="lab-sc-rrim" rx="12"/></g>' +
            '<g class="lab-sc-ui">' + ui + '<g class="lab-sc-rings" aria-hidden="true">' + rings + '</g><g class="lab-sc-tags" aria-hidden="true"></g></g>' +
            '</svg>' +
            '<div class="lab-sc-hint" aria-hidden="true"><span class="lab-sc-hint-arrows">← →</span> Drag to look around</div>';
        container.appendChild(root);
        var svg = root.querySelector('svg');
        var tagsG = root.querySelector('.lab-sc-tags');
        var hint = root.querySelector('.lab-sc-hint');
        function q(sel) { return root.querySelector(sel); }
        function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
        var SVGNS = 'http://www.w3.org/2000/svg';
        function mk(tag, at, parent) {
            var el = document.createElementNS(SVGNS, tag);
            for (var k in at) el.setAttribute(k, at[k]);
            if (parent) parent.appendChild(el);
            return el;
        }

        // ---------------- camera ----------------
        var cam = { s: 1, tx: 0, ty: 0 }, base = 0;
        var mode = { focus: null, inset: null, obj: null }, panning = false, panCx = 1790;
        var anim = null, momentum = null;
        function dims() { return { W: root.clientWidth || 1, H: root.clientHeight || 1 }; }
        function applyCam() { svg.style.transform = 'translate(' + cam.tx + 'px,' + cam.ty + 'px) scale(' + (cam.s / base) + ')'; }
        function rebase() {
            base = cam.s;
            svg.setAttribute('width', Math.round(SW * base));
            svg.setAttribute('height', Math.round(SH * base));
            svg.style.setProperty('--lab-sc-k', String(1 / base));
            applyCam();
            refreshTag();
            fitToyHits();
        }
        // Toy tap targets: at least 44 CSS px at the current scale (they are about 33px when the
        // room is panned on a phone). The invisible hit rect grows around the toy, but never past
        // half the distance to the nearest neighbouring toy, so adjacent toys do not steal taps.
        var toyHits = null;
        function fitToyHits() {
            if (!toyHits) toyHits = qa('.lab-sc-toy').map(function (el) {
                return { rect: el.querySelector('.lab-sc-toyhit'), box: toyBox[el.getAttribute('data-toy')] };
            });
            var need = 44 / cam.s;
            toyHits.forEach(function (t) {
                var b = t.box, w = b[2] - b[0], h = b[3] - b[1], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
                var halfW = Math.max(w / 2, need / 2), halfH = Math.max(h / 2, need / 2);
                toyHits.forEach(function (o) {
                    if (o === t) return;
                    var ob = o.box, ox = (ob[0] + ob[2]) / 2, oy = (ob[1] + ob[3]) / 2;
                    if (Math.abs(oy - cy) < (h + (ob[3] - ob[1])) / 2 + need && Math.abs(ox - cx) < (w + (ob[2] - ob[0])) / 2 + need) {
                        var dx = Math.abs(ox - cx), dy = Math.abs(oy - cy);
                        if (dx >= dy) halfW = Math.min(halfW, Math.max(w / 2, dx / 2)); else halfH = Math.min(halfH, Math.max(h / 2, dy / 2));
                    }
                });
                if (!t.rect) return;
                t.rect.setAttribute('x', cx - halfW); t.rect.setAttribute('y', cy - halfH);
                t.rect.setAttribute('width', halfW * 2); t.rect.setAttribute('height', halfH * 2);
            });
        }
        function overviewTarget() {
            var dm = dims(), fs = Math.min(dm.W / SW, dm.H / SH);
            if (fs >= 0.27) { panning = false; return { s: fs, tx: (dm.W - SW * fs) / 2, ty: (dm.H - SH * fs) / 2 }; }
            panning = true;
            var s = Math.max(dm.H / 1130, fs);
            var tx = dm.W / 2 - panCx * s;
            return { s: s, tx: clampTx(tx, s), ty: (dm.H - 1130 * s) / 2 - 62 * s };
        }
        function clampTx(tx, s) { var dm = dims(); return Math.min(0, Math.max(dm.W - SW * s, tx)); }
        function zoneTarget(key, inset) {
            var z = zoneBy(key), dm = dims();
            inset = inset || {};
            var aw = Math.max(140, dm.W - (inset.right || 0)), ah = Math.max(140, dm.H - (inset.bottom || 0));
            var s = Math.min(aw / (z.x1 - z.x0), ah / (FOCUS_Y1 - FOCUS_Y0));
            return { s: s, tx: aw / 2 - (z.x0 + z.x1) / 2 * s, ty: ah / 2 - (FOCUS_Y0 + FOCUS_Y1) / 2 * s };
        }
        // Close-up of one hotspot: the tight box fills CLOSE_FILL of the visible area (the
        // container minus the panel inset) along whichever axis limits first, capped at
        // CLOSE_MAX so the art never looks coarse. The camera never leaves the room; the one
        // exception is that the object itself is always kept inside the visible area.
        function objectTarget(id, inset) {
            var h = hotById[id], b = h.fit, dm = dims();
            inset = inset || {};
            var aw = Math.max(140, dm.W - (inset.right || 0)), ah = Math.max(140, dm.H - (inset.bottom || 0));
            var bw = b[2] - b[0], bh = b[3] - b[1];
            var s = Math.min(CLOSE_FILL * aw / bw, CLOSE_FILL * ah / bh, CLOSE_MAX);
            s = Math.max(s, dm.W / SW, dm.H / SH);
            var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, m = 14;
            var tx = aw / 2 - cx * s, ty = ah / 2 - cy * s;
            // edges of the room first
            tx = Math.min(0, Math.max(dm.W - SW * s, tx));
            ty = Math.min(0, Math.max(dm.H - SH * s, ty));
            // then make sure the object is still inside the visible area
            var lo = m - b[0] * s, hi = aw - m - b[2] * s;           // tx range that keeps the box in view
            if (lo <= hi) tx = Math.min(hi, Math.max(lo, tx));
            lo = m - b[1] * s; hi = ah - m - b[3] * s;
            if (lo <= hi) ty = Math.min(hi, Math.max(lo, ty));
            return { s: s, tx: tx, ty: ty };
        }
        function zoneBy(key) { for (var i = 0; i < ZONES.length; i++) if (ZONES[i].key === key) return ZONES[i]; return null; }
        function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
        function stopAnims() {
            if (anim) { cancelAnimationFrame(anim); anim = null; }
            if (momentum) { cancelAnimationFrame(momentum); momentum = null; }
        }
        function flyTo(t, dur) {
            stopAnims();
            if (reduced || !dur || !base) { cam = { s: t.s, tx: t.tx, ty: t.ty }; rebase(); return; }
            var dm = dims(), from = { s: cam.s, tx: cam.tx, ty: cam.ty };
            var c0x = (dm.W / 2 - from.tx) / from.s, c0y = (dm.H / 2 - from.ty) / from.s;
            var c1x = (dm.W / 2 - t.tx) / t.s, c1y = (dm.H / 2 - t.ty) / t.s;
            var t0 = performance.now();
            svg.style.willChange = 'transform';
            hideTag();
            function step(now) {
                var p = Math.min(1, (now - t0) / dur), e = ease(p);
                var s = from.s * Math.pow(t.s / from.s, e);
                var cx = c0x + (c1x - c0x) * e, cy = c0y + (c1y - c0y) * e;
                cam = { s: s, tx: dm.W / 2 - cx * s, ty: dm.H / 2 - cy * s };
                applyCam();
                if (p < 1) anim = requestAnimationFrame(step);
                else { anim = null; cam = { s: t.s, tx: t.tx, ty: t.ty }; svg.style.willChange = ''; rebase(); }
            }
            anim = requestAnimationFrame(step);
        }
        function settle(dur) {
            var t = mode.obj ? objectTarget(mode.obj, mode.inset) : mode.focus ? zoneTarget(mode.focus, mode.inset) : overviewTarget();
            if (!mode.focus) root.classList.toggle('lab-sc-panmode', panning);
            else root.classList.remove('lab-sc-panmode');
            flyTo(t, dur);
        }
        function panBy(dx) {
            if (!panning || mode.focus) return;
            cam.tx = clampTx(cam.tx + dx, cam.s);
            var dm = dims();
            panCx = (dm.W / 2 - cam.tx) / cam.s;
            applyCam();
        }
        function panToX(x) {
            var dm = dims();
            panCx = x;
            flyTo({ s: cam.s, tx: clampTx(dm.W / 2 - x * cam.s, cam.s), ty: cam.ty }, 450);
        }

        // ---------------- dragging ----------------
        var drag = null, suppressClick = false, interacted = false;
        function firstInput() {
            if (interacted) return;
            interacted = true;
            hint.classList.add('is-gone');
        }
        root.addEventListener('pointerdown', function (ev) {
            if (!panning || mode.focus || ev.button > 0) return;
            if (momentum) { cancelAnimationFrame(momentum); momentum = null; }
            drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, tx: cam.tx, on: false, lx: ev.clientX, lt: performance.now(), v: 0 };
        });
        root.addEventListener('pointermove', function (ev) {
            if (!drag || ev.pointerId !== drag.id) return;
            var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
            if (!drag.on) {
                if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
                    drag.on = true;
                    firstInput();
                    hideTag();
                    try { root.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
                    root.classList.add('is-dragging');
                    svg.style.willChange = 'transform';
                } else if (Math.abs(dy) > 10) { drag = null; return; } else return;
            }
            var now = performance.now(), dt = Math.max(1, now - drag.lt);
            drag.v = 0.8 * ((ev.clientX - drag.lx) / dt) + 0.2 * drag.v;
            drag.lx = ev.clientX; drag.lt = now;
            cam.tx = clampTx(drag.tx + dx, cam.s);
            panCx = (dims().W / 2 - cam.tx) / cam.s;
            applyCam();
        });
        function endDrag(ev) {
            if (!drag || (ev && ev.pointerId !== drag.id)) return;
            var was = drag.on, v = Math.max(-2.5, Math.min(2.5, drag.v));
            if (performance.now() - drag.lt > 80) v = 0;
            drag = null;
            root.classList.remove('is-dragging');
            if (!was) return;
            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 60);
            if (reduced || Math.abs(v) < 0.05) { svg.style.willChange = ''; return; }
            var last = performance.now();
            function glide(now) {
                var dt = now - last; last = now;
                panBy(v * dt);
                v *= Math.pow(0.94, dt / 16);
                if (Math.abs(v) > 0.02) momentum = requestAnimationFrame(glide);
                else { momentum = null; svg.style.willChange = ''; }
            }
            momentum = requestAnimationFrame(glide);
        }
        root.addEventListener('pointerup', endDrag);
        root.addEventListener('pointercancel', function (ev) { if (drag && ev.pointerId === drag.id) { drag = null; root.classList.remove('is-dragging'); } });
        root.addEventListener('click', function (ev) {
            if (suppressClick) { ev.preventDefault(); ev.stopPropagation(); suppressClick = false; }
        }, true);
        root.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
        root.addEventListener('wheel', function (ev) {
            if (!panning || mode.focus) return;
            var dx = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : (ev.shiftKey ? ev.deltaY : 0);
            if (!dx) return;
            ev.preventDefault();
            firstInput();
            hideTag();
            if (momentum) { cancelAnimationFrame(momentum); momentum = null; }
            panBy(-dx * (ev.deltaMode === 1 ? 16 : 1));
        }, { passive: false });

        // ---------------- hover rings and tags ----------------
        var hotById = {}, curTag = null;
        function zoneOfBox(b) {
            var cx = (b[0] + b[2]) / 2;
            for (var i = 0; i < ZONES.length; i++) if (cx >= ZONES[i].x0 && cx < ZONES[i].x1) return ZONES[i].key;
            return ZONES[ZONES.length - 1].key;
        }
        d.hots.forEach(function (h) { hotById[h.id] = h; });
        function ringEl(key) { return q('[data-ring="' + key + '"]'); }
        function showRing(key, on) { var r = ringEl(key); if (r) r.classList.toggle('is-on', on); }
        function showTag(id) {
            var h = hotById[id];
            if (!h) return;
            curTag = id;
            refreshTag();
        }
        function hideTag() { curTag = null; tagsG.textContent = ''; }
        function refreshTag() {
            tagsG.textContent = '';
            if (!curTag || !base) return;
            var h = hotById[curTag], k = 1 / base, b = h.fit;
            var cx = (b[0] + b[2]) / 2, y = b[1] - 14 * k;
            var dm = dims();
            // keep the tag on screen
            var topLimit = (-cam.ty / cam.s) + 30 * k;
            if (y < topLimit) y = Math.min(b[3] - 10 * k, topLimit);
            var g = mk('g', { 'class': 'lab-sc-tag' }, tagsG);
            var rect = mk('rect', { rx: 6 * k, ry: 6 * k }, g);
            var txt = mk('text', { x: cx, y: y - 8 * k, 'text-anchor': 'middle' }, g);
            txt.textContent = h.label + '  →';
            var w;
            try { w = txt.getComputedTextLength(); } catch (e) { w = h.label.length * 7.5 * k; }
            if (!w) w = (h.label.length + 3) * 7.5 * k;
            var padX = 10 * k, hgt = 26 * k;
            var left = cx - w / 2 - padX;
            var viewL = -cam.tx / cam.s + 6 * k, viewR = (dm.W - cam.tx) / cam.s - 6 * k;
            var shift = 0;
            if (left < viewL) shift = viewL - left;
            if (left + w + 2 * padX > viewR) shift = viewR - (left + w + 2 * padX);
            txt.setAttribute('x', cx + shift);
            rect.setAttribute('x', left + shift); rect.setAttribute('y', y - 8 * k - 18 * k);
            rect.setAttribute('width', w + 2 * padX); rect.setAttribute('height', hgt);
        }
        qa('.lab-sc-hot').forEach(function (a) {
            var id = a.getAttribute('data-hot');
            function on() { showRing(id, true); showTag(id); }
            function off() { showRing(id, false); if (curTag === id) hideTag(); }
            a.addEventListener('mouseenter', on);
            a.addEventListener('mouseleave', off);
            a.addEventListener('focus', function () { on(); ensureVisible(hotById[id].box); });
            a.addEventListener('click', function () {
                if (typeof opts.onPick !== 'function') return;
                try { opts.onPick({ id: id, zone: zoneOfBox(hotById[id].box) }); } catch (e) { /* ignore */ }
            });
            a.addEventListener('blur', off);
        });
        function ensureVisible(b) {
            if (!panning || mode.focus) return;
            var dm = dims(), l = (b[0] * cam.s + cam.tx), r = (b[2] * cam.s + cam.tx);
            if (l < 0 || r > dm.W) panToX((b[0] + b[2]) / 2);
        }

        // ---------------- toys ----------------
        var lampOn = true, dayOn = false;
        var toyBox = {};
        d.toys.forEach(function (t) { toyBox[t.name] = t.box; });
        var bubbleTimer = null;
        function bubble(name, text, ms) {
            var b = toyBox[name], k = 1 / (base || 1);
            var old = q('.lab-sc-bubble');
            if (old) old.parentNode.removeChild(old);
            if (bubbleTimer) clearTimeout(bubbleTimer);
            var g = mk('g', { 'class': 'lab-sc-bubble' }, q('.lab-sc-ui'));
            var cx = (b[0] + b[2]) / 2, y = b[1] - 12 * k;
            var rect = mk('rect', { rx: 6 * k }, g);
            var txt = mk('text', { x: cx, y: y - 8 * k, 'text-anchor': 'middle' }, g);
            txt.textContent = text;
            var w = 0;
            try { w = txt.getComputedTextLength(); } catch (e) { /* ignore */ }
            if (!w) w = text.length * 7.5 * k;
            rect.setAttribute('x', cx - w / 2 - 9 * k); rect.setAttribute('y', y - 26 * k);
            rect.setAttribute('width', w + 18 * k); rect.setAttribute('height', 26 * k);
            if (ms) bubbleTimer = setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, ms);
            return txt;
        }
        function pulse(el, cls, ms) {
            el.classList.remove(cls);
            void el.getBoundingClientRect();
            el.classList.add(cls);
            setTimeout(function () { el.classList.remove(cls); }, ms);
        }
        var bagAnim = null, ballAnim = null, blindAnim = null, swTimer = null, swStart = 0, swRun = false, lacBusy = false, blindH = 96, tmOn = false;
        var lacVals = ['1.4', '2.1', '3.8', '4.6', '7.9', '11.2'], lacI = 0;
        var actions = {
            lamp: function () {
                lampOn = !lampOn;
                root.classList.toggle('lab-sc-lampoff', !lampOn);
                sfx('switch');
            },
            'switch': function () {
                dayOn = !dayOn;
                root.classList.toggle('lab-sc-day', dayOn);
                sfx('click');
            },
            treadmill: function () {
                tmOn = !tmOn;
                q('.lab-sc-toy-treadmill').classList.toggle('is-on', tmOn);
                q('.lab-sc-tmread').textContent = tmOn ? '12.0' : '0.0';
                sfx(tmOn ? 'whirr' : 'click');
            },
            stopwatch: function () {
                swRun = !swRun;
                sfx('click');
                var hand = q('.lab-sc-swhand');
                if (swRun) {
                    swStart = performance.now();
                    var txt = bubble('stopwatch', '0.0 s');
                    swTimer = setInterval(function () {
                        var e = (performance.now() - swStart) / 1000;
                        txt.textContent = e.toFixed(1) + ' s';
                        hand.setAttribute('transform', 'rotate(' + ((e * 6) % 360).toFixed(1) + ' 892 770)');
                    }, 100);
                } else {
                    clearInterval(swTimer);
                    var e2 = (performance.now() - swStart) / 1000;
                    bubble('stopwatch', 'Stopped: ' + e2.toFixed(1) + ' s', 2200);
                }
            },
            bag: function () {
                sfx('thud');
                var g = q('.lab-sc-bagswing'), sh = q('.lab-sc-bagshadow');
                if (bagAnim) cancelAnimationFrame(bagAnim);
                var t0 = performance.now(), A = reduced ? 1.2 : 4.2, dur = reduced ? 400 : 4200;
                function step(now) {
                    var t = (now - t0) / 1000;
                    var a = A * Math.exp(-t / 1.3) * Math.sin(t * Math.PI * 2 / 1.7);
                    if (reduced) a = A * Math.max(0, 1 - t * 2.5);
                    g.setAttribute('transform', 'rotate(' + a.toFixed(3) + ' 1265 60)');
                    sh.setAttribute('transform', 'translate(' + (a * 12).toFixed(2) + ' 0)');
                    if (now - t0 < dur) bagAnim = requestAnimationFrame(step);
                    else { g.removeAttribute('transform'); sh.removeAttribute('transform'); bagAnim = null; }
                }
                bagAnim = requestAnimationFrame(step);
            },
            bell: function () {
                sfx('bell');
                pulse(q('.lab-sc-toy-bell'), 'is-ringing', 700);
            },
            mug: function () {
                sfx('slurp');
                pulse(q('.lab-sc-toy-mug'), 'is-sipping', 1300);
            },
            lactate: function () {
                if (lacBusy) return;
                lacBusy = true;
                var read = q('.lab-sc-lacread');
                read.textContent = '...';
                sfx('beep');
                bubble('lactate', 'Analysing…', 1000);
                setTimeout(function () {
                    var v = lacVals[lacI++ % lacVals.length];
                    read.textContent = v;
                    sfx('beep');
                    bubble('lactate', 'Blood lactate ' + v + ' mmol/L', 2600);
                    lacBusy = false;
                }, 950);
            },
            mobile: function () {
                sfx('ring');
                pulse(q('.lab-sc-toy-mobile'), 'is-ringing', 2000);
            },
            blind: function () {
                sfx('squeak');
                var from = blindH, to = blindH > 200 ? 96 : 340;
                var panel = q('.lab-sc-blindpanel'), bar = q('.lab-sc-blindbar'), cord = q('.lab-sc-cord'), bead = q('.lab-sc-bead');
                var masks = qa('.lab-sc-blindmask');
                if (blindAnim) cancelAnimationFrame(blindAnim);
                var t0 = performance.now(), dur = reduced ? 0 : 900;
                function set(h) {
                    blindH = h;
                    panel.setAttribute('height', h);
                    masks.forEach(function (m) { m.setAttribute('height', h); });
                    bar.setAttribute('y', 214 + h - 4);
                    var cy = Math.max(214 + h + 30, 352 - (h - 96) * 0.4);
                    cord.setAttribute('d', 'M2566 214L2566 ' + cy.toFixed(1));
                    bead.setAttribute('cy', cy);
                }
                function step(now) {
                    var p = dur ? Math.min(1, (now - t0) / dur) : 1;
                    set(from + (to - from) * ease(p));
                    if (p < 1) blindAnim = requestAnimationFrame(step); else blindAnim = null;
                }
                blindAnim = requestAnimationFrame(step);
            },
            ball: function () {
                sfx('pop');
                var g = q('.lab-sc-ball'), sh = q('.lab-sc-ballshadow'), spin = q('.lab-sc-ballspin');
                if (ballAnim) cancelAnimationFrame(ballAnim);
                var hops = reduced ? [[10, 0.2]] : [[70, 0.62], [30, 0.42], [11, 0.26], [3, 0.14]];
                var total = hops.reduce(function (s, h) { return s + h[1]; }, 0), t0 = performance.now();
                function step(now) {
                    var t = (now - t0) / 1000, acc = 0, y = 0;
                    for (var i = 0; i < hops.length; i++) {
                        if (t < acc + hops[i][1]) { var p = (t - acc) / hops[i][1]; y = hops[i][0] * 4 * p * (1 - p); break; }
                        acc += hops[i][1];
                    }
                    g.setAttribute('transform', 'translate(3152 ' + (986 - y).toFixed(1) + ')');
                    spin.setAttribute('transform', 'rotate(' + (Math.min(t, total) * 160).toFixed(1) + ')');
                    sh.setAttribute('opacity', (1 - y / 110).toFixed(2));
                    if (t < total) ballAnim = requestAnimationFrame(step);
                    else { g.setAttribute('transform', 'translate(3152 986)'); sh.setAttribute('opacity', 1); ballAnim = null; }
                }
                ballAnim = requestAnimationFrame(step);
            }
        };
        qa('.lab-sc-toy').forEach(function (el) {
            var name = el.getAttribute('data-toy');
            el.addEventListener('click', function () { if (actions[name]) actions[name](); });
            el.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); if (actions[name]) actions[name](); }
            });
            el.addEventListener('mouseenter', function () { showRing('toy-' + name, true); });
            el.addEventListener('mouseleave', function () { showRing('toy-' + name, false); });
            el.addEventListener('focus', function () { showRing('toy-' + name, true); var b = toyBox[name]; ensureVisible(b); });
            el.addEventListener('blur', function () { showRing('toy-' + name, false); });
        });
        qa('.lab-sc-zlabel').forEach(function (a) {
            a.addEventListener('focus', function () {
                var z = zoneBy(a.parentNode.getAttribute('data-zone'));
                ensureVisible([z.x0, 0, z.x1, 0]);
            });
        });

        // ---------------- clock ----------------
        var hh = q('.lab-sc-hh'), mh = q('.lab-sc-mh'), shd = q('.lab-sc-sh');
        function tickClock() {
            var t = new Date(), s = t.getSeconds(), m = t.getMinutes() + s / 60, h = (t.getHours() % 12) + m / 60;
            hh.setAttribute('transform', 'rotate(' + (h * 30).toFixed(2) + ' 1626 244)');
            mh.setAttribute('transform', 'rotate(' + (m * 6).toFixed(2) + ' 1626 244)');
            shd.setAttribute('transform', 'rotate(' + (s * 6) + ' 1626 244)');
        }
        tickClock();
        var clockTimer = setInterval(function () { if (active || Date.now() % 30000 < 1000) tickClock(); }, 1000);

        // ---------------- idle life ----------------
        var want = true, visible = true, active = false, flickT = null, barsT = null;
        function scheduleFlicker() {
            flickT = setTimeout(function () {
                if (lampOn && !dayOn) pulse(root, 'lab-sc-flick', 450);
                scheduleFlicker();
            }, 7000 + Math.random() * 14000);
        }
        function scheduleBars() {
            barsT = setTimeout(function () {
                root.classList.add('lab-sc-barsreset');
                setTimeout(function () { root.classList.remove('lab-sc-barsreset'); }, 700);
                scheduleBars();
            }, 6000 + Math.random() * 5000);
        }
        function update() {
            var next = want && visible && !reduced;
            if (next === active) return;
            active = next;
            root.classList.toggle('lab-sc-paused', !active);
            clearTimeout(flickT); clearTimeout(barsT);
            if (active) { scheduleFlicker(); scheduleBars(); tickClock(); }
        }
        root.classList.add('lab-sc-paused');
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; update(); });
            io.observe(root);
        }
        document.addEventListener('visibilitychange', function () { visible = document.visibilityState !== 'hidden'; update(); });

        // ---------------- sizing ----------------
        var lastW = 0, lastH = 0;
        function onResize() {
            var dm = dims();
            if (dm.W === lastW && dm.H === lastH) return;
            lastW = dm.W; lastH = dm.H;
            settle(0);
        }
        if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(root);
        else window.addEventListener('resize', onResize);
        onResize();
        update();

        var marked = null, reading = null;
        var objects = d.hots.map(function (h) {
            return { id: h.id, zone: zoneOfBox(h.box), label: h.aria, x: (h.box[0] + h.box[2]) / 2 };
        }).sort(function (a, b) { return a.x - b.x; }).map(function (o) { return { id: o.id, zone: o.zone, label: o.label }; });
        var rdim = q('.lab-sc-rdim'), rwarm = q('.lab-sc-rwarm'), rhalo = q('.lab-sc-rhalo'), rrim = q('.lab-sc-rrim'), rgroup = q('.lab-sc-reading');
        var dimGrad = document.getElementById(pre + 'rdDim'), warmGrad = document.getElementById(pre + 'rdWarm');
        function markObject(id) {
            if (id && !hotById[id]) id = null;
            reading = id || null;
            rgroup.classList.toggle('is-on', !!reading);
            qa('.lab-sc-hot').forEach(function (a) { a.classList.toggle('is-reading', a.getAttribute('data-hot') === reading); });
            if (!reading) return;
            var b = hotById[reading].fit, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = b[2] - b[0], h = b[3] - b[1];
            // dimmer: clear over the object, soft falloff to the edge of an ellipse, flat dim beyond
            var rx = Math.max(w * 0.9, 260), ry = Math.max(h * 0.9, 260);
            dimGrad.setAttribute('gradientTransform', 'translate(' + cx + ' ' + cy + ') scale(' + rx + ' ' + ry + ')');
            warmGrad.setAttribute('gradientTransform', 'translate(' + cx + ' ' + cy + ') scale(' + (w * 0.75) + ' ' + (h * 0.75) + ')');
            rwarm.setAttribute('cx', cx); rwarm.setAttribute('cy', cy); rwarm.setAttribute('rx', w * 0.75); rwarm.setAttribute('ry', h * 0.75);
            [[rhalo, 10], [rrim, 5]].forEach(function (p) {
                p[0].setAttribute('x', b[0] - p[1]); p[0].setAttribute('y', b[1] - p[1]);
                p[0].setAttribute('width', w + 2 * p[1]); p[0].setAttribute('height', h + 2 * p[1]);
            });
        }
        return {
            zones: ZONES.map(function (z) { return z.key; }),
            objects: objects,
            markObject: markObject,
            focusOn: function (id, inset) {
                if (!id || !hotById[id]) return false;
                mode.focus = zoneOfBox(hotById[id].box);
                mode.obj = id;
                mode.inset = inset || null;
                hideTag();
                settle(600);
                return true;
            },
            focus: function (key, inset) {
                if (key && !zoneBy(key)) key = null;
                mode.obj = null;
                mode.focus = key || null;
                mode.inset = inset || null;
                hideTag();
                settle(600);
            },
            mark: function (key) {
                marked = key || null;
                qa('.lab-sc-zone').forEach(function (g) { g.classList.toggle('is-marked', g.getAttribute('data-zone') === marked); });
            },
            play: function (on) { want = !!on; update(); }
        };
    }

    window.LabScene = { mount: mount };
})();
