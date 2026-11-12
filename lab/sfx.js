/* LabSfx: synthesised WebAudio sound effects for the lab homepage.
 * Classic script, one global (window.LabSfx). No audio files. Optional: if this
 * file fails to load, nothing else depends on it.
 *
 *   LabSfx.play(name)       switch click beep thud whirr bell slurp paper squeak ring pop
 *   LabSfx.setEnabled(b) / LabSfx.isEnabled()   persisted as localStorage "lab_sound"
 *   LabSfx.ambient(b)       a very quiet bed of rain on a window
 *
 * The AudioContext is never created before a pointerdown or keydown.
 * One master gain, one shared noise buffer, oscillators and filtered noise.
 */
(function () {
    'use strict';

    var MASTER = 0.2;      // overall level; every voice peaks well below 1 before this
    var AMBIENT = 0.5;     // ambient bed gain, relative to master
    var KEY = 'lab_sound';

    var enabled = true;
    try { if (window.localStorage.getItem(KEY) === 'off') enabled = false; } catch (e) {}

    var actx = null, master = null, noiseBuf = null;
    var unlocked = false;
    var wantAmbient = false;
    var amb = null;            // running ambient graph, or null
    var dropTimer = 0, wobbleTimer = 0;

    // ---- helpers --------------------------------------------------------
    function makeNoise(ac) {
        var b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        var d = b.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    // A pitched voice with an attack/decay envelope and optional pitch glide.
    function tone(ac, out, o) {
        var osc = ac.createOscillator(), g = ac.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, o.t);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, o.t + (o.glide || o.dur));
        var a = o.attack || 0.004;
        g.gain.setValueAtTime(0.0001, o.t);
        g.gain.linearRampToValueAtTime(o.peak, o.t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
        osc.connect(g); g.connect(out);
        osc.start(o.t); osc.stop(o.t + o.dur + 0.02);
        return osc;
    }

    // Filtered noise with an attack/decay envelope and optional filter sweep.
    function noise(ac, nb, out, o) {
        var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = nb;
        f.type = o.type || 'lowpass';
        f.frequency.setValueAtTime(o.f, o.t);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.dur);
        f.Q.value = o.q || 0.7;
        var a = o.attack || 0.002;
        g.gain.setValueAtTime(0.0001, o.t);
        g.gain.linearRampToValueAtTime(o.peak, o.t + a);
        if (o.hold) g.gain.setValueAtTime(o.peak, o.t + o.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
        src.connect(f); f.connect(g); g.connect(out);
        src.start(o.t, Math.random() * 0.5);
        src.stop(o.t + o.dur + 0.02);
    }

    // ---- the voices -----------------------------------------------------
    var voices = {
        // light switch: a sharp plastic click, then a low thunk in the wall
        'switch': function (ac, t, out, nb) {
            noise(ac, nb, out, { t: t, dur: 0.012, f: 3000, type: 'highpass', peak: 0.55 });
            noise(ac, nb, out, { t: t + 0.014, dur: 0.01, f: 4500, type: 'bandpass', q: 2, peak: 0.3 });
            tone(ac, out, { t: t + 0.006, f: 150, f2: 55, dur: 0.09, peak: 0.55 });
        },
        // soft UI tick
        'click': function (ac, t, out, nb) {
            tone(ac, out, { t: t, f: 1900, f2: 1300, dur: 0.028, peak: 0.4, type: 'triangle' });
            noise(ac, nb, out, { t: t, dur: 0.008, f: 5000, type: 'highpass', peak: 0.08 });
        },
        // instrument beep, ~1 kHz, 120 ms
        'beep': function (ac, t, out) {
            var osc = ac.createOscillator(), g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 1000;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.35, t + 0.006);
            g.gain.setValueAtTime(0.35, t + 0.1);
            g.gain.linearRampToValueAtTime(0.0001, t + 0.12);
            osc.connect(g); g.connect(out);
            osc.start(t); osc.stop(t + 0.14);
        },
        // glove on a heavy bag: low, dead, no ring
        'thud': function (ac, t, out, nb) {
            tone(ac, out, { t: t, f: 95, f2: 38, dur: 0.16, peak: 0.9, attack: 0.003 });
            noise(ac, nb, out, { t: t, dur: 0.05, f: 450, f2: 150, peak: 0.55 });
            noise(ac, nb, out, { t: t, dur: 0.02, f: 1800, peak: 0.12 });
        },
        // treadmill motor spinning up over ~1.2 s
        'whirr': function (ac, t, out, nb) {
            var osc = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(38, t);
            osc.frequency.exponentialRampToValueAtTime(170, t + 1.2);
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(180, t);
            lp.frequency.exponentialRampToValueAtTime(900, t + 1.2);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.3, t + 0.25);
            g.gain.setValueAtTime(0.3, t + 1.0);
            g.gain.linearRampToValueAtTime(0.0001, t + 1.28);
            osc.connect(lp); lp.connect(g); g.connect(out);
            osc.start(t); osc.stop(t + 1.3);
            // belt hiss rising with speed
            noise(ac, nb, out, { t: t, dur: 1.25, f: 700, f2: 3200, type: 'bandpass', q: 0.8, peak: 0.1, attack: 0.5, hold: 0.9 });
        },
        // counter service bell: bright strike, inharmonic partials, 1.5 s decay
        'bell': function (ac, t, out, nb) {
            var base = 1760, parts = [[1, 0.36, 1.5], [2.76, 0.21, 1.0], [5.4, 0.11, 0.6], [8.93, 0.055, 0.35]];
            for (var i = 0; i < parts.length; i++) {
                tone(ac, out, { t: t, f: base * parts[i][0], dur: parts[i][2], peak: parts[i][1], attack: 0.002 });
            }
            noise(ac, nb, out, { t: t, dur: 0.012, f: 4000, type: 'highpass', peak: 0.15 });
        },
        // short comic sip, subtle
        'slurp': function (ac, t, out, nb) {
            noise(ac, nb, out, { t: t, dur: 0.38, f: 500, f2: 2200, type: 'bandpass', q: 3, peak: 1.0, attack: 0.05, hold: 0.3 });
            var o = tone(ac, out, { t: t, f: 260, f2: 720, dur: 0.34, peak: 0.07, attack: 0.04, type: 'triangle' });
            // little gulp at the end
            tone(ac, out, { t: t + 0.36, f: 220, f2: 110, dur: 0.07, peak: 0.18, type: 'sine' });
        },
        // a sheet pulled from a stack: filtered noise swish
        'paper': function (ac, t, out, nb) {
            noise(ac, nb, out, { t: t, dur: 0.38, f: 1800, f2: 5200, type: 'bandpass', q: 0.6, peak: 0.34, attack: 0.12, hold: 0.2 });
            noise(ac, nb, out, { t: t + 0.05, dur: 0.25, f: 7000, type: 'highpass', peak: 0.07, attack: 0.08 });
        },
        // trainer on a sports hall floor: two rubbery chirps
        'squeak': function (ac, t, out) {
            function chirp(at, f1, f2, dur) {
                var osc = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f1, at);
                osc.frequency.exponentialRampToValueAtTime(f2, at + dur);
                bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 6;
                g.gain.setValueAtTime(0.0001, at);
                g.gain.linearRampToValueAtTime(0.55, at + 0.012);
                g.gain.setValueAtTime(0.55, at + dur - 0.02);
                g.gain.linearRampToValueAtTime(0.0001, at + dur);
                osc.connect(bp); bp.connect(g); g.connect(out);
                osc.start(at); osc.stop(at + dur + 0.02);
            }
            chirp(t, 1300, 2300, 0.11);
            chirp(t + 0.14, 1500, 2700, 0.09);
        },
        // old telephone: two-tone bell, gated by the striker, 0.8 s
        'ring': function (ac, t, out) {
            var g = ac.createGain();
            g.connect(out);
            var freqs = [1370, 1930];
            for (var i = 0; i < freqs.length; i++) {
                var osc = ac.createOscillator(), og = ac.createGain();
                osc.type = 'sine';
                osc.frequency.value = freqs[i];
                og.gain.value = i ? 0.55 : 0.8;
                osc.connect(og); og.connect(g);
                osc.start(t); osc.stop(t + 0.82);
            }
            // striker: ~25 Hz on/off with a slight ramp, fading across the burst
            var n = 20, step = 0.04;
            g.gain.setValueAtTime(0.0001, t);
            for (var k = 0; k < n; k++) {
                var lvl = 0.3 * (1 - k / (n * 1.3));
                g.gain.setValueAtTime(0.0001, t + k * step);
                g.gain.linearRampToValueAtTime(lvl, t + k * step + 0.004);
                g.gain.exponentialRampToValueAtTime(0.0001, t + k * step + step * 0.9);
            }
        },
        // small soft pop
        'pop': function (ac, t, out, nb) {
            tone(ac, out, { t: t, f: 700, f2: 180, dur: 0.07, peak: 0.45, attack: 0.002 });
            noise(ac, nb, out, { t: t, dur: 0.02, f: 2500, peak: 0.1 });
        }
    };

    // ---- context --------------------------------------------------------
    function ctx() {
        if (!unlocked) return null;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            if (!actx) {
                actx = new AC();
                master = actx.createGain();
                master.gain.value = enabled ? MASTER : 0;
                master.connect(actx.destination);
                noiseBuf = makeNoise(actx);
            }
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { return null; }
        return actx;
    }

    function unlock() {
        unlocked = true;
        ctx();
        sync();
    }
    ['pointerdown', 'keydown'].forEach(function (ev) {
        window.addEventListener(ev, function once() {
            window.removeEventListener(ev, once, true);
            try { unlock(); } catch (e) {}
        }, true);
    });

    // ---- ambient rain ---------------------------------------------------
    function startAmbient(ac) {
        var src = ac.createBufferSource();
        var hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), body = ac.createGain();
        var gate = ac.createGain();
        src.buffer = noiseBuf; src.loop = true;
        hp.type = 'highpass'; hp.frequency.value = 700;
        lp.type = 'lowpass'; lp.frequency.value = 5500;
        body.gain.value = 0.45;
        gate.gain.value = 0.0001;
        src.connect(hp); hp.connect(lp); lp.connect(body); body.connect(gate); gate.connect(master);
        src.start(0, Math.random());
        gate.gain.setValueAtTime(0.0001, ac.currentTime);
        gate.gain.linearRampToValueAtTime(AMBIENT, ac.currentTime + 1.5);
        amb = { src: src, gate: gate, body: body, lp: lp };

        // slow random movement of the rain's loudness and brightness
        function wobble() {
            if (!amb || amb.body !== body) return;
            var now = ac.currentTime;
            body.gain.setTargetAtTime(0.28 + Math.random() * 0.4, now, 0.9);
            lp.frequency.setTargetAtTime(3800 + Math.random() * 2600, now, 1.1);
            wobbleTimer = setTimeout(wobble, 1500 + Math.random() * 2000);
        }
        wobble();

        // the odd heavier drop on the glass
        function drop() {
            if (!amb || amb.body !== body) return;
            var t = ac.currentTime + 0.01;
            var out = ac.createGain();
            out.gain.value = AMBIENT;
            out.connect(master);
            noise(ac, noiseBuf, out, { t: t, dur: 0.05, f: 1500 + Math.random() * 1500, type: 'bandpass', q: 4, peak: 0.16 });
            tone(ac, out, { t: t, f: 900 + Math.random() * 500, f2: 450, dur: 0.04, peak: 0.05 });
            dropTimer = setTimeout(drop, 900 + Math.random() * 3200);
        }
        dropTimer = setTimeout(drop, 700 + Math.random() * 1500);
    }

    function stopAmbient(fast) {
        clearTimeout(dropTimer); clearTimeout(wobbleTimer);
        var a = amb;
        if (!a) return;
        amb = null;
        try {
            var now = actx.currentTime, d = fast ? 0.05 : 1.5;
            a.gate.gain.cancelScheduledValues(now);
            a.gate.gain.setValueAtTime(Math.max(a.gate.gain.value, 0.0001), now);
            a.gate.gain.linearRampToValueAtTime(0.0001, now + d);
            a.src.stop(now + d + 0.05);
        } catch (e) {}
    }

    function sync() {
        var shouldRun = wantAmbient && enabled && unlocked && !document.hidden;
        if (shouldRun && !amb) {
            var ac = ctx();
            if (ac) startAmbient(ac);
        } else if (!shouldRun && amb) {
            stopAmbient(!enabled || document.hidden);
        }
    }
    document.addEventListener('visibilitychange', function () { try { sync(); } catch (e) {} });

    // ---- public ---------------------------------------------------------
    window.LabSfx = {
        play: function (name) {
            try {
                if (!enabled || !Object.prototype.hasOwnProperty.call(voices, name)) return;
                var ac = ctx();
                if (!ac) return;
                voices[name](ac, ac.currentTime + 0.005, master, noiseBuf);
            } catch (e) {}
        },
        setEnabled: function (on) {
            enabled = !!on;
            try { window.localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
            try {
                if (master) {
                    master.gain.cancelScheduledValues(actx.currentTime);
                    master.gain.setTargetAtTime(enabled ? MASTER : 0, actx.currentTime, 0.01);
                }
                sync();
            } catch (e) {}
        },
        isEnabled: function () { return enabled; },
        ambient: function (on) {
            wantAmbient = !!on;
            try { sync(); } catch (e) {}
        },
        names: Object.keys(voices),
        // test hook: render one voice into any (Offline)AudioContext
        _render: function (name, ac, dest) {
            var m = ac.createGain();
            m.gain.value = MASTER;
            m.connect(dest);
            voices[name](ac, 0.005, m, makeNoise(ac));
        }
    };
})();
