/* ====================================================================
   MUSIC ARCADE — game badges (the "playing a lot" set)
   --------------------------------------------------------------------
   Counts how often each arcade game is played and turns that into:

     First Go      play any game once
     Regular       10 plays of one game   (bronze medal on its card)
     Devoted       50 plays of one game   (silver)
     Lives Here    200 plays of one game  (gold)
     Explorer      try 5 different games
     Globetrotter  play a game in every section
                   (Ear, Theory, Guitar, Uke, Piano, Banjo)
     Favourite     a ribbon on your most-played game; it moves if that changes

   WHAT COUNTS AS A PLAY: opening a game page and actually doing something
   on it — the first click, tap or key press, not counting the back link,
   the "More like this" footer, the cookie bar or the sign-in chip. One
   per visit, so a bounce off the page doesn't count and neither does
   playing round after round without leaving (that's still one go).

   The games are the dep:1 rows of tools.js; the section is the folder the
   game lives in (root-level games count as Theory). Nothing to set up per
   game: related.js loads this file on every game page by itself.

   STORAGE: this browser always (ma.plays.v1). When signed in, also on the
   account — one creations row, kind 'plays', title 'arcade'. Counts are
   kept PER DEVICE inside that row, so merging two copies is "largest count
   per device per game" and nothing is double-counted.

   On the front page (index.html) MABadges.decorate() is called by the page
   to draw medals + the Favourite ribbon on the cards and the badge strip.
   ==================================================================== */
(function () {
  'use strict';
  if (window.MABadges) return;

  var LK = 'ma.plays.v1', DK = 'ma.device.v1', KIND = 'plays', TITLE = 'arcade';
  var TIERS = [
    { n: 10,  id: 'regular', name: 'Regular',    metal: 'Bronze', fill: '#D08A4E', deep: '#8C4F22' },
    { n: 50,  id: 'devoted', name: 'Devoted',    metal: 'Silver', fill: '#C9CED6', deep: '#7D8591' },
    { n: 200, id: 'home',    name: 'Lives Here', metal: 'Gold',   fill: '#FFC53D', deep: '#B7860F' }
  ];
  var SECTIONS = [
    { id: 'ear', name: 'Ear' }, { id: 'theory', name: 'Theory' }, { id: 'guitar', name: 'Guitar' },
    { id: 'uke', name: 'Uke' }, { id: 'piano', name: 'Piano' }, { id: 'banjo', name: 'Banjo' }
  ];
  var FOLDER = { 'ear training': 'ear', theory: 'theory', guitar: 'guitar', ukulele: 'uke', piano: 'piano', banjo: 'banjo' };
  var EXPLORE = 5, FAV_MIN = 3;

  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function norm(href) {                         // any href/URL -> 'theory/apple-shot.html'
    try { var u = new URL(href, location.href); return decodeURIComponent(u.pathname).replace(/^\/+/, '').toLowerCase(); }
    catch (e) { return ''; }
  }

  /* ---------- the games ---------- */
  var GAMES = null;                             // path -> { t, sec }
  function games() {
    if (GAMES) return GAMES;
    var M = window.MATools; if (!M) return {};
    GAMES = {};
    M.CATALOGUE.forEach(function (x) {
      if (x.dep !== 1) return;
      var p = decodeURIComponent(x.h.split('?')[0]).toLowerCase();
      var f = p.indexOf('/') > 0 ? p.slice(0, p.indexOf('/')) : '';
      GAMES[p] = { t: x.t, sec: FOLDER[f] || 'theory' };
    });
    return GAMES;
  }

  /* ---------- the data ---------- */
  function blank() { return { d: {}, t: {}, e: {} }; }  // d: device -> path -> plays, t: path -> last played (ms), e: badge -> date earned
  var data = blank();
  function readLocal() {
    try { var s = JSON.parse(localStorage.getItem(LK) || 'null'); if (s && s.d) data = merge(data, { d: s.d, t: s.t || {}, e: s.e || {} }); } catch (e) {}
  }
  readLocal();
  var dev = null;
  try { dev = localStorage.getItem(DK); } catch (e) {}
  if (!dev) { dev = Math.random().toString(36).slice(2, 10); try { localStorage.setItem(DK, dev); } catch (e) {} }

  function keepLocal() { try { localStorage.setItem(LK, JSON.stringify(data)); } catch (e) {} }
  function merge(a, b) {
    var out = blank();
    [a, b].forEach(function (x) {
      Object.keys(x.d || {}).forEach(function (dv) {
        var o = out.d[dv] || (out.d[dv] = {});
        Object.keys(x.d[dv]).forEach(function (p) { o[p] = Math.max(o[p] || 0, x.d[dv][p] || 0); });
      });
      Object.keys(x.t || {}).forEach(function (p) { out.t[p] = Math.max(out.t[p] || 0, x.t[p] || 0); });
      Object.keys(x.e || {}).forEach(function (id) { if (!out.e[id] || x.e[id] < out.e[id]) out.e[id] = x.e[id]; });
    });
    return out;
  }

  function counts() {
    var c = {};
    Object.keys(data.d).forEach(function (dv) {
      Object.keys(data.d[dv]).forEach(function (p) { c[p] = (c[p] || 0) + data.d[dv][p]; });
    });
    return c;
  }
  function tierOf(n) { var t = 0; TIERS.forEach(function (x, i) { if (n >= x.n) t = i + 1; }); return t; }   // 0 none, 1 bronze, 2 silver, 3 gold
  function favourite() {
    var c = counts(), best = null;
    Object.keys(c).forEach(function (p) {
      if (!games()[p] || c[p] < FAV_MIN) return;
      if (!best || c[p] > c[best] || (c[p] === c[best] && (data.t[p] || 0) > (data.t[best] || 0))) best = p;
    });
    return best;
  }
  function summary() {
    var c = counts(), G = games(), played = [], secs = {}, medals = [0, 0, 0], total = 0;
    Object.keys(c).forEach(function (p) {
      if (!G[p] || !c[p]) return;
      played.push(p); secs[G[p].sec] = 1; total += c[p];
      var t = tierOf(c[p]); for (var i = 0; i < t; i++) medals[i]++;
    });
    return {
      total: total, played: played.length,
      first: played.length > 0,
      explorer: { have: Math.min(played.length, EXPLORE), need: EXPLORE },
      globe: { have: SECTIONS.filter(function (s) { return secs[s.id]; }).map(function (s) { return s.id; }), need: SECTIONS.length },
      medals: medals                               // how many games hold at least bronze / silver / gold
    };
  }

  /* every badge currently earned: [{ id, name, what, kind, tier }] */
  function earnedNow() {
    var out = [], S = summary(), c = counts(), G = games();
    if (S.first) out.push({ id: 'first', name: 'First Go', what: 'You played your first game', kind: 'first' });
    if (S.explorer.have >= EXPLORE) out.push({ id: 'explorer', name: 'Explorer', what: 'You tried ' + EXPLORE + ' different games', kind: 'explorer' });
    if (S.globe.have.length >= SECTIONS.length) out.push({ id: 'globe', name: 'Globetrotter', what: 'You played a game in every section', kind: 'globe' });
    Object.keys(c).forEach(function (p) {
      if (!G[p]) return;
      for (var i = 0; i < tierOf(c[p]); i++)
        out.push({ id: TIERS[i].id + ':' + p, name: TIERS[i].name, what: TIERS[i].metal + ' medal · ' + TIERS[i].n + ' plays of ' + G[p].t, kind: 'medal', tier: i + 1 });
    });
    return out;
  }
  /* stamp the date on anything new; returns the new ones */
  function settle() {
    var fresh = [];
    earnedNow().forEach(function (b) { if (!data.e[b.id]) { data.e[b.id] = today(); fresh.push(b); } });
    return fresh;
  }

  /* ---------- account sync ---------- */
  var rowId = null, pushT = null, signed = false, listeners = [];
  function A() { return window.MAAuth; }
  function isSigned() { var a = A(); return !!(a && a.user && a.user()); }
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function push() {
    clearTimeout(pushT);
    pushT = setTimeout(function () {
      if (!isSigned()) return;
      A().creations.save(KIND, { id: rowId, title: TITLE, data: data })
        .then(function (row) { if (row && row.id) rowId = row.id; }).catch(function () {});
    }, 1200);
  }
  function pull() {
    if (!isSigned()) return;
    A().creations.list(KIND).then(function (rows) {
      var row = null; for (var i = 0; i < rows.length; i++) if (rows[i].title === TITLE) { row = rows[i]; break; }
      if (row) rowId = row.id;
      var there = (row && row.data && row.data.d) ? row.data : blank();
      data = merge(data, there);
      settle();                                    // badges earned across two devices' counts: recorded, no pop-up
      var up = JSON.stringify(data) !== JSON.stringify(there);
      keepLocal(); changed();
      if (up) push();
    }).catch(function () {});
  }
  (function arm(tries) {
    var a = A();
    if (a && a.onChange) a.onChange(function (u) { var now = !!u; if (now && !signed) pull(); signed = now; });
    else if (tries < 50) setTimeout(function () { arm(tries + 1); }, 200);
  })(0);

  /* ---------- the pictures ---------- */
  var INK = '#17140E', PAPER = '#F4EEE2', BLUE = '#2438C8', PINK = '#FF4E86', GREEN = '#1E9E6A', GREY = '#B8B0A0';
  function stamp(fill, glyph, size, locked) {
    var f = locked ? '#E4DDCF' : fill, ink = locked ? GREY : INK;
    return '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true" focusable="false">' +
      '<circle cx="32" cy="32" r="29" fill="' + f + '" stroke="' + ink + '" stroke-width="3"/>' +
      '<circle cx="32" cy="32" r="22.5" fill="none" stroke="' + ink + '" stroke-width="1.6" stroke-dasharray="3 3" opacity=".55"/>' +
      glyph.replace(/INK/g, ink) + '</svg>';
  }
  var GLYPH = {
    first: '<path d="M26 20 L45 32 L26 44 Z" fill="INK"/>',
    explorer: '<circle cx="32" cy="32" r="14" fill="' + PAPER + '" stroke="INK" stroke-width="2.4"/>' +
              '<path d="M32 21 L36 32 L32 43 L28 32 Z" fill="INK"/><path d="M32 21 L36 32 L28 32 Z" fill="' + PINK + '"/>',
    globe: '<circle cx="32" cy="32" r="14" fill="' + PAPER + '" stroke="INK" stroke-width="2.4"/>' +
           '<ellipse cx="32" cy="32" rx="6" ry="14" fill="none" stroke="INK" stroke-width="2"/>' +
           '<path d="M18 32 H46 M20.5 25 H43.5 M20.5 39 H43.5" stroke="INK" stroke-width="2" fill="none"/>',
    medal: '<path d="M32 19 L35.8 27.6 L45 28.4 L38 34.6 L40.1 43.6 L32 38.8 L23.9 43.6 L26 34.6 L19 28.4 L28.2 27.6 Z" fill="' + PAPER + '" stroke="INK" stroke-width="2.2" stroke-linejoin="round"/>'
  };
  function badgeSVG(kind, size, locked, tier) {
    if (kind === 'medal') return stamp(TIERS[tier - 1].fill, GLYPH.medal, size, locked);
    return stamp({ first: GREEN, explorer: BLUE, globe: PINK }[kind], GLYPH[kind], size, locked);
  }

  /* ---------- "badge earned" pop-up (game pages) ---------- */
  var toastQ = [], toastOn = false;
  function toast(b) { toastQ.push(b); if (!toastOn) nextToast(); }
  function nextToast() {
    var b = toastQ.shift(); if (!b) { toastOn = false; return; }
    toastOn = true;
    if (!document.getElementById('mab-styles')) {
      var st = document.createElement('style'); st.id = 'mab-styles';
      st.textContent =
        '#mab-toast{position:fixed;left:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:12px;' +
        'max-width:min(360px,calc(100vw - 28px));padding:10px 16px 10px 10px;background:' + PAPER + ';color:' + INK + ';' +
        'border:3px solid ' + INK + ';border-radius:12px;box-shadow:5px 5px 0 ' + INK + ';pointer-events:none;' +
        'font:400 13px/1.35 "Hanken Grotesk",system-ui,sans-serif;transform:translateY(140%);transition:transform .35s cubic-bezier(.2,1.4,.4,1);}' +
        '#mab-toast.on{transform:none;}' +
        '#mab-toast svg{flex:0 0 auto;}' +
        '#mab-toast b{display:block;font:700 11px/1.2 "Space Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:' + BLUE + ';}' +
        '#mab-toast strong{display:block;font:800 18px/1.15 "Syne","Hanken Grotesk",system-ui,sans-serif;}' +
        '@media (prefers-reduced-motion:reduce){#mab-toast{transition:none;}}@media print{#mab-toast{display:none;}}';
      document.head.appendChild(st);
    }
    var el = document.getElementById('mab-toast');
    if (!el) { el = document.createElement('div'); el.id = 'mab-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.innerHTML = badgeSVG(b.kind, 52, false, b.tier) + '<div><b>Badge earned</b><strong>' + b.name + '</strong>' + b.what + '</div>';
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    setTimeout(function () { el.classList.remove('on'); setTimeout(nextToast, 450); }, 4800);
  }

  /* ---------- counting a play (game pages) ---------- */
  var IGNORE = '#ma-back,#ma-rel,#wtm-cookie-bar,#mab-toast,[id^="maa-"],[class*="maa-"],[id^="mav-"],[class*="mav-"]';
  function record(path) {
    var mine = data.d[dev] || (data.d[dev] = {});
    mine[path] = (mine[path] || 0) + 1;
    data.t[path] = Date.now();
    var fresh = settle();
    keepLocal(); push(); changed();
    // the biggest badge of a batch last, so it's the one left on screen
    fresh.forEach(toast);
  }
  function watchThisPage() {
    var here = norm(location.href);
    if (!games()[here]) return;
    var done = false;
    function go(e) {
      if (done) return;
      var t = e.target;
      if (t && t.closest && t.closest(IGNORE)) return;
      if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift' || e.metaKey || e.ctrlKey || e.altKey)) return;
      done = true;
      ['pointerdown', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, go, true); });
      record(here);
    }
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, go, true); });
  }

  /* ---------- the front page ---------- */
  function decorate(opts) {
    opts = opts || {};
    var c = counts(), G = games(), fav = favourite();
    if (!document.getElementById('mab-card-styles')) {
      var st = document.createElement('style'); st.id = 'mab-card-styles';
      st.textContent =
        '.mab-medal{position:absolute;top:10px;right:10px;z-index:2;display:flex;flex-direction:column;align-items:center;' +
        'font:700 10px/1 "Space Mono",ui-monospace,monospace;letter-spacing:.04em;color:' + INK + ';pointer-events:none;}' +
        '.mab-medal svg{display:block;height:auto;filter:drop-shadow(2px 2px 0 rgba(23,20,14,.9));}' +
        '.mab-medal span{margin-top:3px;background:' + PAPER + ';border:2px solid ' + INK + ';border-radius:999px;padding:2px 6px;}' +
        '.mab-ring{position:absolute;top:10px;right:10px;z-index:2;pointer-events:none;}' +
        '.mab-ring svg{display:block;}' +
        '.mab-fav{position:absolute;top:16px;left:-34px;z-index:2;width:140px;transform:rotate(-45deg);text-align:center;' +
        'background:' + PINK + ';color:' + PAPER + ';border-block:2px solid ' + INK + ';padding:4px 0;pointer-events:none;' +
        'font:400 8px/1.2 "Press Start 2P","Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;}';
      document.head.appendChild(st);
    }
    [].forEach.call(document.querySelectorAll('a.game'), function (a) {
      var art = a.querySelector('.game-art'); if (!art) return;
      [].forEach.call(art.querySelectorAll('.mab-medal,.mab-ring,.mab-fav'), function (x) { x.remove(); });
      var p = norm(a.getAttribute('href') || ''), n = c[p] || 0;
      if (!G[p] || !n) return;
      var t = tierOf(n), box = document.createElement('div'), next = TIERS[t];
      if (t) {
        box.className = 'mab-medal';
        box.innerHTML = badgeSVG('medal', a.classList.contains('hero-game') ? 54 : 46, false, t) + '<span>' + n + '</span>';
        box.title = TIERS[t - 1].name + ' (' + TIERS[t - 1].metal.toLowerCase() + ') · ' + n + ' plays' +
                    (next ? ' · ' + (next.n - n) + ' more for ' + next.metal.toLowerCase() : '');
      } else {                                     // under 10 plays: a ring filling up toward bronze
        var frac = n / TIERS[0].n, R = 17, L = 2 * Math.PI * R;
        box.className = 'mab-ring';
        box.innerHTML = '<svg viewBox="0 0 44 44" width="44" height="44" style="width:44px;height:44px" aria-hidden="true">' +
          '<circle cx="22" cy="22" r="20" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.5"/>' +
          '<circle cx="22" cy="22" r="' + R + '" fill="none" stroke="#E4DDCF" stroke-width="4"/>' +
          '<circle cx="22" cy="22" r="' + R + '" fill="none" stroke="' + TIERS[0].fill + '" stroke-width="4" stroke-linecap="round"' +
          ' stroke-dasharray="' + (L * frac).toFixed(1) + ' ' + L.toFixed(1) + '" transform="rotate(-90 22 22)"/>' +
          '<text x="22" y="26.5" text-anchor="middle" font-family="Space Mono,ui-monospace,monospace" font-weight="700" font-size="13" fill="' + INK + '">' + n + '</text></svg>';
        box.title = n + (n === 1 ? ' play' : ' plays') + ' · ' + (TIERS[0].n - n) + ' more for a bronze medal';
      }
      art.appendChild(box);
      if (p === fav) {
        var r = document.createElement('div'); r.className = 'mab-fav'; r.textContent = 'Favourite';
        r.title = 'Your most-played game'; art.appendChild(r);
      }
      a.setAttribute('data-plays', n);
    });
    if (opts.strip) drawStrip(opts.strip);
  }

  function drawStrip(host) {
    var S = summary();
    host.hidden = !S.first;
    if (!S.first) return;
    var exp = S.explorer.have >= EXPLORE, glo = S.globe.have.length >= SECTIONS.length;
    function item(kind, locked, name, sub, tier) {
      return '<li class="mab-b' + (locked ? ' locked' : '') + '">' + badgeSVG(kind, 58, locked, tier) +
             '<span class="mab-n">' + name + '</span><span class="mab-s">' + sub + '</span></li>';
    }
    var html = '<div class="mab-head"><h2>Your badges</h2><span>' + S.total + (S.total === 1 ? ' play' : ' plays') + ' · ' +
               S.played + (S.played === 1 ? ' game' : ' games') + '</span></div><ul class="mab-row">' +
      item('first', false, 'First Go', 'Played a game') +
      item('explorer', !exp, 'Explorer', exp ? EXPLORE + ' games tried' : S.explorer.have + ' / ' + EXPLORE + ' games') +
      item('globe', !glo, 'Globe\u00ADtrotter', glo ? 'Every section' :
           SECTIONS.map(function (s) { return S.globe.have.indexOf(s.id) >= 0 ? '<i class="on">' + s.name + '</i>' : '<i>' + s.name + '</i>'; }).join(' ')) +
      TIERS.map(function (t, i) {
        var have = S.medals[i];
        return item('medal', !have, t.name, have ? have + (have === 1 ? ' game' : ' games') + ' · ' + t.n + '+ plays' : t.n + ' plays of one game', i + 1);
      }).join('') + '</ul>';
    host.innerHTML = html;
  }

  window.MABadges = {
    counts: counts, tierOf: tierOf, favourite: favourite, summary: summary, earned: earnedNow,
    decorate: decorate, svg: badgeSVG, TIERS: TIERS, SECTIONS: SECTIONS,
    onChange: function (f) { listeners.push(f); },
    refresh: readLocal,                          // pick up plays made in another tab / before a back-button return
    _record: record                             // for testing from the console
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchThisPage);
  else watchThisPage();
})();
