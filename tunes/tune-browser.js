/* ====================================================================
   The "Load a tune" box on every tune page (tunes/<name>.html), dressed
   and behaving like the Melody Trainer's: All tunes | My tunebook, the
   tradition filters, search by name, type or key (G, D mix… with modes
   found by their key equivalent), the list grouped by type. Picking a tune
   opens its page. One shared file so the 258 pages stay light.

   Reads tunes/pages.json (which tunes have a page) and tunes/index.json
   (name, rhythm, key, tradition) — both written by the build scripts.
   ==================================================================== */
(function () {
  var box = document.getElementById('tuneBrowser');
  if (!box) return;
  var here = box.getAttribute('data-current') || '';
  var $ = function (sel) { return box.querySelector(sel); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var tk = function (s) { return String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim(); };

  var TYPE_ORDER = ['nursery', 'folk', 'carol', 'spiritual', 'reel', 'jig', 'slip jig', 'hornpipe', 'polka', 'slide', 'barndance',
                    'march', 'slow air', 'air', 'waltz', 'blues', 'jazz', 'rag'];
  var PLURAL = { 'nursery': 'Nursery rhymes', 'folk': 'Folk songs', 'carol': 'Carols', 'spiritual': 'Spirituals', 'slip jig': 'Slip jigs',
                 'slow air': 'Slow airs', 'air': 'Airs', 'march': 'Marches', 'waltz': 'Waltzes', 'blues': 'Blues', 'jazz': 'Jazz', 'rag': 'Rags' };
  var TAG = { 'Irish session': ['ir', 'Irish'], 'American fiddle': ['am', 'Bluegrass'], 'Trad jazz': ['jz', 'Jazz'], 'Beginner': ['be', 'Folk'] };

  /* ---- keys, as in the Melody Trainer's search ---- */
  var KEY_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var MAJOR_NAME = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  var MODES = { major: 0, dorian: 2, phrygian: 4, lydian: 5, mixolydian: 7, minor: 9, locrian: 11 };
  function modeOf(w) {
    w = (w || '').toLowerCase();
    if (!w || w.indexOf('maj') === 0 || w.indexOf('ion') === 0) return 'major';
    if (w === 'm' || w.indexOf('min') === 0 || w.indexOf('aeo') === 0) return 'minor';
    var ms = ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
    for (var i = 0; i < ms.length; i++) if (w.indexOf(ms[i].slice(0, 3)) === 0) return ms[i];
    return null;
  }
  function keyOf(str) {
    var m = String(str || '').trim().match(/^([A-Ga-g])\s*([#b♯♭]?)\s*([A-Za-z]*)$/);
    if (!m) return null;
    var mode = modeOf(m[3]); if (!mode) return null;
    var acc = (m[2] === '#' || m[2] === '♯') ? 1 : (m[2] === 'b' || m[2] === '♭') ? -1 : 0;
    var pc = (KEY_PC[m[1].toUpperCase()] + acc + 12) % 12;
    return { pc: pc, tonic: m[1].toUpperCase() + (acc > 0 ? '♯' : acc < 0 ? '♭' : ''), mode: mode, parent: (pc - MODES[mode] + 12) % 12 };
  }
  function keyLabel(k) { return k ? k.tonic + ' ' + k.mode + (k.mode === 'major' ? '' : ' (' + MAJOR_NAME[k.parent] + ')') : ''; }
  function keyQuery(q) {
    var m = q.trim().match(/^(?:key of\s+|in\s+)?([a-g])\s*([#b♯♭]?)\s*([a-z]*)$/i);
    if (!m || (m[3] && !modeOf(m[3]))) return null;
    var k = keyOf(m[1] + m[2] + (m[3] || '')); if (k) k.any = !m[3]; return k;
  }
  function keyMatch(t, kq) {
    var k = t.kp; if (!k) return 0;
    if (k.pc === kq.pc && (kq.any || k.mode === kq.mode)) return 2;
    return k.parent === kq.parent ? 1 : 0;
  }

  var ALL = [], view = 'all', origin = '';

  function row(t) {
    var tag = TAG[t.o] ? ' <span class="otag ' + TAG[t.o][0] + '">' + TAG[t.o][1] + '</span>' : '';
    return '<a class="tunerow' + (tk(t.n) === tk(here) ? ' cur' : '') + '" href="' + esc(t.href) + '"><span class="tn">' + esc(t.n) + tag +
           '</span><span class="tk">' + esc(keyLabel(t.kp) || t.k) + '</span></a>';
  }
  function bookNames() {
    var b = {};
    try { b = JSON.parse(localStorage.getItem('wtm_tunebook') || '{}') || {}; } catch (e) {}
    return Object.keys(b).map(function (k) { return b[k] && b[k].name; }).filter(Boolean);
  }
  function render() {
    var q = ($('.tunesearch').value || '').trim().toLowerCase(), list = $('.tunelist'), h = '';
    var pool = ALL.filter(function (t) { return !origin || t.o === origin; });
    if (view === 'book') {
      var names = bookNames().map(tk);
      pool = pool.filter(function (t) { return names.indexOf(tk(t.n)) >= 0; });
      if (!pool.length && !q) { list.innerHTML = '<div class="none">Your tunebook is empty. In the Melody Trainer, play a tune all the way through and it’s kept here.</div>'; return; }
    }
    var kq = keyQuery(q);
    if (kq) {
      var ex = [], same = [];
      pool.forEach(function (t) { var m = keyMatch(t, kq); if (m === 2) ex.push(t); else if (m === 1) same.push(t); });
      if (ex.length) h += '<div class="grp">In ' + esc(kq.any ? kq.tonic : kq.tonic + ' ' + kq.mode) + ' · ' + ex.length + '</div>' + ex.map(row).join('');
      if (same.length) h += '<div class="grp">Same notes as ' + esc(MAJOR_NAME[kq.parent]) + ' major · ' + same.length + '</div>' + same.map(row).join('');
    } else {
      var items = pool.filter(function (t) { return !q || t.n.toLowerCase().indexOf(q) >= 0 || t.r.indexOf(q) >= 0 || (t.o || '').toLowerCase().indexOf(q) >= 0; });
      var groups = {};
      items.forEach(function (t) { (groups[t.r] = groups[t.r] || []).push(t); });
      Object.keys(groups).sort(function (a, b) {
        var ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      }).forEach(function (r) {
        h += '<div class="grp">' + esc(PLURAL[r] || (r.charAt(0).toUpperCase() + r.slice(1) + 's')) + ' · ' + groups[r].length + '</div>' + groups[r].map(row).join('');
      });
    }
    list.innerHTML = h || '<div class="none">No tunes match that.</div>';
  }

  box.addEventListener('click', function (e) {
    var b = e.target.closest('.booktabs button');
    if (b) {
      view = b.getAttribute('data-view');
      [].forEach.call(box.querySelectorAll('.booktabs button'), function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      return render();
    }
    var f = e.target.closest('.filters button');
    if (f) {
      origin = f.getAttribute('data-o');
      [].forEach.call(box.querySelectorAll('.filters button'), function (x) { x.classList.toggle('on', x === f); });
      return render();
    }
  });
  $('.tunesearch').addEventListener('input', render);

  Promise.all([fetch('/tunes/pages.json').then(function (r) { return r.json(); }),
               fetch('/tunes/index.json').then(function (r) { return r.json(); })])
    .then(function (res) {
      var pages = res[0], idx = res[1];
      ALL = idx.filter(function (t) { return pages[t.n]; }).map(function (t) {
        return { n: t.n, r: (t.r || 'other').toLowerCase(), k: t.k, o: t.o || 'Irish session', kp: keyOf(t.k), href: '/' + pages[t.n] };
      });
      var n = bookNames().length; $('#tbBookCount').textContent = n ? '(' + n + ')' : '';
      render();
      var cur = box.querySelector('.tunerow.cur'), list = $('.tunelist');
      if (cur) list.scrollTop = cur.offsetTop - list.offsetTop - list.clientHeight / 3;
    })
    .catch(function () { $('.tunelist').innerHTML = '<div class="none">Couldn’t load the tune list just now.</div>'; });
})();
