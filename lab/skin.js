/* LabSkin: dresses the lab drawer as part of the illustrated room for the
 * rooms that have a skin. Classic script, one global (window.LabSkin).
 * Optional: if it fails to load, the drawer keeps its plain look.
 *
 * What it does, and all it does:
 *   1. Mirrors the drawer's data-current (set by lab.js) into data-skin when
 *      that room has a skin, and removes data-skin when it does not. Every
 *      skin rule in lab/skin.css and lab/skin-<room>.css is scoped under
 *      .lab-live:not(.lab-linear) .lab-drawer[data-skin], so "Read as one
 *      page", print and the unskinned rooms are never touched.
 *   2. Adds a few purely decorative elements a room's skin needs (Reception:
 *      a staff ID card on the noticeboard). They carry aria-hidden="true" and
 *      the hidden attribute; only the skin CSS ever displays them, so outside
 *      the live skinned drawer they do not exist on screen. They hold no text
 *      nodes: names are drawn by CSS from data attributes, so find-in-page and
 *      copy never see a second copy of anything.
 *
 * Never changes wording, numbers or links.
 *
 * To skin another room: add its key to SKINS below, write lab/skin-<key>.css
 * scoped under .lab-live:not(.lab-linear) .lab-drawer[data-skin][data-current="<key>"],
 * and (only if it needs decorative DOM) add a builder to DECOR.
 */
(function () {
    'use strict';

    // room key -> skin name. The shell (lab/skin.css) is shared by every skin.
    var SKINS = { reception: 'night', lab: 'night', office: 'night',
                  print: 'night', seminar: 'night', desk: 'night' };

    function el(tag, cls) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }
    function deco(e) {
        e.setAttribute('aria-hidden', 'true');
        e.setAttribute('data-lab-skin-deco', '');
        e.hidden = true;
        return e;
    }

    // Decorative extras per room. Each builder runs once and must be safe to
    // run when its target is missing.
    var DECOR = {
        reception: function () {
            var about = document.querySelector('#about .about-content');
            if (!about || about.querySelector('.lab-skin-idcard')) return;
            var photo = document.querySelector('.hero .profile-image');
            var name = document.querySelector('.hero h1');
            var title = document.querySelector('.hero .hero-title');
            if (!photo || !name) return;

            // "Associate Professor ... | Sheffield Hallam University, UK"
            var parts = (title ? title.textContent : '').split('|');
            var card = deco(el('div', 'lab-skin-idcard'));
            var nm = el('span', 'lab-skin-idname');
            nm.setAttribute('data-text', name.textContent.trim());
            var role = el('span', 'lab-skin-idrole');
            role.setAttribute('data-text', (parts[0] || '').trim());
            var org = el('span', 'lab-skin-idorg');
            org.setAttribute('data-text', (parts[1] || '').trim());

            var img = el('img', 'lab-skin-idphoto');
            img.alt = '';
            img.decoding = 'async';
            img.src = photo.currentSrc || photo.src;
            card.appendChild(el('span', 'lab-skin-idband'));
            card.appendChild(img);
            card.appendChild(nm);
            card.appendChild(role);
            card.appendChild(org);
            card.appendChild(el('span', 'lab-skin-idbar'));
            about.insertBefore(card, about.firstChild);
        }
    };

    var drawer = null;
    var built = {};

    function sync() {
        if (!drawer) return;
        var key = drawer.getAttribute('data-current');
        var skin = key && Object.prototype.hasOwnProperty.call(SKINS, key) ? SKINS[key] : null;
        if (skin) {
            if (!built[key] && DECOR[key]) {
                built[key] = true;
                try { DECOR[key](); } catch (e) { /* decoration only */ }
            }
            if (drawer.getAttribute('data-skin') !== skin) drawer.setAttribute('data-skin', skin);
        } else if (drawer.hasAttribute('data-skin')) {
            drawer.removeAttribute('data-skin');
        }
    }

    function init() {
        drawer = document.querySelector('article.lab-drawer');
        if (!drawer) return false;
        sync();
        if (window.MutationObserver) {
            new MutationObserver(sync).observe(drawer, { attributes: true, attributeFilter: ['data-current'] });
        }
        return true;
    }

    // lab.js builds the drawer synchronously at the end of <body>; this file
    // loads straight after it, but wait for DOMContentLoaded in case it ever
    // moves.
    if (!init()) document.addEventListener('DOMContentLoaded', init);

    window.LabSkin = {
        skins: SKINS,
        refresh: sync,
        // A room's own file (lab/skin-<key>.js) registers its decorative
        // extras here, so rooms do not have to share this file.
        decor: function (key, builder) {
            DECOR[key] = builder;
            built[key] = false;
            sync();
        },
        el: el,
        deco: deco
    };
})();
