/* ====================================================================
   MUSIC ARCADE — lead sheet view, shared by Song Maker and Song Lab
   --------------------------------------------------------------------
   LeadSheet.open({
     title:   'My Song',          // editable right on the sheet
     key:     'C major',
     tempo:   110,
     sharp:   false,              // spell chromatic notes with ♯ (sharp keys) or ♭
     credit:  'Made in Song Lab — williamtroymusic.com',
     sections:[ { label:'Verse', repeat:2,
                  bars:[ [ {beat:0, name:'C'} ], [] ],          // chord symbols per bar
                  melody:[ {midi:64, col:0, len:8} ] } ]        // 16th-grid piano roll, section-relative
   })
   A section with melody gets real notation — heads, stems, flags, dots,
   rests, ties, ledger lines, accidentals — under its chord symbols; a
   section without gets four slashes a bar. Export = the browser's own
   print dialog: printing hides the studio, "Save as PDF" is the file.
   ==================================================================== */
(function () {
  'use strict';
  if (window.LeadSheet) return;

  /* ---------- layout constants ---------- */
  var SLASH_H = 60;                       // bar height, chords-only sections
  var MEL_H = 112, GAP = 7, YBOT = 64;    // bar height + staff metrics, melodic sections
  var YTOP = YBOT - 4 * GAP;              // top staff line
  var CLEF_W = 30;

  var CSS = [
    '#lsov{position:fixed;inset:0;z-index:99990;background:#37342c;overflow:auto;padding:30px 14px 60px;}',
    '#lsov .lstools{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:flex-end;max-width:840px;margin:0 auto 14px;}',
    '#lsov .lstools button{font:700 .95rem/1 system-ui,sans-serif;border:2px solid #17140E;border-radius:9px;padding:9px 16px;cursor:pointer;background:#fffdf6;color:#17140E;box-shadow:2px 3px 0 rgba(0,0,0,.4);}',
    '#lsov .lstools .pr{background:#1F9D55;color:#fff;}',
    '#lsov .lshint{max-width:840px;margin:0 auto 10px;text-align:right;color:#cfc9b8;font:600 .78rem/1.4 system-ui,sans-serif;}',
    '#lsov .pg{background:#fffdf6;color:#17140E;max-width:840px;margin:0 auto;padding:54px 58px 42px;border-radius:4px;box-shadow:0 14px 44px rgba(0,0,0,.5);}',
    '#lsov h1{font:800 2rem/1.15 system-ui,sans-serif;text-align:center;margin:0 0 6px;outline:none;}',
    '#lsov h1:focus{background:#fdf3c9;}',
    '#lsov .meta{font:600 .88rem/1 system-ui,sans-serif;letter-spacing:.05em;text-align:center;color:#5c5748;margin:0 0 26px;}',
    '#lsov .slab{display:flex;justify-content:space-between;align-items:baseline;font:800 .8rem/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;margin:22px 0 6px;}',
    '#lsov .slab .rep{font-weight:700;letter-spacing:.02em;text-transform:none;color:#5c5748;}',
    '#lsov .sys{display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:16px;}',
    '#lsov .sys.mel{grid-template-columns:' + CLEF_W + 'px repeat(4,1fr);margin-bottom:8px;}',
    '#lsov .bar{position:relative;height:' + SLASH_H + 'px;border-left:2px solid #17140E;}',
    '#lsov .bar:last-child{border-right:2px solid #17140E;}',
    '#lsov .bar.fin{border-right-width:6px;border-right-style:double;}',
    '#lsov .sys.mel .bar{height:' + MEL_H + 'px;border:none;}',
    '#lsov .clefcell{position:relative;height:' + MEL_H + 'px;}',
    '#lsov .bar b{position:absolute;top:3px;font:700 1.04rem/1 system-ui,sans-serif;white-space:nowrap;}',
    '#lsov .bar .sl{position:absolute;left:8px;right:8px;bottom:8px;display:flex;justify-content:space-around;font:700 1.3rem/1 Georgia,serif;font-style:italic;color:#a09a89;}',
    '#lsov .bar svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}',
    '#lsov .clefcell svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}',
    '#lsov .credit{margin-top:30px;text-align:center;font:600 .72rem/1 system-ui,sans-serif;letter-spacing:.08em;color:#a09a89;}',
    '@media print{',
    '  body>:not(#lsov){display:none !important;}',
    '  #lsov{display:block !important;position:static;background:#fff;padding:0;overflow:visible;}',
    '  #lsov .lstools,#lsov .lshint{display:none !important;}',
    '  #lsov .pg{box-shadow:none;border-radius:0;max-width:none;padding:0;}',
    '  #lsov .slab{break-after:avoid;}',
    '  #lsov .sys{break-inside:avoid;}',
    '  @page{margin:15mm;}',
    '}'
  ].join('\n');

  /* ---------- pitch spelling ----------
     No key signature is drawn (matching the site's other staffs) — every
     chromatic note carries its own accidental, spelled ♯ or ♭ per the key. */
  var SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var LETTER = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  function spell(midi, sharp) {
    var pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12) - 1;
    var name = (sharp ? SHARPS : FLATS)[pc];
    var acc = name.length > 1 ? name.charAt(1) : '';
    // Db3 etc: the letter's own octave — C#-B# share midi octave; Cb/B# never arise here
    return { step: oct * 7 + LETTER[name.charAt(0)], acc: acc };
  }

  /* ---------- quantiser ----------
     Piano-roll events on a 16th grid → notated values. Splits at barlines
     (tying across), and off-beat starts may not cross the next beat, so
     syncopation renders as tied notes the way a copyist would write it. */
  var NOTE_VALS = [16, 12, 8, 6, 4, 3, 2, 1];
  var REST_VALS = [16, 8, 4, 2, 1];        // dotted rests read badly — split instead
  function chunk(out, start, len, isRest, midi, src) {
    while (len > 0) {
      var span = Math.min(len, (Math.floor(start / 16) + 1) * 16 - start);
      var pos = start, rem = span;
      while (rem > 0) {
        var cap = (pos % 4 === 0) ? rem : Math.min(rem, 4 - (pos % 4));
        var vals = isRest ? REST_VALS : NOTE_VALS, d = 1;
        for (var i = 0; i < vals.length; i++) { if (vals[i] <= cap) { d = vals[i]; break; } }
        out.push({ col: pos, d: d, rest: isRest, m: midi, src: src });
        pos += d; rem -= d;
      }
      start += span; len -= span;
    }
  }
  function quantise(melody, nbars) {
    var total = nbars * 16, evs = [], out = [];
    melody.slice().sort(function (a, b) { return a.col - b.col; }).forEach(function (n) {
      var c = Math.max(0, Math.round(n.col)), l = Math.round(n.len);
      if (c >= total || l <= 0) return;
      l = Math.min(l, total - c);
      var prev = evs[evs.length - 1];
      if (prev && c < prev.col + prev.len) prev.len = Math.max(0, c - prev.col);  // melody is one voice: clip overlaps
      evs.push({ col: c, len: l, midi: n.midi });
    });
    evs = evs.filter(function (e) { return e.len > 0; });
    var pos = 0;
    evs.forEach(function (e, i) {
      if (e.col > pos) chunk(out, pos, e.col - pos, true, 0, -1);
      chunk(out, e.col, e.len, false, e.midi, i);
      pos = e.col + e.len;
    });
    if (pos < total) chunk(out, pos, total - pos, true, 0, -1);
    // ties between segments of one source note
    for (var i = 0; i < out.length; i++) {
      if (out[i].rest) continue;
      if (out[i + 1] && !out[i + 1].rest && out[i + 1].src === out[i].src) { out[i].tieR = true; out[i + 1].tieL = true; }
    }
    var bars = []; for (var b = 0; b < nbars; b++) bars.push([]);
    out.forEach(function (e) {
      var b2 = Math.floor(e.col / 16);
      bars[b2].push({ col: e.col - b2 * 16, d: e.d, rest: e.rest, m: e.m, tieL: e.tieL, tieR: e.tieR });
    });
    return bars;
  }

  /* ---------- engraving (adapted from the Learning to Fly staff) ---------- */
  var INK = '#17140E', REST_COL = '#6F6757';
  function yOf(step) { return YBOT - (step - 30) * (GAP / 2); }   // step 30 = E4, bottom line

  function staffLines(w) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      var y = YBOT - i * GAP;
      s += '<line x1="0" y1="' + y + '" x2="' + w + '" y2="' + y + '" stroke="' + INK + '" stroke-width="1.2"/>';
    }
    return s;
  }
  function restGlyph(cx, d) {
    var mid = YBOT - 2 * GAP, l4 = YBOT - 3 * GAP, s = '';
    if (d >= 16) return '<rect x="' + (cx - 5) + '" y="' + l4 + '" width="10" height="4" fill="' + REST_COL + '"/>';
    if (d >= 8) return '<rect x="' + (cx - 5) + '" y="' + (mid - 4) + '" width="10" height="4" fill="' + REST_COL + '"/>';
    if (d >= 4) return '<path d="M' + (cx - 3) + ' ' + (mid - 9) + ' L' + (cx + 3) + ' ' + (mid - 2) + ' L' + (cx - 2) + ' ' + (mid + 1) + ' L' + (cx + 3) + ' ' + (mid + 8) + '" fill="none" stroke="' + REST_COL + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    s = '<circle cx="' + (cx - 2.5) + '" cy="' + (mid - 3) + '" r="2" fill="' + REST_COL + '"/>' +
        '<line x1="' + (cx + 3) + '" y1="' + (mid - 4) + '" x2="' + (cx - 1) + '" y2="' + (mid + 7) + '" stroke="' + REST_COL + '" stroke-width="1.6"/>';
    if (d === 1) s += '<circle cx="' + (cx - 3.5) + '" cy="' + (mid + 2) + '" r="2" fill="' + REST_COL + '"/>';
    return s;
  }
  function noteGlyph(cx, e, sharp) {
    var nf = spell(e.m, sharp), y = yOf(nf.step), s = '';
    // ledger lines
    for (var lk = 1; YBOT + lk * GAP <= y + 0.1; lk++)
      s += '<line x1="' + (cx - 9) + '" y1="' + (YBOT + lk * GAP) + '" x2="' + (cx + 9) + '" y2="' + (YBOT + lk * GAP) + '" stroke="' + INK + '" stroke-width="1.2"/>';
    for (var uk = 1; YTOP - uk * GAP >= y - 0.1; uk++)
      s += '<line x1="' + (cx - 9) + '" y1="' + (YTOP - uk * GAP) + '" x2="' + (cx + 9) + '" y2="' + (YTOP - uk * GAP) + '" stroke="' + INK + '" stroke-width="1.2"/>';
    if (nf.acc) s += '<text x="' + (cx - 12.5) + '" y="' + (y + 4.5) + '" font-family="Georgia,serif" font-size="' + (nf.acc === 'b' ? 15 : 13) + '" fill="' + INK + '">' + (nf.acc === 'b' ? '♭' : '♯') + '</text>';
    var open = e.d >= 8;
    s += '<ellipse cx="' + cx + '" cy="' + y + '" rx="5.8" ry="4.3" transform="rotate(-18 ' + cx + ' ' + y + ')" fill="' + (open ? '#FFFDF7' : INK) + '" stroke="' + INK + '" stroke-width="1.6"/>';
    if (e.d === 3 || e.d === 6 || e.d === 12)
      s += '<circle cx="' + (cx + 9.5) + '" cy="' + (y - 2.5) + '" r="1.9" fill="' + INK + '"/>';
    if (e.d < 16) {
      var sx = cx + 5.4, y2 = y - 25;
      s += '<line x1="' + sx + '" y1="' + (y - 1) + '" x2="' + sx + '" y2="' + y2 + '" stroke="' + INK + '" stroke-width="1.6"/>';
      var flags = (e.d === 2 || e.d === 3) ? 1 : (e.d === 1 ? 2 : 0);
      for (var f = 0; f < flags; f++) {
        var fy = y2 + f * 6;
        s += '<path d="M' + sx + ' ' + fy + ' Q' + (sx + 7) + ' ' + (fy + 5) + ' ' + (sx + 3) + ' ' + (fy + 14) + '" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round"/>';
      }
    }
    return s;
  }
  function tieArc(x1, x2, y) {
    var yy = y + 8;
    return '<path d="M' + x1 + ' ' + yy + ' Q' + ((x1 + x2) / 2) + ' ' + (yy + 6) + ' ' + x2 + ' ' + yy + '" fill="none" stroke="' + INK + '" stroke-width="1.3"/>';
  }

  /* one bar of melody as an SVG string; w in px */
  function barSVG(events, w, sharp, opts) {
    var xFor = function (col) { return 10 + (col / 16) * (w - 18); };
    var s = staffLines(w);
    // barline (left edge; the system's last bar draws its right edge too)
    s += '<line x1="1" y1="' + YTOP + '" x2="1" y2="' + YBOT + '" stroke="' + INK + '" stroke-width="2"/>';
    if (opts.rightBar) {
      s += '<line x1="' + (w - 1.5) + '" y1="' + YTOP + '" x2="' + (w - 1.5) + '" y2="' + YBOT + '" stroke="' + INK + '" stroke-width="2"/>';
      if (opts.fin) s += '<line x1="' + (w - 6.5) + '" y1="' + YTOP + '" x2="' + (w - 6.5) + '" y2="' + YBOT + '" stroke="' + INK + '" stroke-width="1.3"/>';
    }
    events.forEach(function (e, i) {
      var cx = xFor(e.col) + 6;
      if (e.rest) { s += restGlyph(cx, e.d); return; }
      s += noteGlyph(cx, e, sharp);
      var y = yOf(spell(e.m, sharp).step);
      if (e.tieR) {
        var nxt = events[i + 1];
        s += tieArc(cx + 4, nxt && !nxt.rest ? xFor(nxt.col) + 2 : w, y);   // to the next head, or the barline
      } else if (e.tieL && i === 0) {
        s += tieArc(0, cx - 4, y);                                          // continued from the previous bar
      }
      if (e.tieL && i > 0 && !events[i - 1].tieR) s += tieArc(xFor(events[i - 1].col) + 10, cx - 4, y);
    });
    return '<svg viewBox="0 0 ' + w + ' ' + MEL_H + '" preserveAspectRatio="none">' + s + '</svg>';
  }
  function clefSVG() {
    return '<svg viewBox="0 0 ' + CLEF_W + ' ' + MEL_H + '">' + staffLines(CLEF_W) +
      '<text x="2" y="' + (YBOT + 3) + '" font-family="Georgia,serif" font-size="40" fill="' + INK + '">𝄞</text></svg>';
  }

  /* ---------- the sheet ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function close() { var ov = document.getElementById('lsov'); if (ov) ov.remove(); }

  function open(doc) {
    close();
    if (!document.getElementById('lscss')) {
      var st = document.createElement('style'); st.id = 'lscss'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var ov = el('div'); ov.id = 'lsov';

    var tools = el('div', 'lstools');
    var pr = el('button', 'pr', '🖨 Print / save as PDF'); pr.type = 'button';
    pr.addEventListener('click', function () { window.print(); });
    var cl = el('button', null, 'Back to the studio'); cl.type = 'button';
    cl.addEventListener('click', close);
    tools.appendChild(pr); tools.appendChild(cl);
    ov.appendChild(tools);
    ov.appendChild(el('div', 'lshint', 'Tap the title to rename it. In the print dialog, “Save as PDF” keeps a copy.'));

    var pg = el('div', 'pg');
    var h1 = el('h1', null, doc.title || 'My Song');
    h1.contentEditable = 'true'; h1.spellcheck = false;
    pg.appendChild(h1);
    pg.appendChild(el('p', 'meta',
      (doc.key ? doc.key + '   ·   ' : '') + (doc.tempo ? '♩ = ' + doc.tempo + '   ·   ' : '') + '4/4'));

    var secs = doc.sections || [];
    secs.forEach(function (sec, si) {
      var melodic = !!(sec.melody && sec.melody.length);
      var melBars = melodic ? quantise(sec.melody, sec.bars.length) : null;
      if (sec.label) {
        var lab = el('div', 'slab', sec.label);
        if ((sec.repeat || 1) > 1) lab.appendChild(el('span', 'rep', 'play ×' + sec.repeat));
        pg.appendChild(lab);
      }
      var isLastSec = si === secs.length - 1;
      for (var b = 0; b < sec.bars.length; b += 4) {
        var rowBars = sec.bars.slice(b, b + 4);
        var sys = el('div', 'sys' + (melodic ? ' mel' : ''));
        if (melodic) { var cc = el('div', 'clefcell'); cc.innerHTML = clefSVG(); sys.appendChild(cc); }
        rowBars.forEach(function (bar, bi) {
          var globalBar = b + bi, lastOfSys = bi === rowBars.length - 1;
          var lastOfSong = isLastSec && globalBar === sec.bars.length - 1;
          var bd = el('div', 'bar' + (!melodic && lastOfSong ? ' fin' : ''));
          if (melodic) {
            // measured after mount — use a nominal width; preserveAspectRatio=none scales it
            bd.innerHTML = barSVG(melBars[globalBar] || [], 180, doc.sharp, { rightBar: lastOfSys, fin: lastOfSong });
          } else {
            var sl = el('div', 'sl');
            for (var k = 0; k < 4; k++) sl.appendChild(el('span', null, '/'));
            bd.appendChild(sl);
          }
          bar.slice().sort(function (a, c) { return a.beat - c.beat; }).forEach(function (ch) {
            var nm = el('b', null, ch.name);
            nm.style.left = 'calc(' + (ch.beat / 4 * 100) + '% + 6px)';
            bd.appendChild(nm);
          });
          sys.appendChild(bd);
        });
        pg.appendChild(sys);
      }
    });

    if (doc.credit) pg.appendChild(el('div', 'credit', doc.credit));
    ov.appendChild(pg);
    document.body.appendChild(ov);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  window.LeadSheet = { open: open, close: close, _quantise: quantise };
})();
