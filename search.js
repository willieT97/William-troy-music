/* ====================================================================
   MUSIC ARCADE — one search box over everything
   --------------------------------------------------------------------
   Searches three things at once:
     · the 50 tools & games   (from tools.js — include it first)
     · the 205-tune library   (tunes/index.json, fetched on first focus)
     · musical phrases        ("D major scale", "F# minor chord", "note Bb")
       which become deep links into Scale Theory, the chord sheets and
       Find the Note — the same links the Rollbook emails use.

   Mount it into a container:
       <div id="whatever"></div>
       <script src="/tools.js"></script>
       <script src="/search.js"></script>
       <script>MASearch.mount(document.getElementById('whatever'))</script>

   The instrument for chord/note links comes from the visitor's saved
   three-question answers when they exist, so a guitarist lands on the
   guitar sheet. "Kesh Jig" opens the Melody Trainer with the Kesh
   loaded — the trainer's own loose ?tune= matching does the landing.
   ==================================================================== */
(function () {
  'use strict';
  if (window.MASearch) return;
  var M = window.MATools;
  if (!M) return;

  /* ---------- the musical-phrase parser ----------
     A lone "b" is a flat in "Bb dorian" but a word in "b blues" — the
     lookahead keeps "F# dim" from collapsing into F. Same trap the
     Rollbook parser hit; same cure. */
  var NOTE_RE = /^([a-g])\s*(?:(sharp|flat)\b|([#b♯♭])(?![a-z]))?[\s,]*/;
  var SCALES = [
    [/harmonic\s*minor|harmonic\b/, 'harmonicminor', 'harmonic minor scale'],
    [/melodic\s*minor|melodic\b/, 'melodicminor', 'melodic minor scale'],
    [/major\s*pent\w*|maj\s*pent\w*/, 'majorpentatonic', 'major pentatonic scale'],
    [/minor\s*pent\w*|min\s*pent\w*/, 'minorpentatonic', 'minor pentatonic scale'],
    [/pentatonic\b/, 'majorpentatonic', 'pentatonic scale'],
    [/blues\b/, 'blues', 'blues scale'],
    [/ionian\b/, 'ionian', 'ionian mode'], [/dorian\b/, 'dorian', 'dorian mode'],
    [/phrygian\b/, 'phrygian', 'phrygian mode'], [/lydian\b/, 'lydian', 'lydian mode'],
    [/mixolydian\b/, 'mixolydian', 'mixolydian mode'], [/aeolian\b/, 'aeolian', 'aeolian mode'],
    [/locrian\b/, 'locrian', 'locrian mode'],
    [/natural\s*minor|minor\b|\bmin\b/, 'minor', 'minor scale'],
    [/major\b|\bmaj\b/, 'major', 'major scale']
  ];
  function saved() { return M.remember() || {}; }
  function chordInst() { return M.CHORD_INST[saved().inst] || 'piano'; }
  function findInst() { return M.FIND_INST[saved().inst] || 'piano'; }

  function parsePhrase(q) {
    var s = q.toLowerCase().trim(), out = [];
    // people put the word first as often as the note: "note eb", "find the note eb"
    var noteFirst = /^(?:find\s+)?(?:the\s+)?notes?\s+/.test(s);
    if (noteFirst) s = s.replace(/^(?:find\s+)?(?:the\s+)?notes?\s+/, '');
    var m = NOTE_RE.exec(s);
    var root = null, rest = s;
    if (m) {
      var acc = m[2] === 'sharp' ? '#' : m[2] === 'flat' ? 'b'
              : (m[3] === '♯' ? '#' : m[3] === '♭' ? 'b' : m[3] || '');
      root = m[1].toUpperCase() + acc;
      rest = s.slice(m[0].length);
    }
    var scale = null, scaleWord = '';
    for (var i = 0; i < SCALES.length; i++) {
      if (SCALES[i][0].test(rest || s)) { scale = SCALES[i][1]; scaleWord = SCALES[i][2]; break; }
    }
    var wantsChord = /\bchords?\b/.test(s);
    var wantsScale = /\bscales?\b|\bmodes?\b/.test(s) || (scale && !wantsChord);
    var wantsNote = noteFirst || /\bnotes?\b/.test(s);

    if (root && scale && wantsScale && !wantsChord) {
      out.push({ t: root + ' ' + scaleWord, d: 'Notes, pattern and sound, on your instrument — in Scale Theory',
                 h: 'scale-theory.html?root=' + encodeURIComponent(root) + '&scale=' + scale, kind: 'theory' });
    }
    if (root && wantsChord) {
      var q2 = (scale === 'minor') ? 'minor' : 'major';
      out.push({ t: root + (q2 === 'minor' ? ' minor' : ' major') + ' chord',
                 d: 'The shape on ' + chordInst() + ', ready to print — in Chords',
                 h: 'chords.html?root=' + encodeURIComponent(root) + '&quality=' + q2 + '&inst=' + chordInst(), kind: 'theory' });
      out.push({ t: root + ' chords, the theory', d: 'How the chord is stacked and why it sounds that way — in Chord Theory',
                 h: 'chord-theory.html?root=' + encodeURIComponent(root), kind: 'theory' });
    }
    if (root && wantsNote && !scale) {
      out.push({ t: 'The note ' + root + ' on your instrument',
                 d: 'Every place it lives on ' + findInst() + ' — in Find the Note',
                 h: 'find-the-note.html?note=' + noteToPc(root) + '&inst=' + findInst(), kind: 'theory' });
    }
    if (!root && scale && wantsScale) {
      out.push({ t: scaleWord.charAt(0).toUpperCase() + scaleWord.slice(1),
                 d: 'Every root, on your instrument — in Scale Theory',
                 h: 'scale-theory.html?scale=' + scale, kind: 'theory' });
    }
    return out;
  }
  var PC = { 'C':0,'C#':1,'DB':1,'D':2,'D#':3,'EB':3,'E':4,'F':5,'F#':6,'GB':6,'G':7,'G#':8,'AB':8,'A':9,'A#':10,'BB':10,'B':11 };
  function noteToPc(n) { var v = PC[n.toUpperCase()]; return v == null ? 0 : v; }

  /* ---------- tools ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function searchTools(q) {
    var nq = norm(q), words = nq.split(' ').filter(Boolean);
    if (!words.length || nq.length < 2) return [];   // one letter matches half the catalogue
    return M.CATALOGUE.map(function (x) {
      var t = norm(x.t), d = norm(x.d), s = 0;
      if (t === nq) s += 100;
      else if (t.indexOf(nq) === 0) s += 60;
      else if (t.indexOf(nq) >= 0) s += 40;
      words.forEach(function (w) {
        if (t.indexOf(w) >= 0) s += 18;
        else if (d.indexOf(w) >= 0) s += 6;
      });
      // every word must land somewhere, or it's noise
      var all = words.every(function (w) { return (t + ' ' + d).indexOf(w) >= 0; });
      return { x: x, s: all ? s : 0 };
    }).filter(function (o) { return o.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
  }

  /* ---------- tunes (lazy) ---------- */
  var tunes = null, tunesLoading = null;
  function loadTunes() {
    if (tunes || tunesLoading) return tunesLoading || Promise.resolve(tunes);
    tunesLoading = fetch('/tunes/index.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { tunes = j; return j; })
      .catch(function () { tunes = []; return tunes; });
    return tunesLoading;
  }
  function tuneKey(s) { return String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function searchTunes(q) {
    if (!tunes) return [];
    var nq = tuneKey(q);
    if (nq.length < 2) return [];
    return tunes.map(function (t) {
      var k = tuneKey(t.n), s = 0;
      if (k === nq) s = 100; else if (k.indexOf(nq) === 0) s = 60; else if (k.indexOf(nq) >= 0) s = 40;
      else {
        // "kesh jig": the tune is *named* The Kesh and *is* a jig — let the
        // rhythm and origin words count, so the way people actually say a
        // tune's name still finds it
        var hay = k + ' ' + tuneKey(t.r) + ' ' + tuneKey(t.o);
        var words = nq.split(' ');
        if (words.every(function (w) { return hay.indexOf(w) >= 0; })) {
          // a word from the name ranks it; rhythm-only still lists, so
          // "slip jig" browses the slip jigs and "reel" the reels
          s = words.some(function (w) { return k.indexOf(w) >= 0; }) ? 30 : 12;
        }
      }
      return { t: t, s: s };
    }).filter(function (o) { return o.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
  }

  /* ---------- put it together ---------- */
  function query(q) {
    if (!q || !q.trim()) return { theory: [], tools: [], tunes: [] };
    return {
      theory: parsePhrase(q).slice(0, 2),
      tools: searchTools(q).slice(0, 5).map(function (o) { return o.x; }),
      tunes: searchTunes(q).slice(0, 6).map(function (o) { return o.t; })
    };
  }

  /* ---------- UI ---------- */
  var CSS = [
    '.mas{position:relative;}',
    '.mas input{width:100%;box-sizing:border-box;font:600 1rem/1.3 "Hanken Grotesk",system-ui,sans-serif;',
    '  background:#fffdf6;color:#17140E;border:3px solid #17140E;border-radius:6px;',
    '  padding:.8rem 1rem .8rem 2.6rem;box-shadow:4px 4px 0 rgba(255,255,255,.14);}',
    '.mas input:focus{outline:3px solid #FFC53D;outline-offset:2px;}',
    '.mas .mas-glass{position:absolute;left:.95rem;top:.85rem;font-size:1.05rem;pointer-events:none;opacity:.55;}',
    '.mas .mas-drop{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:200;max-height:min(60vh,460px);overflow:auto;',
    '  background:#fffdf6;color:#17140E;border:3px solid #17140E;border-radius:6px;box-shadow:7px 7px 0 rgba(0,0,0,.45);}',
    '.mas .mas-drop[hidden]{display:none;}',
    '.mas .mas-h{font:700 .62rem/1 "Space Mono",monospace;letter-spacing:.14em;text-transform:uppercase;',
    '  color:rgba(23,20,14,.55);padding:.75rem .9rem .35rem;}',
    '.mas .mas-i{display:block;text-decoration:none;color:inherit;padding:.55rem .9rem;cursor:pointer;}',
    '.mas .mas-i b{display:block;font:800 .98rem/1.25 "Syne",system-ui,sans-serif;}',
    '.mas .mas-i small{display:block;font-size:.8rem;line-height:1.35;color:rgba(23,20,14,.62);}',
    '.mas .mas-i.on, .mas .mas-i:hover{background:#FFC53D;}',
    '.mas .mas-none{padding:.9rem;font-size:.9rem;color:rgba(23,20,14,.6);}',
    '.mas .mas-none a{color:#2438C8;font-weight:700;}'
  ].join('\n');

  function mount(container, opts) {
    opts = opts || {};
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.className = 'mas';
    box.innerHTML =
      '<span class="mas-glass" aria-hidden="true">🔎</span>' +
      '<input type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" ' +
      'aria-label="Search the whole site" placeholder="' +
      (opts.placeholder || 'Search everything — try “Kesh Jig”, “D major scale”, “tuner”…') + '">' +
      '<div class="mas-drop" role="listbox" hidden></div>';
    container.appendChild(box);

    var input = box.querySelector('input'), drop = box.querySelector('.mas-drop');
    var rows = [], sel = -1;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

    function render() {
      var q = input.value;
      var r = query(q);
      rows = []; sel = -1;
      if (!q.trim()) { drop.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      var html = '';
      function section(name, items) {
        if (!items.length) return;
        html += '<div class="mas-h">' + name + '</div>';
        items.forEach(function (it) {
          html += '<a class="mas-i" role="option" data-i="' + rows.length + '" href="' + esc(it.h) + '">' +
                  '<b>' + esc(it.t) + '</b>' + (it.d ? '<small>' + esc(it.d) + '</small>' : '') + '</a>';
          rows.push(it);
        });
      }
      section('Scales & chords', r.theory);
      section('Games & tools', r.tools.map(function (x) {
        return { t: x.t, d: x.d, h: M.href(x, saved().inst ? saved() : { inst:'none' }) };
      }));
      section('Tunes', r.tunes.map(function (t) {
        var bits = [t.r, t.k, t.o].filter(Boolean).join(' · ');
        return { t: t.n, d: (bits ? bits + ' — ' : '') + 'opens in the Melody Trainer',
                 h: 'melody-trainer_1.html?tune=' + encodeURIComponent(t.n) };
      }));
      if (!rows.length) {
        html = '<div class="mas-none">Nothing by that name. ' +
               '<a href="start.html">Answer three questions</a> and we’ll point you somewhere good.</div>';
      }
      drop.innerHTML = html;
      drop.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function move(d) {
      if (!rows.length) return;
      sel = (sel + d + rows.length) % rows.length;
      [].forEach.call(drop.querySelectorAll('.mas-i'), function (el, i) {
        el.classList.toggle('on', i === sel);
        if (i === sel) el.scrollIntoView({ block: 'nearest' });
      });
    }

    var deb = null;
    input.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(render, 80);
    });
    input.addEventListener('focus', function () { loadTunes().then(function () { if (input.value.trim()) render(); }); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        var el = drop.querySelector('.mas-i.on') || drop.querySelector('.mas-i');
        if (el) { e.preventDefault(); location.href = el.getAttribute('href'); }
      }
      else if (e.key === 'Escape') { drop.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target)) { drop.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
    return { input: input, query: query };
  }

  window.MASearch = { mount: mount, query: query, _parsePhrase: parsePhrase, _loadTunes: loadTunes };
})();
