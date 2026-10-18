/* ====================================================================
   MusicXML → ABC, in the browser, for the Melody Trainer's "Add a tune".

     MusicXMLtoABC.convert(xmlText)   → { abc, title, key, warnings[] } or { error }
     MusicXMLtoABC.readFile(file)     → Promise<string>  (.musicxml / .xml / .mxl / .abc)

   Single melody lines only, which is all the Melody Trainer can follow:
   it reads the first part and the first voice in it, and skips chord
   notes, grace notes and cue notes. Keeps notes, rests, ties, accidentals,
   triplets, the key (and its mode, when the file names one) and the time
   signature. A change of key or time partway through is noted and ignored.
   .mxl (compressed MusicXML, MuseScore's default) is unzipped here too.
   ==================================================================== */
(function () {
  var LETTERS = 'CDEFGAB';
  var SHARP_ORDER = 'FCGDAEB', FLAT_ORDER = 'BEADGCF';
  var MODE_DEGREE = { major: 0, ionian: 0, dorian: 1, phrygian: 2, lydian: 3, mixolydian: 4, minor: 5, aeolian: 5, locrian: 6 };
  var MODE_SUFFIX = { major: '', ionian: '', minor: 'm', aeolian: 'm', dorian: 'dor', phrygian: 'phr', lydian: 'lyd', mixolydian: 'mix', locrian: 'loc' };

  function keyAlters(fifths) {               // letter -> alter from the key signature
    var m = {}; LETTERS.split('').forEach(function (l) { m[l] = 0; });
    for (var i = 0; i < Math.abs(fifths); i++) m[(fifths > 0 ? SHARP_ORDER : FLAT_ORDER)[i]] = fifths > 0 ? 1 : -1;
    return m;
  }
  function keyName(fifths, mode) {
    mode = (mode || 'major').toLowerCase(); if (!(mode in MODE_DEGREE)) mode = 'major';
    // the major key with this signature, then step up the scale to the mode's tonic
    var majorTonic = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F', 'C'][fifths + 7];
    // (index trick: -7..+7 → Cb..C#; letters only, alters come from the signature)
    var letter = LETTERS[(LETTERS.indexOf(majorTonic) + MODE_DEGREE[mode]) % 7];
    var alt = keyAlters(fifths)[letter];
    return letter + (alt > 0 ? '#' : alt < 0 ? 'b' : '') + MODE_SUFFIX[mode];
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function lenStr(eighths) {                 // a length in L:1/8 units → ABC
    var den = 1; while (Math.abs(eighths * den - Math.round(eighths * den)) > 1e-6 && den < 96) den *= 2;
    if (Math.abs(eighths * den - Math.round(eighths * den)) > 1e-6) { den = 3; while (Math.abs(eighths * den - Math.round(eighths * den)) > 1e-6 && den < 96) den *= 2; }
    var num = Math.round(eighths * den), g = gcd(num, den); num /= g; den /= g;
    if (den === 1) return num === 1 ? '' : String(num);
    if (num === 1 && den === 2) return '/';
    if (num === 1 && den === 4) return '//';
    return (num === 1 ? '' : num) + '/' + den;
  }
  function pitchStr(step, octave) {
    if (octave >= 5) return step.toLowerCase() + new Array(octave - 4).join("'");
    return step + new Array(5 - octave).join(',');
  }
  var ACC = { '-2': '__', '-1': '_', '0': '=', '1': '^', '2': '^^' };
  function kid(el, name) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; }
  function txt(el, path) { var e = el; for (var i = 0; e && i < path.length; i++) e = kid(e, path[i]); return e ? e.textContent.trim() : null; }

  function convert(xml) {
    var doc;
    try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch (e) { return { error: 'That doesn’t look like MusicXML.' }; }
    if (!doc || doc.getElementsByTagName('parsererror').length) return { error: 'That doesn’t look like MusicXML — the XML wouldn’t read.' };
    var root = doc.documentElement;
    if (root.localName === 'score-timewise') return { error: 'This is “timewise” MusicXML. Export it again as ordinary (partwise) MusicXML.' };
    if (root.localName !== 'score-partwise') return { error: 'That doesn’t look like MusicXML.' };
    var part = doc.getElementsByTagName('part')[0];
    if (!part) return { error: 'There are no notes in that file.' };
    var title = txt(root, ['work', 'work-title']) || txt(root, ['movement-title']) || '';
    var warnings = [], warned = {};
    function warn(k, m) { if (!warned[k]) { warned[k] = 1; warnings.push(m); } }
    if (doc.getElementsByTagName('part').length > 1) warn('parts', 'Only the first part was read.');

    var divisions = 1, fifths = null, mode = 'major', beats = null, beatType = null;
    var keyAlt = keyAlters(0), mainVoice = null, tuplet = 0, out = [], line = [], bars = 0, notes = 0;
    var measures = part.getElementsByTagName('measure');
    for (var mi = 0; mi < measures.length; mi++) {
      var meas = measures[mi], bar = '', measAcc = {};
      for (var el = meas.firstElementChild; el; el = el.nextElementSibling) {
        if (el.localName === 'attributes') {
          var dv = txt(el, ['divisions']); if (dv) divisions = +dv || divisions;
          var k = kid(el, 'key');
          if (k && txt(k, ['fifths']) !== null) {
            var f = +txt(k, ['fifths']), md = (txt(k, ['mode']) || 'major').toLowerCase();
            if (fifths === null) { fifths = f; mode = md; keyAlt = keyAlters(f); }
            else if (f !== fifths) warn('key', 'The key changes partway through; the first key was kept.');
          }
          var t = kid(el, 'time');
          if (t && txt(t, ['beats'])) {
            var b = txt(t, ['beats']), bt = txt(t, ['beat-type']);
            if (beats === null) { beats = b; beatType = bt; }
            else if (b !== beats || bt !== beatType) warn('time', 'The time signature changes partway through; the first one was kept.');
          }
          continue;
        }
        if (el.localName !== 'note') continue;
        if (kid(el, 'grace')) { warn('grace', 'Grace notes were left out.'); continue; }
        if (kid(el, 'cue')) continue;
        if (kid(el, 'chord')) { warn('chord', 'Chords were reduced to a single note (the first one written).'); continue; }
        var voice = txt(el, ['voice']) || '1';
        if (mainVoice === null) mainVoice = voice;
        if (voice !== mainVoice) { warn('voice', 'Only the first voice was read.'); continue; }
        var dur = +(txt(el, ['duration']) || 0);
        if (!dur) continue;
        var q = dur / divisions;                 // sounding length in quarter notes
        var tm = kid(el, 'time-modification'), s = '';
        if (tm) {
          var act = +txt(tm, ['actual-notes']), nor = +txt(tm, ['normal-notes']);
          if (act === 3 && nor === 2) { if (tuplet === 0) { s += '(3'; tuplet = 3; } q = q * 3 / 2; tuplet--; }
          else { warn('tup', 'An unusual tuplet was written out as plain lengths.'); }
        } else tuplet = 0;
        var L = lenStr(q * 2);
        if (kid(el, 'rest')) { bar += s + 'z' + L + ' '; continue; }
        var step = txt(el, ['pitch', 'step']), oct = +txt(el, ['pitch', 'octave']), alt = Math.round(+(txt(el, ['pitch', 'alter']) || 0));
        if (!step) continue;
        var cur = (step + oct) in measAcc ? measAcc[step + oct] : keyAlt[step];
        if (alt !== cur) { s += ACC[String(alt)] || ''; measAcc[step + oct] = alt; }
        s += pitchStr(step, oct) + L;
        var ties = el.getElementsByTagName('tie');
        for (var ti = 0; ti < ties.length; ti++) if (ties[ti].getAttribute('type') === 'start') { s += '-'; break; }
        bar += s + ' ';
        notes++;
      }
      if (!bar.trim()) continue;
      line.push(bar.trim()); bars++;
      if (line.length === 4) { out.push(line.join(' | ') + ' |'); line = []; }
    }
    if (line.length) out.push(line.join(' | ') + ' |');
    if (!notes) return { error: 'No notes were found in the first part.' };
    if (out.length) out[out.length - 1] = out[out.length - 1].replace(/\|$/, '|]');
    var key = keyName(fifths === null ? 0 : fifths, mode);
    var abc = 'X:1\nT:' + (title || 'Untitled') + '\nM:' + (beats ? beats + '/' + beatType : '4/4') + '\nL:1/8\nK:' + key + '\n' + out.join('\n') + '\n';
    return { abc: abc, title: title, key: key, warnings: warnings };
  }

  /* ---- reading a chosen file: .mxl is a zip holding the MusicXML ---- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser can’t open .mxl files — export uncompressed MusicXML (.musicxml) instead.'));
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  function unzip(buf) {
    var b = new Uint8Array(buf), eocd = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('That .mxl file couldn’t be opened.'));
    var n = u16(b, eocd + 10), p = u32(b, eocd + 16), entries = [];
    for (var e = 0; e < n; e++) {
      if (u32(b, p) !== 0x02014b50) break;
      var method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), off = u32(b, p + 42);
      var name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
      entries.push({ name: name, method: method, csize: csize, off: off });
      p += 46 + nlen + xlen + clen;
    }
    function read(ent) {
      var o = ent.off, start = o + 30 + u16(b, o + 26) + u16(b, o + 28), data = b.subarray(start, start + ent.csize);
      return (ent.method === 0 ? Promise.resolve(data) : ent.method === 8 ? inflate(data) : Promise.reject(new Error('Unsupported compression in that .mxl.')))
        .then(function (d) { return new TextDecoder().decode(d); });
    }
    var container = entries.filter(function (x) { return /META-INF\/container\.xml$/i.test(x.name); })[0];
    var pick = function (path) {
      var ent = entries.filter(function (x) { return x.name === path; })[0] ||
                entries.filter(function (x) { return !/^META-INF\//i.test(x.name) && /\.(musicxml|xml)$/i.test(x.name); })[0];
      if (!ent) throw new Error('No MusicXML inside that .mxl file.');
      return read(ent);
    };
    if (!container) return pick(null);
    return read(container).then(function (c) { var m = c.match(/full-path="([^"]+)"/); return pick(m ? m[1] : null); });
  }
  function readFile(file) {
    if (/\.mxl$/i.test(file.name)) return file.arrayBuffer().then(unzip);
    return file.text();
  }

  window.MusicXMLtoABC = { convert: convert, readFile: readFile };
})();
