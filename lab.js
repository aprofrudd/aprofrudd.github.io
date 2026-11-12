/* The lab: turns the linear homepage into a room you can walk around. The
   illustration is lab/scene.js, the content entrance
   effects lab/exhibits.js; this file groups the sections into rooms, runs
   the drawer and the routing.

   Progressive enhancement only. index.html stays a plain linear page of
   <section>s: with this script missing or failing, that is exactly what
   loads, and it is what crawlers read. Everything the lab adds (the plan,
   the room headers) is built here at run time.

   Loaded as a classic script at the end of <body>, so it runs before first
   paint and the linear page does not flash. */
(function () {
    'use strict';

    var main = document.querySelector('main');
    var article = document.querySelector('main article');
    if (!main || !article) return;

    // ------------------------------------------------------------------
    // Rooms: which sections live in which bay of the lab.
    // ------------------------------------------------------------------
    var ROOMS = [
        { key: 'reception', name: 'Reception', sections: ['at-a-glance', 'about', 'now'] },
        { key: 'lab', name: 'Performance Lab', sections: ['applied-projects', 'capability', 'collaboration', 'software'] },
        { key: 'office', name: 'Office', sections: ['experience', 'education', 'skills'] },
        { key: 'print', name: 'Print Room', sections: ['publications', 'grants'] },
        { key: 'seminar', name: 'Seminar Room', sections: ['phds', 'talks', 'media'] },
        { key: 'desk', name: 'Front Desk', sections: ['available', 'faq', 'contact'] }
    ];

    var LABELS = {
        'at-a-glance': 'At a glance', 'about': 'About', 'now': 'Right now',
        'applied-projects': 'Projects', 'capability': 'Capability',
        'collaboration': 'Collaborations', 'software': 'Software',
        'experience': 'Experience', 'education': 'Education', 'skills': 'Skills',
        'publications': 'Publications', 'grants': 'Grants',
        'phds': 'PhDs', 'talks': 'Talks', 'media': 'Media',
        'available': 'Work with me', 'faq': 'FAQ', 'contact': 'Contact'
    };

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

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
    // The lab, after hours: one illustrated room (lab/scene.js). The kit in
    // it links to sections; the camera walks to a bay when its room opens.
    // ------------------------------------------------------------------
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function byKey(key) {
        for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].key === key) return ROOMS[i];
        return null;
    }

    var plan = document.createElement('nav');
    plan.id = 'lab-plan';
    plan.className = 'lab-plan';
    plan.setAttribute('aria-label', 'The lab');
    plan.tabIndex = -1;
    plan.innerHTML =
        '<div class="lab-stage" id="lab-stage"></div>' +
        '<div class="lab-plan-bar">' +
            '<p class="lab-plan-kicker"><i></i>The lab, after hours</p>' +
            '<p class="lab-plan-hint">Click the kit to read the CV. Try the lamp, the bag and the bell.</p>' +
            '<button type="button" class="lab-pill lab-all-toggle" id="lab-all" aria-pressed="false">Read as one page</button>' +
        '</div>';
    main.insertBefore(plan, article);
    var stage = plan.querySelector('#lab-stage');

    var scene = null;
    try {
        if (window.LabScene) {
            scene = window.LabScene.mount(stage, {
                reduced: reduced
            });
            scene.play(true);
        }
    } catch (e) { scene = null; }
    if (!scene) {
        // The illustration did not load: the rooms are still one click away.
        stage.className = 'lab-stage lab-stage-plain';
        stage.innerHTML = ROOMS.map(function (room) {
            return '<a href="#room-' + room.key + '"><span>' + room.num + '</span>' + esc(room.name) + '</a>';
        }).join('');
    }

    // How much of the stage the open drawer covers, so the camera can
    // centre the bay in what is left. Null when the drawer takes the screen.
    function inset() {
        var s = stage.getBoundingClientRect(), d = article.getBoundingClientRect();
        var width = d.width, left = window.innerWidth - width;
        if (width > window.innerWidth * 0.8) return null;
        return { right: Math.max(0, s.right - left), bottom: 0 };
    }
    function camera() {
        if (!scene) return;
        var cover = isOpen ? inset() : null;
        scene.mark(isOpen || linear ? current : null);
        // Walk up to the object being read; fall back to the whole bay.
        var close = isOpen && cover && reading && scene.focusOn && scene.focusOn(reading, cover);
        if (!close) scene.focus(isOpen && cover ? current : null, cover || { right: 0, bottom: 0 });
        if (scene.markObject) scene.markObject(isOpen && cover ? reading : null);
    }

    // Which section of the open room is being read: the one under a line a
    // third of the way down the drawer. The camera follows it.
    var reading = null;
    var trackPending = false;
    function trackReading() {
        trackPending = false;
        if (!isOpen || linear) return;
        var room = byKey(current);
        var box = article.getBoundingClientRect();
        var probe = box.top + box.height * 0.35;
        var found = null;
        room.sections.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top <= probe) found = id;
        });
        found = found || room.sections[0];
        if (found !== reading) {
            reading = found;
            if (scene && scene.visited) scene.visited(reading);
            camera();
        }
    }
    article.addEventListener('scroll', function () {
        if (trackPending) return;
        trackPending = true;
        setTimeout(trackReading, 140);
    }, { passive: true });
    window.addEventListener('resize', function () { if (isOpen) camera(); });


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

    // ------------------------------------------------------------------
    // Which room is open
    // ------------------------------------------------------------------
    var current = 'reception';
    var isOpen = false;
    var linear = false;             // "Read as one page"
    var allToggle = document.getElementById('lab-all');
    var root = document.documentElement;

    function show(key) {
        current = key;
        // Room skins (lab/skin-*.css) style the drawer by the room it holds.
        article.setAttribute('data-current', key);
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
        show(current);
        // The stage changes size with the drawer; let the scene re-measure.
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }
        camera();
        if (isOpen && window.LabExhibits) {
            try { window.LabExhibits.enter(byKey(current).el); } catch (e) { /* decoration only */ }
        }
    }

    function closeDrawer() {
        if (!isOpen) return;
        setOpen(false);
        try { history.pushState(null, '', location.pathname + location.search); } catch (e) { /* sandboxed */ }
        plan.focus({ preventScroll: true });
    }

    ROOMS.forEach(function (room) {
        room.el.addEventListener('beforematch', function () { current = room.key; setOpen(true); });
    });
    // Tabbing into the drawer while it is off screen brings it on.
    article.addEventListener('focusin', function () { if (!isOpen && !linear) setOpen(true); });

    // A room's skin, fonts and decorations change heights just after it
    // opens, which leaves a deep link a little off its target. Re-align
    // twice, unless the reader has already started scrolling.
    var settleToken = 0;
    function settle(el) {
        var mine = ++settleToken;
        var room = el.closest('.lab-room');
        var watcher = null;
        function done() {
            if (watcher) { watcher.disconnect(); watcher = null; }
        }
        function cancel() { if (mine === settleToken) settleToken++; done(); }
        function align() {
            if (mine !== settleToken || !isOpen || linear) { done(); return; }
            var pad = parseFloat(getComputedStyle(article).scrollPaddingTop) || 0;
            var off = el.getBoundingClientRect().top - article.getBoundingClientRect().top - pad;
            if (Math.abs(off) > 4) article.scrollTop += off;
        }
        article.addEventListener('wheel', cancel, { passive: true, once: true });
        article.addEventListener('touchmove', cancel, { passive: true, once: true });
        article.addEventListener('keydown', cancel, { once: true });
        // Sections above the target keep changing height for a while (fonts,
        // decorations, the collaboration figure arriving from the network),
        // so follow every resize of the room for a few seconds.
        if (window.ResizeObserver && room) {
            watcher = new ResizeObserver(align);
            watcher.observe(room);
            Array.prototype.forEach.call(room.children, function (child) { watcher.observe(child); });
        }
        [120, 350, 1100, 2000].forEach(function (ms) { setTimeout(align, ms); });
        setTimeout(function () { if (mine === settleToken) done(); }, 4000);
    }

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
        var sec = el === wrap ? null : el.closest('section');
        reading = sec ? sec.id : byKey(current).sections[0];
        setOpen(true);
        if (scene && scene.visited) scene.visited(reading);
        if (linear) el.scrollIntoView();
        else if (el === wrap) article.scrollTop = 0;
        else {
            el.scrollIntoView({ block: 'start' });
            settle(el);
        }
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
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) closeDrawer();
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
        if (linear) markByScroll();
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
})();
