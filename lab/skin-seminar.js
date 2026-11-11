/* lab/skin-seminar.js: decorative extras for this room, registered with
   window.LabSkin.decor("seminar", builder). Decoration only: aria-hidden, no
   text nodes of their own (the ON AIR letters are drawn by CSS from
   data-text). Each element is hidden by default; lab/skin-seminar.css shows
   it only inside the live, skinned Seminar Room. */
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

    window.LabSkin.decor('seminar', function () {
        // the bookshelf: a mortarboard on top, a few unlettered books in the short bay
        var phds = document.querySelector('#phds > .container');
        add(phds, 'lab-skin-cap');
        var bay = document.querySelector('#phds .phd-column');
        var lean = add(bay, 'lab-skin-lean');
        if (lean) {
            // three shelves' worth: upright books, a pile lying flat, a few more
            var rows = [
                [['#7a1f2b', 86], ['#2e3f55', 74], ['#3d5a45', 92], ['#1d1d1f', 80], ['#5a2a6e', 70], ['#8a5a1a', 88], ['#1f4f6f', 76], ['#7a1f2b', 82, 1]],
                [['pile'], ['#3d5a45', 84], ['#7a1f2b', 96], ['#1f3a5f', 78], ['#5a2a6e', 90]],
                [['#1f4f6f', 90], ['#8a5a1a', 76], ['#2e3f55', 94], ['#7a1f2b', 82], ['#1d1d1f', 88, 1]]
            ];
            rows.forEach(function (r) {
                var row = el('div', 'lab-skin-row');
                r.forEach(function (s) {
                    if (s[0] === 'pile') {
                        var pile = el('span', 'is-pile');
                        [['#2e3f55', '100%', '0px'], ['#7a1f2b', '92%', '6px'], ['#2f5d3a', '96%', '2px']].forEach(function (b) {
                            var i = el('i');
                            i.style.setProperty('--c', b[0]);
                            i.style.setProperty('--w', b[1]);
                            i.style.setProperty('--o', b[2]);
                            pile.appendChild(i);
                        });
                        row.appendChild(pile);
                        return;
                    }
                    var b = el('span', s[2] ? 'is-tilt' : '');
                    b.style.setProperty('--c', s[0]);
                    b.style.setProperty('--h', s[1] + 'px');
                    row.appendChild(b);
                });
                lean.appendChild(row);
            });
        }

        // the projector screen: projector on its rod, the light cone, the pull cord
        var talks = document.querySelector('#talks');
        var tc = document.querySelector('#talks > .container');
        if (talks && tc) {
            add(talks, 'lab-skin-cone', tc);
            add(talks, 'lab-skin-proj', tc);
            add(tc, 'lab-skin-ring');
        }

        // the TV: ON AIR sign above it, the boom mic at its corner
        var media = document.querySelector('#media > .container');
        var on = add(media, 'lab-skin-onair');
        if (on) on.setAttribute('data-text', 'ON AIR');
        add(media, 'lab-skin-boom');
    });
})();
