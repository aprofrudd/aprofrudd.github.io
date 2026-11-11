/* lab/skin-print.js: decorative extras for this room, registered with
   window.LabSkin.decor("print", builder). Decoration only: aria-hidden, no text nodes.

   The safe's combination dial, set into the top-right of the door
   (#grants). Hidden by default; only lab/skin-print.css shows it, and only
   in the live, skinned drawer while it holds the Print Room. */
(function () {
    'use strict';
    if (!window.LabSkin) return;

    window.LabSkin.decor('print', function () {
        var door = document.querySelector('#grants > .container');
        if (!door || door.querySelector('.lab-skin-pr-dial')) return;
        var dial = window.LabSkin.deco(window.LabSkin.el('div', 'lab-skin-pr-dial'));
        door.insertBefore(dial, door.firstChild);
    });
})();
