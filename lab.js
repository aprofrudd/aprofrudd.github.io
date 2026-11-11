/* The lab: turns the linear homepage into a living floor plan (an animated
   top-down lab whose rooms open as a drawer), and adds the Wingate bay (a BBC
   Micro and a dot matrix printer).

   Progressive enhancement only. index.html stays a plain linear page of
   <section>s: with this script missing or failing, that is exactly what
   loads, and it is what crawlers read. Everything the lab adds (the plan,
   the room headers, the Wingate section) is built here at run time.

   Loaded as a classic script at the end of <body>, so it runs before first
   paint and the linear page does not flash. */
(function () {
    'use strict';

    var main = document.querySelector('main');
    var article = document.querySelector('main article');
    if (!main || !article) return;

    // ------------------------------------------------------------------
    // Rooms. Every sport and every fact line is already stated elsewhere
    // on the page; a room must not claim anything the CV does not.
    // ------------------------------------------------------------------
    var ROOMS = [
        { key: 'reception', name: 'Reception', sections: ['at-a-glance', 'about', 'now'],
          sport: 'Athletics', art: 'track',
          fact: 'England Athletics coach, from youth to senior age groups.' },
        { key: 'lab', name: 'Performance Lab', sections: ['applied-projects', 'capability', 'collaboration', 'software'],
          sport: 'Boxing', art: 'ring',
          fact: 'Conditioning across 15 world title fights.' },
        { key: 'ergo', name: 'Ergometer Bay', sections: ['wingate'],
          sport: 'Cycling', art: 'velodrome',
          fact: 'Thirty seconds, flat out, on a BBC Micro.' },
        { key: 'office', name: 'Office', sections: ['experience', 'education', 'skills'],
          sport: 'Squash', art: 'squash',
          fact: 'Hydration and fluid balance with England Squash.' },
        { key: 'print', name: 'Print Room', sections: ['publications', 'grants'],
          sport: 'Football', art: 'pitch',
          fact: 'A funded doctoral programme inside Aston Villa FC.' },
        { key: 'seminar', name: 'Seminar Room', sections: ['phds', 'talks', 'media'],
          sport: 'Road running', art: 'road',
          fact: 'Expert commentary for Runner’s World.' },
        { key: 'desk', name: 'Front Desk', sections: ['available', 'faq', 'contact'],
          sport: 'Your sport', art: 'blank',
          fact: 'Bring the problem. The lab is open.' }
    ];

    var LABELS = {
        'at-a-glance': 'At a glance', 'about': 'About', 'now': 'Now',
        'applied-projects': 'Projects', 'capability': 'Capability',
        'collaboration': 'Collaborations', 'software': 'Software',
        'wingate': 'Wingate test',
        'experience': 'Experience', 'education': 'Education', 'skills': 'Skills',
        'publications': 'Publications', 'grants': 'Grants',
        'phds': 'PhDs', 'talks': 'Talks', 'media': 'Media',
        'available': 'Available for', 'faq': 'FAQ', 'contact': 'Contact'
    };

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Top-down line drawings of each playing area, in the same hand as the
    // floor plan. Decorative: always aria-hidden, the sport is named in text.
    function art(kind) {
        var a = '<svg class="lab-art" viewBox="0 0 200 120" aria-hidden="true" focusable="false">';
        if (kind === 'track') {
            a += '<rect x="8" y="12" width="184" height="96" rx="48"/>' +
                 '<rect x="18" y="22" width="164" height="76" rx="38"/>' +
                 '<rect x="28" y="32" width="144" height="56" rx="28"/>' +
                 '<rect x="38" y="42" width="124" height="36" rx="18"/>' +
                 '<path d="M132 78V108M96 78v10M88 88v10M80 98v10"/>';
        } else if (kind === 'ring') {
            a += '<rect x="46" y="6" width="108" height="108"/>' +
                 '<rect x="56" y="16" width="88" height="88"/>' +
                 '<rect x="60" y="20" width="80" height="80" class="lab-art-faint"/>' +
                 '<rect x="64" y="24" width="72" height="72" class="lab-art-faint"/>' +
                 '<path d="M52 12h10v10H52zM138 12h10v10h-10zM52 98h10v10H52zM138 98h10v10h-10z" class="lab-art-fill"/>';
        } else if (kind === 'velodrome') {
            a += '<rect x="8" y="14" width="184" height="92" rx="46"/>' +
                 '<rect x="20" y="26" width="160" height="68" rx="34" class="lab-art-dash"/>' +
                 '<rect x="34" y="40" width="132" height="40" rx="20"/>' +
                 '<path d="M100 14v26M100 80v26"/>';
        } else if (kind === 'squash') {
            a += '<rect x="62" y="6" width="76" height="108"/>' +
                 '<path d="M62 66h76M100 66v48M62 84h18V66M138 84h-18V66"/>' +
                 '<path d="M62 12h76" class="lab-art-faint"/>';
        } else if (kind === 'pitch') {
            a += '<rect x="8" y="10" width="184" height="100"/>' +
                 '<path d="M100 10v100M8 34h30v52H8M192 34h-30v52h30M8 48h12v24H8M192 48h-12v24h12"/>' +
                 '<circle cx="100" cy="60" r="17"/>' +
                 '<circle cx="100" cy="60" r="1.5" class="lab-art-fill"/>';
        } else if (kind === 'road') {
            a += '<path d="M6 100C52 104 44 34 92 44S134 104 194 22" class="lab-art-road"/>' +
                 '<path d="M6 100C52 104 44 34 92 44S134 104 194 22" class="lab-art-dash"/>' +
                 '<path d="M184 8v22M184 8l-12 5 12 5" />';
        } else {
            a += '<rect x="20" y="14" width="160" height="92" class="lab-art-dash"/>' +
                 '<path d="M90 50c0-14 22-14 22 0 0 9-11 9-11 20M101 80v2"/>';
        }
        return a + '</svg>';
    }

    // ------------------------------------------------------------------
    // The Wingate section (markup only; behaviour is wired further down)
    // ------------------------------------------------------------------
    var wingate = document.createElement('section');
    wingate.id = 'wingate';
    wingate.className = 'section lab-wingate';
    wingate.innerHTML =
        '<div class="container">' +
            '<h2 class="section-title">The Wingate Test</h2>' +
            '<p class="lab-wg-intro">We used to run Wingate tests from an old BBC computer, and the results came out of a dot matrix printer, one noisy line at a time. This is that setup, rebuilt for a keyboard: thirty seconds, flat out, against a fixed load.</p>' +
            '<div class="lab-wg-bench">' +
                '<div class="lab-wg-micro">' +
                    '<div class="lab-wg-monitor">' +
                        '<div class="lab-wg-tube"><div class="lab-wg-screen" id="lab-wg-screen" role="img" aria-label="BBC Micro screen running the Wingate test program"></div></div>' +
                    '</div>' +
                    '<div class="lab-wg-keys" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
                    '<div class="lab-wg-controls">' +
                        '<button type="button" class="lab-wg-btn lab-wg-btn-main" id="lab-wg-go">Start the test</button>' +
                        '<button type="button" class="lab-wg-btn" id="lab-wg-demo">Run a demo trace</button>' +
                        '<button type="button" class="lab-wg-btn" id="lab-wg-sound" aria-pressed="true">Printer sound: on</button>' +
                    '</div>' +
                    '<p class="lab-wg-help">Pedal by tapping <kbd>Z</kbd> and <kbd>X</kbd>, or <kbd>Space</kbd>, or the button, as fast as you can. Every tap turns the flywheel.</p>' +
                '</div>' +
                '<div class="lab-wg-printer">' +
                    '<div class="lab-wg-paper" id="lab-wg-paper"><div class="lab-wg-sheet"><div class="lab-wg-roll" id="lab-wg-roll"></div></div></div>' +
                    '<div class="lab-wg-platen" aria-hidden="true"><span>DOT MATRIX</span><i></i></div>' +
                '</div>' +
            '</div>' +
            '<p class="lab-wg-status visually-hidden" id="lab-wg-status" aria-live="polite"></p>' +
            '<p class="lab-wg-note">A keyboard is not a Monark. The watts are worked out the usual way (load &times; flywheel distance &times; cadence, at 7.5% of a 75 kg body mass), but the cadence is your fingers, so read the numbers for fun and the fatigue curve for real.</p>' +
        '</div>';
    article.appendChild(wingate);

    // ------------------------------------------------------------------
    // Group the sections into rooms
    // ------------------------------------------------------------------
    var claimed = {};
    ROOMS.forEach(function (room, i) {
        var wrap = document.createElement('div');
        wrap.className = 'lab-room';
        wrap.id = 'room-' + room.key;
        wrap.setAttribute('data-room', room.key);
        room.el = wrap;
        room.num = (i < 9 ? '0' : '') + (i + 1);

        var head = document.createElement('header');
        head.className = 'lab-room-head';
        head.innerHTML =
            '<div class="container lab-room-head-in">' +
                '<div class="lab-room-plate">' +
                    '<p class="lab-room-num">Room ' + room.num + '</p>' +
                    '<h2 class="lab-room-name" tabindex="-1">' + esc(room.name) + '</h2>' +
                '</div>' +
                '<div class="lab-room-sport">' +
                    art(room.art) +
                    '<p><span class="lab-room-sport-label">In session</span>' +
                    '<strong>' + esc(room.sport) + '</strong>' +
                    '<span class="lab-room-fact">' + esc(room.fact) + '</span></p>' +
                '</div>' +
            '</div>';
        wrap.appendChild(head);

        var n = 0;
        room.sections.forEach(function (id) {
            var s = document.getElementById(id);
            if (!s) return;
            claimed[id] = true;
            // Alternating backgrounds were set for the old running order.
            s.classList.toggle('section-alt', n % 2 === 1);
            n++;
            wrap.appendChild(s);
        });
    });

    // A section added to index.html later but not listed above must not
    // vanish: it goes in the last room.
    Array.prototype.slice.call(article.querySelectorAll(':scope > section')).forEach(function (s) {
        if (!claimed[s.id]) ROOMS[ROOMS.length - 1].el.appendChild(s);
    });

    ROOMS.forEach(function (room, i) {
        var prev = ROOMS[i - 1], next = ROOMS[i + 1];
        var foot = document.createElement('footer');
        foot.className = 'lab-room-foot';
        foot.innerHTML = '<div class="container lab-room-foot-in">' +
            (prev ? '<a href="#room-' + prev.key + '" class="lab-door lab-door-prev"><span>Back to</span>' + esc(prev.name) + '</a>' : '<span></span>') +
            '<a href="#lab-plan" class="lab-door lab-door-plan">Floor plan</a>' +
            (next ? '<a href="#room-' + next.key + '" class="lab-door lab-door-next"><span>Next door</span>' + esc(next.name) + '</a>' : '<span></span>') +
            '</div>';
        room.el.appendChild(foot);
        article.appendChild(room.el);
    });

    // ------------------------------------------------------------------
    // The living lab: an animated top-down plan. Every room is a link.
    // ------------------------------------------------------------------
    var NS = 'http://www.w3.org/2000/svg';
    function S(tag, attrs, parent, text) {
        var n = document.createElementNS(NS, tag);
        for (var k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
    }

    // Every room is drawn in the same 300 x 260 cell (the lab is two cells
    // wide), so the phone layout only has to move cells, not redraw them.
    var CW = 300, CH = 260, COR = 64;
    var LAYOUTS = {
        wide: { w: 1200, h: CH * 2 + COR, cor: CH,
            at: { reception: [0, 0], lab: [300, 0], ergo: [900, 0],
                  office: [0, CH + COR], print: [300, CH + COR], seminar: [600, CH + COR], desk: [900, CH + COR] } },
        tall: { w: 600, h: CH * 4 + COR, cor: CH * 2,
            at: { reception: [0, 0], ergo: [300, 0], lab: [0, CH],
                  office: [0, CH * 2 + COR], print: [300, CH * 2 + COR],
                  seminar: [0, CH * 3 + COR], desk: [300, CH * 3 + COR] } }
    };

    var plan = document.createElement('nav');
    plan.id = 'lab-plan';
    plan.className = 'lab-plan';
    plan.setAttribute('aria-label', 'Lab floor plan');
    plan.innerHTML =
        '<div class="lab-plan-in">' +
            '<div class="lab-plan-title">' +
                '<p class="lab-plan-kicker"><i></i>The lab, live</p>' +
                '<p class="lab-plan-hint">Hover a room to wake it up. Click to go in.</p>' +
                '<button type="button" class="lab-all-toggle" id="lab-all" aria-pressed="false">Read as one page</button>' +
            '</div>' +
            '<div class="lab-scene"></div>' +
        '</div>';
    main.insertBefore(plan, article);

    var svg = S('svg', { 'class': 'lab-svg', role: 'group', 'aria-label': 'Seven rooms off a corridor' }, plan.querySelector('.lab-scene'));
    var corridor = S('g', { 'class': 'lab-corridor' }, svg);
    var corFloor = S('rect', { 'class': 'lab-cor-floor', height: COR }, corridor);
    var ecgLine = S('polyline', { 'class': 'lab-ecg' }, corridor);
    var hrText = S('text', { 'class': 'lab-hr', x: 18, y: 26 }, corridor, 'HR 062');
    var youG = S('g', { 'class': 'lab-you' }, corridor);
    S('circle', { r: 13, 'class': 'lab-you-ring' }, youG);
    S('circle', { r: 6, 'class': 'lab-you-dot' }, youG);
    S('text', { y: -12, 'text-anchor': 'middle', 'class': 'lab-you-label' }, youG, 'YOU');

    function tri(d, range) {            // bounce between 0 and range
        var m = d % (range * 2);
        if (m < 0) m += range * 2;
        return m > range ? range * 2 - m : m;
    }
    function ease(f) { return f * f * (3 - 2 * f); }
    // One heartbeat, u in 0..1: P wave, QRS spike, T wave.
    function ecg(u) {
        function g(c, w, a) { var d = (u - c) / w; return a * Math.exp(-d * d); }
        return g(0.18, 0.03, 0.12) + g(0.345, 0.012, -0.18) + g(0.37, 0.012, 1) +
               g(0.4, 0.014, -0.3) + g(0.6, 0.05, 0.22);
    }
    function dot(parent, cls, r) { return S('circle', { 'class': cls, r: r || 5.5 }, parent); }
    function place(n, x, y) { n.setAttribute('cx', x.toFixed(1)); n.setAttribute('cy', y.toFixed(1)); }

    // Each builder draws the room's fixtures into g and returns the function
    // that moves them; p is the room's own clock in seconds.
    var BUILD = {
        reception: function (g) {
            [0, 12, 24, 36].forEach(function (i) {
                S('rect', { x: 30 + i, y: 84 + i, width: 240 - 2 * i, height: 150 - 2 * i, rx: 75 - i, 'class': 'lab-line' }, g);
            });
            S('path', { d: 'M190 198v36', 'class': 'lab-line' }, g);
            var lanes = [6, 18, 30].map(function (i, n) {
                var path = S('rect', { x: 30 + i, y: 84 + i, width: 240 - 2 * i, height: 150 - 2 * i, rx: 75 - i, fill: 'none' }, g);
                return { path: path, len: path.getTotalLength(), v: 66 - n * 5, off: n * 140,
                         el: dot(g, n === 1 ? 'lab-b' : 'lab-a') };
            });
            return function (p) {
                lanes.forEach(function (l) {
                    var s = l.len - ((p * l.v + l.off) % l.len);
                    var pt = l.path.getPointAtLength(s);
                    place(l.el, pt.x, pt.y);
                });
            };
        },

        lab: function (g) {
            // the ring
            S('rect', { x: 36, y: 76, width: 168, height: 168, 'class': 'lab-line' }, g);
            S('rect', { x: 46, y: 86, width: 148, height: 148, 'class': 'lab-line' }, g);
            S('rect', { x: 51, y: 91, width: 138, height: 138, 'class': 'lab-line lab-faint' }, g);
            S('path', { d: 'M41 81h11v11H41zM188 81h11v11h-11zM41 228h11v11H41zM188 228h11v11h-11z', 'class': 'lab-solid' }, g);
            var boxers = [0, 1].map(function (i) {
                return { body: dot(g, i ? 'lab-b' : 'lab-a', 9), l: dot(g, 'lab-ball', 4.2), r: dot(g, 'lab-ball', 4.2) };
            });
            // treadmill
            S('rect', { x: 250, y: 116, width: 150, height: 78, rx: 8, 'class': 'lab-line lab-fillable' }, g);
            S('rect', { x: 276, y: 126, width: 112, height: 58, 'class': 'lab-belt' }, g);
            S('path', { d: 'M262 124v62', 'class': 'lab-line lab-thick' }, g);
            var stripes = [];
            for (var i = 0; i < 8; i++) stripes.push(S('path', { 'class': 'lab-line lab-faint' }, g));
            var feet = [dot(g, 'lab-a', 3.6), dot(g, 'lab-a', 3.6)];
            var runner = dot(g, 'lab-a', 8);
            S('text', { x: 250, y: 214, 'class': 'lab-tiny' }, g, 'TREADMILL');
            // metabolic cart: a hose from the runner to a monitor
            S('path', { d: 'M318 146C340 96 400 84 436 110', 'class': 'lab-line lab-dash' }, g);
            S('rect', { x: 430, y: 84, width: 146, height: 104, rx: 8, 'class': 'lab-screen' }, g);
            var trace = S('polyline', { 'class': 'lab-trace' }, g);
            var breath = S('polyline', { 'class': 'lab-trace lab-trace-2' }, g);
            var read = S('text', { x: 440, y: 180, 'class': 'lab-screen-text' }, g, '');
            S('text', { x: 430, y: 208, 'class': 'lab-tiny' }, g, 'GAS ANALYSIS');
            return function (p, speed) {
                var a = p * 0.55, cx = 120 + 14 * Math.sin(p * 0.31), cy = 160 + 12 * Math.cos(p * 0.23);
                var d = 25 + 5 * Math.sin(p * 1.7);
                boxers.forEach(function (b, i) {
                    var dir = a + (i ? Math.PI : 0);
                    var x = cx + Math.cos(dir) * d, y = cy + Math.sin(dir) * d;
                    place(b.body, x, y);
                    var face = dir + Math.PI;
                    [b.l, b.r].forEach(function (glove, k) {
                        var jab = Math.pow(Math.max(0, Math.sin(p * 5.5 + i * 1.9 + k * Math.PI)), 6);
                        var reach = 12 + 11 * jab, ang = face + (k ? 0.55 : -0.55) * (1 - jab * 0.8);
                        place(glove, x + Math.cos(ang) * reach, y + Math.sin(ang) * reach);
                    });
                });
                var off = (p * 70) % 14;
                stripes.forEach(function (s, i) {
                    var x = 388 - ((i * 14 + off) % 112);
                    s.setAttribute('d', 'M' + x.toFixed(1) + ' 128v54');
                });
                var stride = Math.sin(p * 9);
                place(runner, 322 + 1.5 * Math.sin(p * 18), 155);
                place(feet[0], 322 + 13 * stride, 149);
                place(feet[1], 322 - 13 * stride, 161);
                var pts = '', pts2 = '';
                for (var x = 0; x <= 126; x += 3) {
                    var u = (p * 1.5 + x / 46) % 1;
                    pts += (440 + x) + ',' + (132 - ecg(u) * 30).toFixed(1) + ' ';
                    pts2 += (440 + x) + ',' + (156 + Math.sin(p * 2.4 + x / 13) * 7).toFixed(1) + ' ';
                }
                trace.setAttribute('points', pts);
                breath.setAttribute('points', pts2);
                read.textContent = 'HR ' + Math.round(128 + 44 * Math.min(1, (speed - 1) / 1.4) + 3 * Math.sin(p)) +
                    '  RER 0.' + Math.round(88 + 8 * Math.sin(p * 0.2));
            };
        },

        ergo: function (g) {
            S('path', { d: 'M40 236h170', 'class': 'lab-line lab-thick' }, g);
            S('path', { d: 'M150 196L168 122M156 118h26M150 196L88 190M88 190L112 118M100 114h26M88 190L62 236M150 196L176 236', 'class': 'lab-line' }, g);
            S('circle', { cx: 88, cy: 190, r: 38, 'class': 'lab-line lab-thick' }, g);
            S('circle', { cx: 88, cy: 190, r: 31, 'class': 'lab-line lab-faint' }, g);
            var spokes = S('path', { 'class': 'lab-line' }, g);
            S('circle', { cx: 150, cy: 196, r: 11, 'class': 'lab-line lab-fillable' }, g);
            var crank = S('path', { 'class': 'lab-line lab-thick' }, g);
            var pedals = [dot(g, 'lab-a', 5), dot(g, 'lab-a', 5)];
            // the Micro and its printer
            var paper = S('rect', { x: 226, y: 200, width: 44, height: 0, 'class': 'lab-paper' }, g);
            S('rect', { x: 216, y: 206, width: 64, height: 26, rx: 4, 'class': 'lab-case' }, g);
            S('rect', { x: 206, y: 82, width: 84, height: 70, rx: 7, 'class': 'lab-case' }, g);
            S('rect', { x: 213, y: 89, width: 70, height: 50, rx: 4, 'class': 'lab-screen' }, g);
            var bars = [];
            for (var i = 0; i < 12; i++) bars.push(S('rect', { x: 218 + i * 5, width: 4, 'class': 'lab-bar' }, g));
            return function (p) {
                var a = p * 5, d = '';
                for (var k = 0; k < 4; k++) {
                    var s = a * 1.6 + k * Math.PI / 2;
                    d += 'M88 190L' + (88 + Math.cos(s) * 31).toFixed(1) + ' ' + (190 + Math.sin(s) * 31).toFixed(1);
                }
                spokes.setAttribute('d', d);
                var px = Math.cos(a) * 21, py = Math.sin(a) * 21;
                crank.setAttribute('d', 'M' + (150 - px).toFixed(1) + ' ' + (196 - py).toFixed(1) +
                    'L' + (150 + px).toFixed(1) + ' ' + (196 + py).toFixed(1));
                place(pedals[0], 150 + px, 196 + py);
                place(pedals[1], 150 - px, 196 - py);
                // a test every eight seconds: bars fill, then the paper feeds
                var t = p % 8, n = Math.min(12, Math.floor(t * 2.4));
                bars.forEach(function (b, i) {
                    var h = i < n ? 40 * (i < 2 ? 0.8 + 0.1 * i : 1 - (i - 2) * 0.055) : 0;
                    b.setAttribute('y', (135 - h).toFixed(1));
                    b.setAttribute('height', h.toFixed(1));
                });
                var feed = t < 5 ? 0 : Math.min(1, (t - 5) / 2.2) * 34;
                paper.setAttribute('y', (206 - feed).toFixed(1));
                paper.setAttribute('height', feed.toFixed(1));
            };
        },

        office: function (g) {
            S('rect', { x: 92, y: 78, width: 116, height: 166, 'class': 'lab-line' }, g);
            S('path', { d: 'M92 172h116M150 172v72M92 196h24v-24M208 196h-24v-24', 'class': 'lab-line' }, g);
            S('path', { d: 'M92 86h116', 'class': 'lab-line lab-faint' }, g);
            var players = [{ el: dot(g, 'lab-a', 7), x: 130, y: 200 }, { el: dot(g, 'lab-b', 7), x: 170, y: 215 }];
            var ball = dot(g, 'lab-ball', 3.2);
            var last = 0;
            return function (p) {
                var bx = 98 + tri(p * 83, 104), by = 84 + tri(p * 131, 154);
                place(ball, bx, by);
                var k = 1 - Math.exp(-Math.abs(p - last) * 3.2);
                last = p;
                var targets = [[bx * 0.7 + 45, Math.max(by + 8, 160)], [255 - bx * 0.7, 206]];
                players.forEach(function (pl, i) {
                    pl.x += (targets[i][0] - pl.x) * k;
                    pl.y += (targets[i][1] - pl.y) * k;
                    place(pl.el, pl.x, pl.y);
                });
            };
        },

        print: function (g) {
            S('rect', { x: 30, y: 84, width: 240, height: 150, 'class': 'lab-line' }, g);
            S('path', { d: 'M150 84v150M30 122h36v74H30M270 122h-36v74h36M30 142h14v34H30M270 142h-14v34h14', 'class': 'lab-line' }, g);
            S('circle', { cx: 150, cy: 159, r: 22, 'class': 'lab-line' }, g);
            var base = [[92, 120], [128, 196], [196, 136], [222, 190], [112, 158], [176, 176], [70, 180], [238, 150]];
            var team = [0, 0, 0, 0, 1, 1, 1, 1];
            var men = base.map(function (b, i) { return { el: dot(g, team[i] ? 'lab-b' : 'lab-a', 6), x: b[0], y: b[1] }; });
            var ball = dot(g, 'lab-ball', 3.6);
            var order = [0, 2, 3, 1];
            return function (p) {
                men.forEach(function (m, i) {
                    m.x = base[i][0] + 16 * Math.cos(p * (0.5 + i * 0.07) + i * 2.1);
                    m.y = base[i][1] + 12 * Math.sin(p * (0.62 + i * 0.05) + i);
                    place(m.el, m.x, m.y);
                });
                var t = p / 1.15, i = Math.floor(t) % 4, f = ease(Math.min(1, (t % 1) * 1.5));
                var from = men[order[i]], to = men[order[(i + 1) % 4]];
                place(ball, from.x + (to.x - from.x) * f + 6, from.y + (to.y - from.y) * f + 6);
            };
        },

        seminar: function (g) {
            var d = 'M18 226C92 236 76 118 150 130S214 238 284 96';
            S('path', { d: d, 'class': 'lab-road' }, g);
            var road = S('path', { d: d, 'class': 'lab-line lab-dash lab-faint' }, g);
            S('path', { d: 'M268 76v30M268 76l-14 6 14 6', 'class': 'lab-line' }, g);
            var len = road.getTotalLength();
            var pack = [0, 16, 27, 52, 94].map(function (off, i) {
                return { off: off, el: dot(g, i % 2 ? 'lab-b' : 'lab-a', 5.5), w: i };
            });
            return function (p) {
                pack.forEach(function (r) {
                    var s = (p * 34 + len - r.off + 5 * Math.sin(p * 0.9 + r.w)) % len;
                    var pt = road.getPointAtLength(s < 0 ? s + len : s);
                    place(r.el, pt.x, pt.y + (r.w % 2 ? 4 : -4));
                });
            };
        },

        desk: function (g) {
            S('rect', { x: 34, y: 90, width: 232, height: 140, 'class': 'lab-line lab-dash lab-faint' }, g);
            S('rect', { x: 70, y: 150, width: 160, height: 26, rx: 5, 'class': 'lab-line lab-fillable' }, g);
            var rings = [0, 1, 2].map(function () { return S('circle', { cx: 150, cy: 138, 'class': 'lab-ring' }, g); });
            S('circle', { cx: 150, cy: 138, r: 7, 'class': 'lab-solid' }, g);
            var host = dot(g, 'lab-a', 8);
            var q = S('text', { x: 150, y: 124, 'text-anchor': 'middle', 'class': 'lab-q' }, g, '?');
            return function (p) {
                rings.forEach(function (r, i) {
                    var f = ((p * 0.45 + i / 3) % 1);
                    r.setAttribute('r', (7 + f * 44).toFixed(1));
                    r.setAttribute('opacity', (0.5 * (1 - f)).toFixed(2));
                });
                place(host, 150 + 26 * Math.sin(p * 0.5), 200);
                q.setAttribute('y', (112 + 3 * Math.sin(p * 2)).toFixed(1));
            };
        }
    };

    ROOMS.forEach(function (room) {
        var wide = room.key === 'lab' ? CW * 2 : CW;
        room.cellW = wide;
        var a = S('a', { href: '#room-' + room.key, 'class': 'lab-cell lab-cell-' + room.key,
            'aria-label': room.name + ': ' + room.sections.map(function (id) { return LABELS[id] || id; }).join(', ') }, svg);
        room.cell = a;
        S('rect', { width: wide, height: CH, 'class': 'lab-floor' }, a);
        room.door = S('g', { 'class': 'lab-door-gap' }, a);
        S('text', { x: 18, y: 34, 'class': 'lab-cell-name' }, a, room.name);
        S('text', { x: 18, y: 54, 'class': 'lab-cell-sport' }, a, room.num + ' · ' + room.sport);
        var arrow = S('text', { x: wide - 18, y: 34, 'text-anchor': 'end', 'class': 'lab-cell-enter' }, a, 'Enter →');
        arrow.setAttribute('aria-hidden', 'true');
        var fx = S('g', { 'class': 'lab-fx', 'aria-hidden': 'true' }, a);
        room.clock = Math.random() * 20;
        room.speed = 1;
        try { room.tick = BUILD[room.key](fx); } catch (e) { room.tick = null; }
    });
    svg.appendChild(corridor);      // above the floors, so the walls stay crisp

    var layout = null;
    var samples = [];
    var narrow = window.matchMedia('(max-width: 760px)');

    function applyLayout() {
        layout = narrow.matches ? LAYOUTS.tall : LAYOUTS.wide;
        svg.setAttribute('viewBox', '-3 -3 ' + (layout.w + 6) + ' ' + (layout.h + 6));
        corridor.setAttribute('transform', 'translate(0 ' + layout.cor + ')');
        corFloor.setAttribute('width', layout.w);
        samples = [];
        ROOMS.forEach(function (room) {
            var at = layout.at[room.key];
            room.cell.setAttribute('transform', 'translate(' + at[0] + ' ' + at[1] + ')');
            // A door only where the room actually meets the corridor.
            var above = at[1] + CH === layout.cor, below = at[1] === layout.cor + COR;
            room.door.innerHTML = '';
            room.doorX = null;
            if (above || below) {
                var x1 = room.cellW - 84, x2 = room.cellW - 40, y = above ? CH : 0, s = above ? -1 : 1;
                S('path', { d: 'M' + x1 + ' ' + y + 'H' + x2, 'class': 'lab-door-cut' }, room.door);
                S('path', { d: 'M' + x2 + ' ' + y + 'v' + (s * 44) + 'A44 44 0 0 ' + (above ? 0 : 1) + ' ' + x1 + ' ' + y, 'class': 'lab-door-leaf' }, room.door);
                room.doorX = at[0] + (x1 + x2) / 2;
            }
        });
        you.x = you.to = layout.w / 2;
    }

    var you = { x: 600, to: 600 };
    var hovered = null;
    var hr = 62, beat = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setHover(key) {
        hovered = key;
        ROOMS.forEach(function (room) { room.cell.classList.toggle('is-hot', room.key === key); });
        var room = key && byKey(key);
        if (room && room.doorX != null) you.to = room.doorX;
    }
    function byKey(key) {
        for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].key === key) return ROOMS[i];
        return null;
    }

    ROOMS.forEach(function (room) {
        room.cell.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setHover(room.key); });
        room.cell.addEventListener('pointerleave', function () { if (hovered === room.key) setHover(null); });
        room.cell.addEventListener('focus', function () { setHover(room.key); });
        room.cell.addEventListener('blur', function () { if (hovered === room.key) setHover(null); });
    });
    // In the corridor the visitor follows the pointer.
    svg.addEventListener('pointermove', function (e) {
        if (hovered || e.pointerType === 'touch') return;
        var box = svg.getBoundingClientRect();
        you.to = Math.max(20, Math.min(layout.w - 20, (e.clientX - box.left) / box.width * (layout.w + 6) - 3));
    });

    function frame(dt) {
        ROOMS.forEach(function (room) {
            var want = room.key === hovered ? 2.6 : 1;
            room.speed += (want - room.speed) * (1 - Math.exp(-dt * 5));
            room.clock += dt * room.speed;
            if (room.tick) room.tick(room.clock, room.speed);
        });
        // The visitor's pulse climbs as they reach for a door.
        var target = hovered ? (hovered === 'ergo' ? 176 : 148) : 62;
        hr += (target - hr) * (1 - Math.exp(-dt * 1.6));
        hrText.textContent = 'HR ' + ('00' + Math.round(hr)).slice(-3);
        var n = Math.max(1, Math.round(dt * 40));
        var need = Math.ceil(layout.w / 3) + 1;
        for (var i = 0; i < n; i++) {
            beat += (dt / n) * hr / 60;
            samples.push(ecg(beat % 1));
        }
        while (samples.length < need) samples.unshift(0);
        if (samples.length > need) samples.splice(0, samples.length - need);
        var pts = '';
        for (var j = 0; j < samples.length; j++) pts += (j * 3) + ',' + (50 - samples[j] * 26).toFixed(1) + ' ';
        ecgLine.setAttribute('points', pts);
        you.x += (you.to - you.x) * (1 - Math.exp(-dt * 6));
        youG.setAttribute('transform', 'translate(' + you.x.toFixed(1) + ' 30)');
    }

    var running = false, lastT = 0;
    function loop(t) {
        if (!running) return;
        var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
        lastT = t;
        frame(dt);
        window.requestAnimationFrame(loop);
    }
    // Decoration only, so requestAnimationFrame is right here: it stops in a
    // hidden tab, which is what is wanted. (The Wingate test must not.)
    function play(on) {
        if (reduced) return;
        if (on && !running) { running = true; lastT = 0; window.requestAnimationFrame(loop); }
        if (!on) running = false;
    }

    applyLayout();
    if (narrow.addEventListener) narrow.addEventListener('change', applyLayout);
    else if (narrow.addListener) narrow.addListener(applyLayout);
    // One settled frame always, so reduced motion gets a full still drawing.
    for (var warm = 0; warm < 140; warm++) frame(0.05);
    play(true);

    // ------------------------------------------------------------------
    // The drawer: a room's content slides in over the plan
    // ------------------------------------------------------------------
    article.classList.add('lab-drawer');
    var bar = document.createElement('div');
    bar.className = 'lab-drawer-bar';
    bar.innerHTML = '<div class="lab-chips"></div>' +
        '<button type="button" class="lab-close" aria-label="Close the room and go back to the lab">Back to the lab <span aria-hidden="true">×</span></button>';
    article.insertBefore(bar, article.firstChild);
    var chips = bar.querySelector('.lab-chips');
    var scrim = document.createElement('div');
    scrim.className = 'lab-scrim';
    main.appendChild(scrim);
    document.documentElement.classList.add('lab-live');

    // The top nav lists rooms instead of sixteen sections.
    var navMenu = document.querySelector('.nav-menu');
    var navToggle = document.querySelector('.nav-toggle');
    var navbar = document.querySelector('.navbar');
    if (navMenu) {
        navMenu.innerHTML = ROOMS.map(function (room) {
            return '<li><a href="#room-' + room.key + '" data-room="' + room.key + '">' + esc(room.name) + '</a></li>';
        }).join('') + '<li><a href="/vo2max/">Learning</a></li>';
        navMenu.classList.add('lab-nav');
        ROOMS.forEach(function (room) {
            room.navLink = navMenu.querySelector('a[data-room="' + room.key + '"]');
        });
    }
    function measureNav() {
        if (navbar) document.documentElement.style.setProperty('--lab-nav-h', navbar.getBoundingClientRect().height + 'px');
    }
    measureNav();
    window.addEventListener('resize', measureNav);

    var hero = document.querySelector('.hero-cta');
    if (hero) {
        var cta = document.createElement('a');
        cta.href = '#wingate';
        cta.className = 'btn btn-secondary';
        cta.textContent = 'Ride the Wingate';
        hero.appendChild(cta);
    }

    // ------------------------------------------------------------------
    // Which room is open
    // ------------------------------------------------------------------
    var current = 'reception';
    var isOpen = false;
    var linear = false;             // "Read as one page"
    var allToggle = document.getElementById('lab-all');
    var wingateBusy = function () { return false; };
    var root = document.documentElement;

    function show(key) {
        current = key;
        ROOMS.forEach(function (room) {
            var here = room.key === key;
            if (linear || here) {
                room.el.removeAttribute('hidden');
            } else {
                // until-found keeps a closed room reachable by find-in-page;
                // browsers without it treat the attribute as plain hidden.
                room.el.setAttribute('hidden', 'until-found');
            }
            var mark = here && (isOpen || linear);
            room.cell.classList.toggle('is-here', mark);
            if (mark) room.cell.setAttribute('aria-current', 'location');
            else room.cell.removeAttribute('aria-current');
            if (room.navLink) room.navLink.classList.toggle('is-current', mark);
        });
        var room = byKey(key);
        chips.innerHTML = '<span class="lab-chips-room">' + esc(room.name) + '</span>' +
            (room.sections.length > 1 ? room.sections.filter(function (id) { return claimed[id]; }).map(function (id) {
                return '<a href="#' + id + '">' + esc(LABELS[id] || id) + '</a>';
            }).join('') : '');
    }

    function setOpen(on) {
        isOpen = on && !linear;
        root.classList.toggle('lab-open', isOpen);
        play(!isOpen);
        show(current);
    }

    function closeDrawer() {
        if (!isOpen) return;
        setOpen(false);
        try { history.pushState(null, '', location.pathname + location.search); } catch (e) { /* sandboxed */ }
        var room = byKey(current);
        if (room) room.cell.focus({ preventScroll: true });
        setHover(null);
    }

    ROOMS.forEach(function (room) {
        room.el.addEventListener('beforematch', function () { current = room.key; setOpen(true); });
    });
    // Tabbing into the drawer while it is off screen brings it on.
    article.addEventListener('focusin', function () { if (!isOpen && !linear) setOpen(true); });

    // Open whichever room holds #id and scroll to it. False when the id is
    // not something the lab owns, so the browser handles the link itself.
    function go(id, focus) {
        if (id === 'lab-plan') {
            closeDrawer();
            plan.scrollIntoView();
            return true;
        }
        var el = id && document.getElementById(id);
        var wrap = el && el.closest('.lab-room');
        if (!wrap) return false;
        current = wrap.getAttribute('data-room');
        setOpen(true);
        if (linear) el.scrollIntoView();
        else if (el === wrap) article.scrollTop = 0;
        else el.scrollIntoView({ block: 'start' });
        if (focus && el === wrap) {
            var name = wrap.querySelector('.lab-room-name');
            if (name) name.focus({ preventScroll: true });
        }
        return true;
    }

    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute('href').slice(1);
        if (!go(id, true)) return;
        e.preventDefault();
        if (navMenu && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
        }
        if (id !== 'lab-plan' && location.hash !== '#' + id) {
            try { history.pushState(null, '', '#' + id); } catch (err) { /* sandboxed */ }
        }
    });

    bar.querySelector('.lab-close').addEventListener('click', closeDrawer);
    scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen && !wingateBusy()) closeDrawer();
    });

    window.addEventListener('popstate', function () {
        if (!go(location.hash.slice(1))) { setOpen(false); }
    });

    allToggle.addEventListener('click', function () {
        linear = !linear;
        allToggle.setAttribute('aria-pressed', String(linear));
        allToggle.textContent = linear ? 'Back to the live lab' : 'Read as one page';
        root.classList.toggle('lab-linear', linear);
        setOpen(false);
        if (linear) { play(true); markByScroll(); }
    });

    // As one long page, "you are here" follows the scroll position.
    var marking = false;
    function markByScroll() {
        marking = false;
        if (!linear) return;
        var probe = window.innerHeight * 0.35;
        for (var i = 0; i < ROOMS.length; i++) {
            var box = ROOMS[i].el.getBoundingClientRect();
            if (box.top <= probe && box.bottom > probe) {
                if (ROOMS[i].key !== current) show(ROOMS[i].key);
                return;
            }
        }
    }
    window.addEventListener('scroll', function () {
        if (!linear || marking) return;
        marking = true;
        // A timer, not requestAnimationFrame: frames stop in a hidden tab.
        setTimeout(markByScroll, 120);
    }, { passive: true });

    show('reception');
    if (location.hash.length > 1) {
        var first = location.hash.slice(1);
        go(first);
        // Images above the target are still loading at this point.
        window.addEventListener('load', function () {
            if (location.hash.slice(1) === first && isOpen) go(first);
        });
    }

    // ==================================================================
    // The Wingate bay
    // ==================================================================
    var screenEl = document.getElementById('lab-wg-screen');
    var goBtn = document.getElementById('lab-wg-go');
    var demoBtn = document.getElementById('lab-wg-demo');
    var soundBtn = document.getElementById('lab-wg-sound');
    var paper = document.getElementById('lab-wg-paper');
    var roll = document.getElementById('lab-wg-roll');
    var status = document.getElementById('lab-wg-status');

    // Monark arithmetic: 7.5% of body mass on the basket, 6 m of flywheel
    // rim per pedal revolution. One tap is a quarter of a revolution, which
    // puts fast two-finger tapping (8 to 10 a second) at 120 to 150 rpm.
    var MASS = 75;
    var LOAD = MASS * 0.075;                       // kg
    var REV_PER_TAP = 0.25;
    var WATTS_PER_TAP = LOAD * 9.81 * 6 * REV_PER_TAP;   // per tap per second
    var DURATION = 30;
    var COLS = 40;

    var phase = 'menu';       // menu | count | run | print
    var demo = false;
    var perSec = [];
    var tapTimes = [];
    var t0 = 0;
    var timer = null;
    var job = 0;              // bumped to cancel a print in progress
    wingateBusy = function () { return phase === 'count' || phase === 'run'; };

    var soundOn = true;
    try { soundOn = localStorage.getItem('lab_printer_sound') !== 'off'; } catch (e) { /* private mode */ }

    function padL(v, n) { v = String(v); while (v.length < n) v = ' ' + v; return v; }
    function padR(v, n) { v = String(v); while (v.length < n) v += ' '; return v; }
    function centre(v) { return padL('', Math.max(0, Math.floor((COLS - v.length) / 2))) + v; }
    function c(colour, text) { return '<span class="t-' + colour + '">' + esc(text) + '</span>'; }

    function draw(lines) {
        screenEl.innerHTML = lines.map(function (l) {
            return '<div>' + (l || ' ') + '</div>';
        }).join('');
    }

    function drawMenu(note) {
        draw([
            c('w', 'BBC Computer 32K'),
            '',
            c('w', 'Acorn DFS'),
            '',
            c('w', 'BASIC'),
            '',
            c('w', '>CHAIN "WINGATE"'),
            '',
            c('y', centre('WINGATE ANAEROBIC TEST')),
            c('y', centre('======================')),
            '',
            c('c', ' 30 SECONDS. ALL OUT.'),
            c('c', ' LOAD ' + LOAD.toFixed(1) + ' KG (7.5% OF ' + MASS + ' KG)'),
            '',
            c('w', ' PEDAL WITH Z AND X, OR SPACE'),
            '',
            c('g', note || ' PRESS START WHEN READY') + '<b class="t-cursor">_</b>'
        ]);
    }

    // ---- sound ---------------------------------------------------------
    var actx = null, master = null, noiseBuf = null;

    function audio() {
        if (!soundOn) return null;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            if (!actx) {
                actx = new AC();
                master = actx.createGain();
                master.gain.value = 0.22;
                master.connect(actx.destination);
                noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
                var d = noiseBuf.getChannelData(0);
                for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { return null; }
        return actx;
    }

    // The BBC's VDU 7 bell: a plain square wave.
    function beep(freq, dur) {
        var ac = audio();
        if (!ac) return;
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        g.gain.value = 0.25;
        o.connect(g); g.connect(master);
        o.start();
        o.stop(ac.currentTime + dur);
    }

    function burst(ac, t, dur, freq, level) {
        var n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        n.buffer = noiseBuf;
        f.type = 'lowpass';
        f.frequency.value = freq;
        g.gain.setValueAtTime(level, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        n.connect(f); f.connect(g); g.connect(master);
        n.start(t, Math.random() * 0.5);
        n.stop(t + dur + 0.02);
    }

    // One printed line. The head fires a column of pins about six times per
    // character, which is the buzz; spaces are silence, which is the rhythm.
    // Then the carriage comes back and the platen ratchets up a line.
    function lineSound(ac, text, charMs) {
        var t = ac.currentTime + 0.02;
        var step = charMs / 1000;
        var end = t + text.length * step;

        if (text.length) {
            var gate = ac.createGain();
            gate.gain.value = 0;
            gate.connect(master);

            var pins = ac.createOscillator(), pg = ac.createGain();
            pins.type = 'square';
            pins.frequency.value = 6000 / charMs;
            pg.gain.value = 0.3;
            pins.connect(pg); pg.connect(gate);

            var hiss = ac.createBufferSource(), bp = ac.createBiquadFilter();
            hiss.buffer = noiseBuf;
            hiss.loop = true;
            bp.type = 'bandpass';
            bp.frequency.value = 3400;
            bp.Q.value = 0.9;
            hiss.connect(bp); bp.connect(gate);

            for (var i = 0; i < text.length; i++) {
                var ch = text.charAt(i);
                var ink = ch === ' ' ? 0 : (/[#=WM8B@]/.test(ch) ? 1 : (/[.\-:,']/.test(ch) ? 0.45 : 0.75));
                gate.gain.setValueAtTime(ink, t + i * step);
            }
            gate.gain.setValueAtTime(0, end);
            pins.start(t); pins.stop(end + 0.01);
            hiss.start(t); hiss.stop(end + 0.01);
        }
        burst(ac, end + 0.005, 0.07, 900, 0.5);    // carriage return
        burst(ac, end + 0.045, 0.05, 260, 0.9);    // line feed
    }

    // ---- printer -------------------------------------------------------
    var CHAR_MS = 14;
    var FEED_MS = 95;

    function print(lines, done) {
        var mine = ++job;
        roll.innerHTML = '';
        paper.classList.remove('is-torn');
        paper.classList.add('is-printing');

        function finish() {
            paper.classList.remove('is-printing');
            paper.classList.add('is-torn');
            done();
        }

        if (reduced) {
            lines.forEach(function (text) {
                var row = document.createElement('div');
                row.textContent = text || ' ';
                roll.appendChild(row);
            });
            finish();
            return;
        }

        var i = 0;
        function next() {
            if (mine !== job) return;
            if (i >= lines.length) { finish(); return; }
            var text = lines[i++].replace(/\s+$/, '');
            var row = document.createElement('div');
            var ink = document.createElement('span');
            var head = document.createElement('i');
            head.className = 'lab-wg-head';
            row.appendChild(ink);
            row.appendChild(head);
            roll.appendChild(row);

            var ac = audio();
            if (ac) lineSound(ac, text, CHAR_MS);

            var started = Date.now();
            // setInterval on wall-clock time: a background tab throttles
            // timers but the printout still finishes, where rAF would stall.
            var iv = setInterval(function () {
                if (mine !== job) { clearInterval(iv); return; }
                var n = Math.min(text.length, Math.floor((Date.now() - started) / CHAR_MS));
                ink.textContent = text.slice(0, n);
                if (n >= text.length) {
                    clearInterval(iv);
                    row.removeChild(head);
                    if (!text) ink.textContent = ' ';
                    setTimeout(next, FEED_MS);
                }
            }, 16);
        }
        next();
    }

    // ---- the test ------------------------------------------------------
    function stopTimer() {
        if (timer) { clearInterval(timer); timer = null; }
    }

    function setButtons() {
        var busy = phase === 'count' || phase === 'run';
        goBtn.textContent = (phase === 'run' && !demo) ? 'PEDAL!' : (busy ? (demo ? 'Demo running' : 'Get ready') : 'Start the test');
        goBtn.classList.toggle('is-pedal', phase === 'run' && !demo);
        demoBtn.disabled = busy;
        demoBtn.hidden = busy;
        soundBtn.hidden = busy;
    }

    function start(asDemo) {
        job++;                      // cancels any printout still running
        stopTimer();
        demo = asDemo;
        perSec = [];
        tapTimes = [];
        for (var i = 0; i < DURATION; i++) perSec.push(0);
        if (demo) {
            // A typical shape: peak inside three seconds, then a steady
            // slide. Simulated, and the printout says so.
            for (var s = 0; s < DURATION; s++) {
                var base = s < 2 ? 8.8 + 1.3 * s : 11.4 - (s - 2) * 0.16;
                perSec[s] = Math.max(0, base + (Math.random() - 0.5) * 0.5);
            }
        }
        audio();                    // unlock on the user gesture
        phase = 'count';
        setButtons();
        status.textContent = demo ? 'Demo trace running.' : 'Test starting in three seconds.';
        var n = demo ? 1 : 3;
        function tick() {
            if (n === 0) { run(); return; }
            draw(['', '', '', '', '', '', c('y', centre(demo ? 'DEMO TRACE' : 'GET READY')), '', '',
                c('w', centre(String(n))), '', '', c('c', centre(demo ? 'SIMULATED RIDER' : 'FINGERS ON Z AND X'))]);
            beep(440, 0.12);
            n--;
            timer = setTimeout(tick, demo ? 500 : 900);
        }
        tick();
    }

    function elapsed() {
        // The demo plays at six times speed: nobody wants to watch thirty
        // seconds of somebody else's test.
        return (Date.now() - t0) / 1000 * (demo ? 6 : 1);
    }

    function run() {
        phase = 'run';
        t0 = Date.now();
        setButtons();
        beep(880, 0.35);
        timer = setInterval(wgFrame, 50);
        wgFrame();
    }

    function tap() {
        if (phase !== 'run' || demo) return;
        var t = elapsed();
        if (t >= DURATION) return;
        perSec[Math.floor(t)]++;
        tapTimes.push(t);
    }

    function wgFrame() {
        var t = elapsed();
        if (t >= DURATION) { finish(); return; }
        var sec = Math.floor(t);
        var rate;
        if (demo) {
            rate = perSec[sec];
        } else {
            while (tapTimes.length && tapTimes[0] < t - 1) tapTimes.shift();
            rate = t < 1 ? tapTimes.length / Math.max(t, 0.25) : tapTimes.length;
        }
        var top = 1000;
        for (var i = 0; i < sec; i++) top = Math.max(top, Math.ceil(perSec[i] * WATTS_PER_TAP / 500) * 500);

        var lines = [
            c('y', 'WINGATE TEST') + c('w', padL('TIME ' + padL(t.toFixed(1), 4) + ' S', COLS - 12)),
            '',
            c('c', 'RPM ') + c('w', padL(Math.round(rate * REV_PER_TAP * 60), 3)) +
                c('c', '     WATTS ') + c('w', padL(Math.round(rate * WATTS_PER_TAP), 4)),
            ''
        ];
        var ROWS = 8;
        for (var r = ROWS; r >= 1; r--) {
            var label = r === ROWS ? padL(top, 4) : (r === 1 ? '   0' : '    ');
            var bar = '';
            for (var s = 0; s < DURATION; s++) {
                var h = s < sec ? perSec[s] * WATTS_PER_TAP / top * ROWS : 0;
                bar += h >= r - 0.5 ? '█' : ' ';
            }
            lines.push(c('c', label + '│') + c('g', bar));
        }
        lines.push(c('c', '    └' + new Array(DURATION + 1).join('─')));
        lines.push(c('c', '     0    5    10   15   20   25   30'));
        lines.push('');
        lines.push(demo ? c('m', centre('DEMO TRACE: SIMULATED DATA'))
            : c(sec % 2 ? 'r' : 'y', centre(t > 24 ? 'KEEP GOING! NEARLY THERE!' : 'GO! GO! GO!')));
        draw(lines);
    }

    function finish() {
        stopTimer();
        phase = 'print';
        setButtons();
        beep(660, 0.5);

        var watts = perSec.map(function (n) { return n * WATTS_PER_TAP; });
        var total = watts.reduce(function (a, b) { return a + b; }, 0);
        if (!total) {
            phase = 'menu';
            setButtons();
            drawMenu(' NO REVS DETECTED. TRY AGAIN');
            status.textContent = 'No pedalling detected.';
            return;
        }
        // Peak and minimum are the best and worst 5 s blocks, the usual
        // Wingate convention; fatigue index is the drop between them.
        var seg = [];
        for (var i = 0; i < DURATION; i += 5) {
            seg.push(watts.slice(i, i + 5).reduce(function (a, b) { return a + b; }, 0) / 5);
        }
        var peak = Math.max.apply(null, seg);
        var min = Math.min.apply(null, seg);
        var mean = total / DURATION;
        var fi = peak ? (peak - min) / peak * 100 : 0;

        function row(label, w) {
            return padR(label, 20) + padL(Math.round(w), 5) + ' W ' + padL((w / MASS).toFixed(1), 5) + ' W/KG';
        }

        draw([
            c('y', centre('WINGATE TEST COMPLETE')),
            '',
            c('c', 'PEAK POWER     ') + c('w', padL(Math.round(peak), 5) + ' W ' + padL((peak / MASS).toFixed(1), 5) + ' W/KG'),
            c('c', 'MEAN POWER     ') + c('w', padL(Math.round(mean), 5) + ' W ' + padL((mean / MASS).toFixed(1), 5) + ' W/KG'),
            c('c', 'MINIMUM POWER  ') + c('w', padL(Math.round(min), 5) + ' W ' + padL((min / MASS).toFixed(1), 5) + ' W/KG'),
            c('c', 'FATIGUE INDEX  ') + c('w', padL(Math.round(fi), 5) + ' %'),
            '',
            demo ? c('m', 'DEMO TRACE: SIMULATED DATA') : '',
            '',
            c('g', '>*FX5,1'),
            c('g', '>VDU 2') + '<b class="t-cursor">_</b>',
            '',
            c('w', 'PRINTING...')
        ]);
        status.textContent = 'Test complete. Peak power ' + Math.round(peak) + ' watts, mean power ' +
            Math.round(mean) + ' watts, fatigue index ' + Math.round(fi) + ' percent.';

        var now = new Date();
        function two(n) { return (n < 10 ? '0' : '') + n; }
        var rule = new Array(COLS + 1).join('=');
        var out = [
            rule,
            centre('WINGATE ANAEROBIC TEST'),
            centre('30 S   LOAD ' + LOAD.toFixed(1) + ' KG   MASS ' + MASS + ' KG'),
            rule,
            'DATE    ' + two(now.getDate()) + '/' + two(now.getMonth() + 1) + '/' + String(now.getFullYear()).slice(2) +
                '        TIME ' + two(now.getHours()) + ':' + two(now.getMinutes()),
            'SUBJECT ' + (demo ? 'SIMULATED RIDER' : 'VISITOR'),
            'MODE    ' + (demo ? 'DEMO TRACE, NOT A REAL TEST' : 'KEYBOARD ERGOMETER'),
            '',
            row('PEAK POWER (5 S)', peak),
            row('MEAN POWER (30 S)', mean),
            row('MINIMUM POWER (5 S)', min),
            padR('FATIGUE INDEX', 20) + padL(Math.round(fi), 5) + ' %',
            ''
        ];
        seg.forEach(function (w, i) {
            var bars = Math.round(w / peak * 22);
            out.push(padL(i * 5, 2) + '-' + padL(i * 5 + 5, 2) + ' S ' +
                padR(new Array(bars + 1).join('#'), 23) + padL(Math.round(w), 5));
        });
        out.push('');
        if (demo) {
            out.push('SIMULATED DATA. NOBODY RODE THIS.');
            out.push('PRESS START AND RIDE YOUR OWN.');
        } else {
            out.push('NOT A CALIBRATED TEST. YOUR FINGERS');
            out.push('ARE NOT YOUR QUADRICEPS.');
        }
        out.push('');
        out.push('OPERATOR: A. RUDDOCK');
        out.push(new Array(COLS + 1).join('-'));
        out.push('');

        print(out, function () {
            phase = 'menu';
            setButtons();
            goBtn.textContent = demo ? 'Start the test' : 'Go again';
        });
    }

    // Start is a click; pedalling is pointerdown, which fires on contact
    // rather than on release and so keeps up with fast tapping.
    goBtn.addEventListener('click', function () {
        if (phase === 'menu' || phase === 'print') start(false);
    });
    goBtn.addEventListener('pointerdown', function (e) {
        if (phase === 'run' && !demo) { e.preventDefault(); tap(); }
    });
    demoBtn.addEventListener('click', function () {
        if (phase === 'menu' || phase === 'print') start(true);
    });

    function syncSound() {
        soundBtn.setAttribute('aria-pressed', String(soundOn));
        soundBtn.textContent = 'Printer sound: ' + (soundOn ? 'on' : 'off');
    }
    soundBtn.addEventListener('click', function () {
        soundOn = !soundOn;
        try { localStorage.setItem('lab_printer_sound', soundOn ? 'on' : 'off'); } catch (e) { /* private mode */ }
        if (!soundOn && actx) { try { actx.suspend(); } catch (e) { /* already closed */ } }
        syncSound();
    });

    // Keys are only claimed while a test is on, so Space scrolls the page
    // the rest of the time.
    document.addEventListener('keydown', function (e) {
        if (phase !== 'count' && phase !== 'run') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var k = e.key;
        if (k === 'Escape') {
            stopTimer();
            clearTimeout(timer);
            phase = 'menu';
            setButtons();
            drawMenu(' ESCAPE. PRESS START WHEN READY');
            return;
        }
        if (k === ' ' || k === 'z' || k === 'Z' || k === 'x' || k === 'X') {
            e.preventDefault();
            if (!e.repeat) tap();
        }
    });

    syncSound();
    setButtons();
    drawMenu();
})();
