/* ====================================================================
   PRACTICE SCORES — your own record on a practice tool, kept for good.
   Used by Pitch Practice and Play It Back.

     const rec = PracticeScores.open('play-it-back', el('record'));
     rec.round({ clean:true, notes:4, right:4 });   // after each round
     rec.streak(n)                                   // current run, for "best ever"
     rec.best()                                      // best run ever

   Kept in this browser always; when signed in, also on the account (one
   creations row, kind 'scores', title = the tool), so it follows you to
   any device. Practice is counted per day, which is how the two copies
   merge without double-counting: for each day, the larger count wins.
   The mount element shows the record, and where it is saved.
   ==================================================================== */
(function () {
  var KIND = 'scores';
  function today(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function blank() { return { best: 0, days: {} }; }   // days: { 'YYYY-MM-DD': { r:rounds, c:clean, n:notes, k:right } }

  function merge(a, b) {
    var out = { best: Math.max(a.best || 0, b.best || 0), days: {} };
    [a.days || {}, b.days || {}].forEach(function (D) {
      Object.keys(D).forEach(function (k) {
        var x = out.days[k] || { r: 0, c: 0, n: 0, k: 0 }, y = D[k];
        out.days[k] = { r: Math.max(x.r, y.r || 0), c: Math.max(x.c, y.c || 0), n: Math.max(x.n, y.n || 0), k: Math.max(x.k, y.k || 0) };
      });
    });
    return out;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function open(tool, mount) {
    var LK = 'wtm_scores_' + tool, rowId = null, pushT = null, signed = false;
    var data = blank();
    try { var s = JSON.parse(localStorage.getItem(LK) || 'null'); if (s && s.days) data = s; } catch (e) {}

    function A() { return window.MAAuth; }
    function isSigned() { var a = A(); return !!(a && a.user && a.user()); }
    function keepLocal() { try { localStorage.setItem(LK, JSON.stringify(data)); } catch (e) {} }
    function push() {
      clearTimeout(pushT);
      pushT = setTimeout(function () {
        if (!isSigned()) return;
        A().creations.save(KIND, { id: rowId, title: tool, data: data })
          .then(function (row) { if (row && row.id) rowId = row.id; }).catch(function () {});
      }, 1500);                                   // a few rounds in a row become one save
    }
    function pull() {
      if (!isSigned()) return;
      A().creations.list(KIND).then(function (rows) {
        var row = null; for (var i = 0; i < rows.length; i++) if (rows[i].title === tool) { row = rows[i]; break; }
        if (row) rowId = row.id;
        var there = (row && row.data && row.data.days) ? row.data : blank();
        var both = merge(data, there);
        var changed = !same(both, there);
        data = both; keepLocal(); draw();
        if (changed) push();                      // practice done here before signing in: carry it up
      }).catch(function () {});
    }

    function totals(sinceDays) {
      var t = { r: 0, c: 0, n: 0, k: 0, d: 0 }, cut = null;
      if (sinceDays) { var d = new Date(); d.setDate(d.getDate() - (sinceDays - 1)); cut = today(d); }
      Object.keys(data.days).forEach(function (k) {
        if (cut && k < cut) return;
        var x = data.days[k]; t.r += x.r; t.c += x.c; t.n += x.n; t.k += x.k; if (x.r) t.d++;
      });
      return t;
    }
    function draw() {
      if (!mount) return;
      var all = totals(0), week = totals(7);
      if (!all.r && !data.best) { mount.innerHTML = '<span class="rec-k">Your record</span> starts with your first round.' + where(); return; }
      mount.innerHTML =
        '<span class="rec-k">Your record</span>' +
        '<span class="rec-i"><b>' + data.best + '</b> best run</span>' +
        '<span class="rec-i"><b>' + all.r + '</b> rounds</span>' +
        '<span class="rec-i"><b>' + (all.n ? Math.round(100 * all.k / all.n) : 0) + '%</b> notes right</span>' +
        '<span class="rec-i"><b>' + week.r + '</b> this week' + (week.d ? ' · ' + week.d + (week.d === 1 ? ' day' : ' days') : '') + '</span>' +
        where();
      var a = mount.querySelector('a.rec-in');
      if (a) a.addEventListener('click', function (e) { e.preventDefault(); if (A() && A().open) A().open('signin'); });
    }
    function where() {
      return isSigned() ? '<span class="rec-w">saved to your account</span>'
                        : '<span class="rec-w">saved in this browser · <a href="#" class="rec-in">sign in</a> to keep it everywhere</span>';
    }

    var api = {
      round: function (r) {
        var k = today(), x = data.days[k] || { r: 0, c: 0, n: 0, k: 0 };
        x.r++; if (r.clean) x.c++; x.n += r.notes || 0; x.k += r.right || 0;
        data.days[k] = x; keepLocal(); draw(); push();
      },
      streak: function (n) { if (n > data.best) { data.best = n; keepLocal(); draw(); push(); } },
      best: function () { return data.best; },
      draw: draw
    };
    // the account arrives a moment after the page
    (function arm() {
      var a = A();
      if (a && a.onChange) a.onChange(function (u) { var now = !!u; if (now && !signed) pull(); signed = now; draw(); });
      else setTimeout(arm, 200);
    })();
    draw();
    return api;
  }

  window.PracticeScores = { open: open };
})();
