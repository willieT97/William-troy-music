/* ====================================================================
   MUSIC ARCADE — lead sheet view, shared by Song Maker and Song Lab
   --------------------------------------------------------------------
   LeadSheet.open({
     title:   'My Song',          // editable right on the sheet
     key:     'C major',
     tempo:   110,
     credit:  'Made in Song Lab — williamtroymusic.com',
     sections:[ { label:'Verse', repeat:2,
                  bars:[ [ {beat:0, name:'C'}, {beat:2, name:'Am'} ], [] ] } ]
   })
   Chord symbols over four slashes a bar, four bars a line, section
   labels with repeat counts. Export = the browser's own print dialog:
   printing hides the studio and prints the sheet alone, and "Save as
   PDF" there is the file. No servers, no libraries.
   ==================================================================== */
(function () {
  'use strict';
  if (window.LeadSheet) return;

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
    '#lsov .bar{position:relative;height:60px;border-left:2px solid #17140E;}',
    '#lsov .bar:last-child{border-right:2px solid #17140E;}',
    '#lsov .bar.fin{border-right-width:6px;border-right-style:double;}',
    '#lsov .bar b{position:absolute;top:3px;font:700 1.04rem/1 system-ui,sans-serif;white-space:nowrap;}',
    '#lsov .bar .sl{position:absolute;left:8px;right:8px;bottom:8px;display:flex;justify-content:space-around;font:700 1.3rem/1 Georgia,serif;font-style:italic;color:#a09a89;}',
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
      if (sec.label) {
        var lab = el('div', 'slab', sec.label);
        if ((sec.repeat || 1) > 1) lab.appendChild(el('span', 'rep', 'play ×' + sec.repeat));
        pg.appendChild(lab);
      }
      var lastBarOfSong = null;
      for (var b = 0; b < sec.bars.length; b += 4) {
        var sys = el('div', 'sys');
        sec.bars.slice(b, b + 4).forEach(function (bar, bi) {
          var bd = el('div', 'bar');
          bar.slice().sort(function (a, c) { return a.beat - c.beat; }).forEach(function (ch) {
            var nm = el('b', null, ch.name);
            nm.style.left = 'calc(' + (ch.beat / 4 * 100) + '% + 6px)';
            bd.appendChild(nm);
          });
          var sl = el('div', 'sl');
          for (var k = 0; k < 4; k++) sl.appendChild(el('span', null, '/'));
          bd.appendChild(sl);
          sys.appendChild(bd);
          lastBarOfSong = bd;
        });
        pg.appendChild(sys);
      }
      if (si === secs.length - 1 && lastBarOfSong) lastBarOfSong.classList.add('fin');
    });

    if (doc.credit) pg.appendChild(el('div', 'credit', doc.credit));
    ov.appendChild(pg);
    document.body.appendChild(ov);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  window.LeadSheet = { open: open, close: close };
})();
