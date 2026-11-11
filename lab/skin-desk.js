/* lab/skin-desk.js: decorative extras for this room, registered with
   window.LabSkin.decor("desk", builder). Decoration only: aria-hidden, no
   text nodes of their own (the OPEN letters are drawn by CSS from data-text).
   Each element is hidden by default; lab/skin-desk.css shows it only inside
   the live, skinned Front Desk. */
(function () {
    'use strict';
    if (!window.LabSkin) return;
    var el = window.LabSkin.el;
    var deco = window.LabSkin.deco;

    function add(parent, cls, before) {
        if (!parent || parent.querySelector('.' + cls)) return null;
        var d = deco(el('div', cls));
        if (before) parent.insertBefore(d, before);
        else parent.appendChild(d);
        return d;
    }

    window.LabSkin.decor('desk', function () {
        // the counter: service bell and OPEN plaque standing on the back edge
        var av = document.querySelector('#available > .container');
        var grid = document.querySelector('#available .available-grid');
        if (av && grid) {
            add(av, 'lab-skin-bell', grid);
            var open = add(av, 'lab-skin-open', grid);
            if (open) open.setAttribute('data-text', 'OPEN');
        }

        // the telephone: handset and coiled cord on the left of the body
        var phone = document.querySelector('#contact .social-links');
        add(phone, 'lab-skin-handset');
        add(phone, 'lab-skin-cord');
    });
})();
