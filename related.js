/* ====================================================================
   MUSIC ARCADE — "More like this", at the foot of every tool page
   --------------------------------------------------------------------
   Most people never see the front page. Parents arrive straight into a
   tool from a Rollbook lesson email, kids from a bookmark or a shared
   link. Those pages were dead ends. This makes every one of them a door.

   Include AFTER tools.js and it does the rest — it works out which page
   it is on, finds the three closest things in the catalogue, and puts
   them at the bottom:

       <script src="/tools.js"></script>
       <script src="/related.js"></script>

   Nothing to configure per page. A page that isn't in the catalogue
   (a hub, an account page) gets nothing at all.

   It has to sit on top of ~50 pages that each have their own look, so
   it draws itself in the page's own font and picks its ink by measuring
   how dark the page actually is at runtime — one page sets a near-black
   body colour on a dark blue background, and simply inheriting would
   have printed invisible text.
   ==================================================================== */
(function () {
  'use strict';
  if (window.top !== window.self) return;              // never inside an embed
  if (document.getElementById('ma-rel')) return;

  var M = window.MATools;
  if (!M) return;

  /* ---------- which page am I? ---------- */
  var here = decodeURIComponent(location.pathname).replace(/^\/+/, '').toLowerCase();
  function pathOf(x) { return decodeURIComponent(x.h.split('?')[0]).toLowerCase(); }
  var me = null;
  M.CATALOGUE.forEach(function (x) { if (!me && pathOf(x) === here) me = x; });
  if (!me) return;                                     // not a tool page — say nothing

  /* ---------- the three closest things ----------
     Shared goals carry it. After that: something one step deeper is the
     natural next stop, a whole course is a bigger ask than "more like
     this" so it gets pulled back, and a tool built for one instrument is
     only offered to someone we know plays it. */
  var saved = M.remember();
  function near(x) {
    if (x === me || pathOf(x) === here) return -1;
    var shared = 0;
    me.g.forEach(function (g) { if (x.g.indexOf(g) >= 0) shared++; });
    if (!shared) return -1;                            // unrelated: leave it out

    var s = 40 * shared;
    if (x.g[0] === me.g[0]) s += 12;                   // same job first and foremost

    var d = x.dep - me.dep;
    s += (d === 0) ? 14 : (d === 1) ? 18 : (d === -1) ? 8 : 0;
    if (x.dep === 3) s -= 8;                           // a full course is a big next click

    if (x.i) {
      if (me.i && x.i.some(function (k) { return me.i.indexOf(k) >= 0; })) s += 30;
      else if (saved && x.i.indexOf(saved.inst) >= 0) s += 20;
      else s -= 35;                                    // don't offer uke games to a piano player
    }
    if (x.lv.some(function (l) { return me.lv.indexOf(l) >= 0; })) s += 10;
    return s;
  }

  var picks = M.CATALOGUE
    .map(function (x) { return { x:x, s:near(x) }; })
    .filter(function (o) { return o.s > 0; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, 3)
    .map(function (o) { return o.x; });
  if (!picks.length) return;

  /* ---------- light page or dark page? ---------- */
  function lum(c) {
    var m = String(c || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length > 3 && parseFloat(m[3]) < 0.5) return null;     // see-through: not the real backdrop
    return (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255;
  }
  var bg = lum(getComputedStyle(document.body).backgroundColor);
  if (bg === null) bg = lum(getComputedStyle(document.documentElement).backgroundColor);
  if (bg === null) bg = 1;
  var dark = bg < 0.42;
  var ink = dark ? '244,238,226' : '23,20,14';         // paper on dark pages, ink on light

  function rgba(a) { return 'rgba(' + ink + ',' + a + ')'; }

  var css = document.createElement('style');
  css.textContent = [
    '#ma-rel{margin:56px 0 0;padding:26px 0 34px;border-top:2px solid ' + rgba(.22) + ';color:rgb(' + ink + ');',
    '  width:100%;flex:0 0 100%;grid-column:1/-1;}',   /* full width if the host is still flex or grid */
    '#ma-rel *{box-sizing:border-box;}',
    '#ma-rel .ma-rel-in{max-width:1000px;margin:0 auto;padding:0 1.2rem;}',
    '#ma-rel .ma-rel-h{margin:0 0 14px;font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.62;}',
    '#ma-rel .ma-rel-grid{display:grid;gap:12px;grid-template-columns:1fr;}',
    '@media(min-width:700px){#ma-rel .ma-rel-grid{grid-template-columns:repeat(3,1fr);}}',
    '#ma-rel a.ma-rel-i{display:flex;flex-direction:column;text-decoration:none;color:inherit;',
    '  border:2px solid ' + rgba(.3) + ';border-radius:5px;padding:12px 14px;background:' + rgba(.04) + ';',
    '  transition:background .14s ease,border-color .14s ease,transform .14s ease;}',
    '#ma-rel a.ma-rel-i:hover{background:' + rgba(.1) + ';border-color:' + rgba(.65) + ';transform:translateY(-2px);}',
    '#ma-rel a.ma-rel-i:focus-visible{outline:3px solid ' + rgba(.75) + ';outline-offset:2px;}',
    '#ma-rel .ma-rel-t{font-size:1.02rem;font-weight:800;line-height:1.2;}',
    '#ma-rel .ma-rel-d{font-size:.85rem;line-height:1.45;margin-top:4px;opacity:.72;}',
    '#ma-rel .ma-rel-k{margin-top:8px;font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;opacity:.6;}',
    '#ma-rel .ma-rel-foot{margin:16px 0 0;font-size:.82rem;opacity:.72;}',
    '#ma-rel .ma-rel-foot a{color:inherit;font-weight:700;}',
    '@media print{#ma-rel{display:none;}}'
  ].join('');
  document.head.appendChild(css);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Where to hang it. Many of the game pages centre themselves with
     `body{display:flex}`, and a plain appendChild there makes the strip a
     squashed extra column beside the game instead of a band beneath it.
     So when the body is a flex/grid container, walk into its widest real
     child until we reach something that lays its children out in normal
     flow, and put the strip in there. */
  function hostFor() {
    var n = document.body;
    /* one level only: stepping deeper than the body's main column starts
       landing the strip inside a game's own internals */
    for (var depth = 0; depth < 1; depth++) {
      var d = getComputedStyle(n).display;
      if (!/^(inline-)?(flex|grid)$/.test(d)) return n;
      var best = null, bw = -1;
      [].forEach.call(n.children, function (c) {
        if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE' || c.id === 'ma-rel') return;
        var cs2 = getComputedStyle(c);
        if (cs2.display === 'none' || cs2.position === 'fixed' || cs2.position === 'absolute') return;
        /* largest area, not just widest — a wide-but-shallow banner (a title
           strip) must not beat the actual content column */
        var r = c.getBoundingClientRect(), w = r.width * Math.max(1, r.height);
        if (w > bw) { bw = w; best = c; }
      });
      if (!best) return n;
      n = best;
    }
    return n;
  }

  var box = el('aside'); box.id = 'ma-rel';
  box.setAttribute('aria-label', 'More like this');
  var inner = el('div', 'ma-rel-in');
  inner.appendChild(el('p', 'ma-rel-h', 'More like this'));

  var grid = el('div', 'ma-rel-grid');
  picks.forEach(function (x) {
    var a = document.createElement('a');
    a.className = 'ma-rel-i';
    a.href = '/' + M.href(x, saved || { inst:'none' });
    a.appendChild(el('span', 'ma-rel-t', x.t));
    a.appendChild(el('span', 'ma-rel-d', x.d));
    var kind = [];
    if (x.dep === 3) kind.push('Full course');
    if (x.mic) kind.push('🎤 Listens to you');
    if (x.note) kind.push(x.note);
    if (kind.length) a.appendChild(el('span', 'ma-rel-k', kind.join(' · ')));
    grid.appendChild(a);
  });
  inner.appendChild(grid);

  var foot = el('p', 'ma-rel-foot');
  foot.appendChild(document.createTextNode(saved ? 'Looking for something else? ' : 'Not sure what to try next? '));
  var link = document.createElement('a');
  link.href = '/start.html';
  link.textContent = saved ? 'See your plan →' : "Answer three questions and we'll point you somewhere →";
  foot.appendChild(link);
  inner.appendChild(foot);

  box.appendChild(inner);
  hostFor().appendChild(box);
})();
