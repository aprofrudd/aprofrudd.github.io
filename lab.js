/* The lab: turns the linear homepage into a floor plan of rooms, and adds the
   Wingate bay (a BBC Micro and a dot matrix printer).

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
    // The floor plan
    // ------------------------------------------------------------------
    var plan = document.createElement('nav');
    plan.id = 'lab-plan';
    plan.className = 'lab-plan';
    plan.setAttribute('aria-label', 'Lab floor plan');
    plan.innerHTML =
        '<div class="container">' +
            '<div class="lab-plan-title">' +
                '<p class="lab-plan-kicker">Floor plan</p>' +
                '<p class="lab-plan-hint">Seven rooms. Pick a door.</p>' +
            '</div>' +
            '<div class="lab-plan-grid">' +
                ROOMS.map(function (room) {
                    var inside = room.sections.filter(function (id) { return claimed[id]; });
                    return '<div class="lab-tile lab-tile-' + room.key + '" data-room="' + room.key + '">' +
                        (room.key === 'ergo'
                            ? '<span class="lab-tile-crt" aria-hidden="true">&gt;CHAIN "WINGATE"<b>_</b></span>'
                            : art(room.art)) +
                        '<span class="lab-tile-num">' + room.num + '</span>' +
                        '<a class="lab-tile-name" href="#room-' + room.key + '">' + esc(room.name) + '</a>' +
                        '<span class="lab-tile-sport">' + esc(room.sport) + '</span>' +
                        '<span class="lab-tile-inside">' +
                            inside.map(function (id) {
                                return '<a href="#' + id + '">' + esc(LABELS[id] || id) + '</a>';
                            }).join('') +
                        '</span>' +
                        '<span class="lab-tile-here" aria-hidden="true">You are here</span>' +
                    '</div>';
                }).join('') +
                '<div class="lab-corridor">' +
                    '<span aria-hidden="true">Corridor</span>' +
                    '<button type="button" class="lab-all-toggle" id="lab-all" aria-pressed="false">Open every door</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    main.insertBefore(plan, article);

    ROOMS.forEach(function (room) {
        room.tile = plan.querySelector('.lab-tile[data-room="' + room.key + '"]');
        room.tileLink = room.tile.querySelector('.lab-tile-name');
    });

    // The top nav lists rooms instead of sixteen sections.
    var navMenu = document.querySelector('.nav-menu');
    var navToggle = document.querySelector('.nav-toggle');
    if (navMenu) {
        navMenu.innerHTML = ROOMS.map(function (room) {
            return '<li><a href="#room-' + room.key + '" data-room="' + room.key + '">' + esc(room.name) + '</a></li>';
        }).join('') + '<li><a href="/vo2max/">Learning</a></li>';
        navMenu.classList.add('lab-nav');
        ROOMS.forEach(function (room) {
            room.navLink = navMenu.querySelector('a[data-room="' + room.key + '"]');
        });
    }

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
    var allOpen = false;
    var allToggle = document.getElementById('lab-all');

    function show(key) {
        current = key;
        ROOMS.forEach(function (room) {
            var here = room.key === key;
            if (allOpen || here) {
                room.el.removeAttribute('hidden');
            } else {
                // until-found keeps a closed room reachable by find-in-page;
                // browsers without it treat the attribute as plain hidden.
                room.el.setAttribute('hidden', 'until-found');
            }
            room.tile.classList.toggle('is-here', here);
            if (here) room.tileLink.setAttribute('aria-current', 'location');
            else room.tileLink.removeAttribute('aria-current');
            if (room.navLink) room.navLink.classList.toggle('is-current', here);
        });
    }

    ROOMS.forEach(function (room) {
        room.el.addEventListener('beforematch', function () { show(room.key); });
    });

    // Open whichever room holds #id and scroll to it. False when the id is
    // not something the lab owns, so the browser handles the link itself.
    function go(id, focus) {
        if (id === 'lab-plan') {
            plan.scrollIntoView();
            return true;
        }
        var el = id && document.getElementById(id);
        var wrap = el && el.closest('.lab-room');
        if (!wrap) return false;
        show(wrap.getAttribute('data-room'));
        el.scrollIntoView();
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
        if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    });

    window.addEventListener('popstate', function () {
        if (!go(location.hash.slice(1))) { show('reception'); }
    });

    allToggle.addEventListener('click', function () {
        allOpen = !allOpen;
        allToggle.setAttribute('aria-pressed', String(allOpen));
        allToggle.textContent = allOpen ? 'Close the doors' : 'Open every door';
        plan.classList.toggle('is-all', allOpen);
        show(current);
        if (allOpen) markByScroll();
    });

    // With every door open the page is one long walk again, so "you are
    // here" follows the scroll position.
    var marking = false;
    function markByScroll() {
        marking = false;
        if (!allOpen) return;
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
        if (!allOpen || marking) return;
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
            if (location.hash.slice(1) === first) go(first);
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
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        timer = setInterval(frame, 50);
        frame();
    }

    function tap() {
        if (phase !== 'run' || demo) return;
        var t = elapsed();
        if (t >= DURATION) return;
        perSec[Math.floor(t)]++;
        tapTimes.push(t);
    }

    function frame() {
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
