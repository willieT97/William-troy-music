/* note-input.js — one stream of "a note was played" events from any of:
 *   · a MIDI keyboard (Web MIDI: Chrome, Edge, Firefox — not Safari)
 *   · the laptop keyboard, music-software layout:
 *         W E   T Y U   O P          ← black keys
 *        A S D F G H J K L ;         ← white keys, A = C
 *        Z / X shift the octave down / up
 *   · on-screen keys (call NoteInput.press(midi) from a click)
 *
 * Usage:
 *   NoteInput.on(function(ev){ ev.midi, ev.pc (0–11), ev.name ('C', 'F♯'), ev.source });
 *   NoteInput.onOff(fn)        // note released (laptop + MIDI only)
 *   NoteInput.enableMidi()     // ask for MIDI; resolves {ok, inputs:[names], why}
 *   NoteInput.onMidiChange(fn) // called with the list of MIDI input names when one is (un)plugged
 *   NoteInput.octave           // laptop octave (C4 = 60 by default)
 *   NoteInput.keyLabel(midi)   // the laptop key that plays this midi now, or ''
 *   NoteInput.pause(bool)      // ignore everything while true (e.g. a name prompt is open)
 */
(function (global) {
  'use strict';

  var NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  // laptop key (KeyboardEvent.code, so it works on any layout) → semitones above the octave's C
  var KEYS = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
    KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16
  };
  var KEY_LABEL = { KeyA:'A', KeyW:'W', KeyS:'S', KeyE:'E', KeyD:'D', KeyF:'F', KeyT:'T', KeyG:'G',
    KeyY:'Y', KeyH:'H', KeyU:'U', KeyJ:'J', KeyK:'K', KeyO:'O', KeyL:'L', KeyP:'P', Semicolon:';' };

  var onFns = [], offFns = [], midiFns = [];
  var paused = false;
  var held = {};               // code → midi, so key-up releases the note it started even after an octave shift
  var midiAccess = null;

  function ev(midi, source, velocity) {
    var pc = ((midi % 12) + 12) % 12;
    return { midi: midi, pc: pc, name: NAMES[pc], source: source, velocity: velocity == null ? 0.8 : velocity };
  }
  function emit(midi, source, velocity) {
    if (paused) return;
    var e = ev(midi, source, velocity);
    onFns.slice().forEach(function (f) { try { f(e); } catch (err) { console.error(err); } });
  }
  function emitOff(midi, source) {
    var e = ev(midi, source);
    offFns.slice().forEach(function (f) { try { f(e); } catch (err) { console.error(err); } });
  }

  function typing(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }

  var NI = {
    NAMES: NAMES,
    octave: 60,
    on: function (f) { onFns.push(f); return f; },
    onOff: function (f) { offFns.push(f); return f; },
    onMidiChange: function (f) { midiFns.push(f); return f; },
    press: function (midi, source) { emit(midi, source || 'screen'); },
    pause: function (p) { paused = !!p; },
    nameOf: function (midi) { return NAMES[((midi % 12) + 12) % 12]; },
    keyLabel: function (midi) {
      var d = midi - NI.octave;
      for (var code in KEYS) if (KEYS[code] === d) return KEY_LABEL[code];
      return '';
    },
    midiSupported: function () { return !!navigator.requestMIDIAccess; },
    midiInputs: function () {
      var out = [];
      if (midiAccess) midiAccess.inputs.forEach(function (i) { if (i.state !== 'disconnected') out.push(i.name || 'MIDI keyboard'); });
      return out;
    },
    enableMidi: function () {
      if (!navigator.requestMIDIAccess) {
        return Promise.resolve({ ok: false, inputs: [], why: 'This browser can’t use MIDI keyboards. Try Chrome or Edge, or use the laptop keys.' });
      }
      if (midiAccess) return Promise.resolve({ ok: true, inputs: NI.midiInputs() });
      return navigator.requestMIDIAccess({ sysex: false }).then(function (access) {
        midiAccess = access;
        var hook = function () {
          access.inputs.forEach(function (input) { input.onmidimessage = onMidi; });
        };
        hook();
        access.onstatechange = function () {
          hook();
          var list = NI.midiInputs();
          midiFns.forEach(function (f) { try { f(list); } catch (e) {} });
        };
        return { ok: true, inputs: NI.midiInputs() };
      }, function () {
        return { ok: false, inputs: [], why: 'MIDI access was blocked. You can allow it in the address bar, or use the laptop keys.' };
      });
    }
  };

  function onMidi(m) {
    var d = m.data; if (!d || d.length < 2) return;
    var cmd = d[0] & 0xf0, note = d[1], vel = d.length > 2 ? d[2] : 0;
    if (cmd === 0x90 && vel > 0) emit(note, 'midi', vel / 127);
    else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) emitOff(note, 'midi');
  }

  global.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    if (e.code === 'KeyZ' || e.code === 'KeyX') {
      if (e.repeat) return;
      NI.octave = Math.max(24, Math.min(96, NI.octave + (e.code === 'KeyZ' ? -12 : 12)));
      e.preventDefault();
      midiFns.forEach(function (f) { try { f(NI.midiInputs(), 'octave'); } catch (er) {} });
      return;
    }
    if (!(e.code in KEYS)) return;
    e.preventDefault();
    if (e.repeat || held[e.code] != null) return;
    var midi = NI.octave + KEYS[e.code];
    held[e.code] = midi;
    emit(midi, 'keys');
  });
  global.addEventListener('keyup', function (e) {
    if (held[e.code] == null) return;
    var midi = held[e.code]; delete held[e.code];
    emitOff(midi, 'keys');
  });
  global.addEventListener('blur', function () {
    for (var c in held) { emitOff(held[c], 'keys'); }
    held = {};
  });

  global.NoteInput = NI;
})(window);
