/* ====================================================================
   MUSIC ARCADE — shared high-score module
   --------------------------------------------------------------------
   Global leaderboard backed by Supabase (a free hosted database).
   Every game submits {game, initials, score}; the arcade page and each
   game read back the top scores. If the backend isn't configured (or is
   offline) it falls back to a per-device best in localStorage, so the
   pages never break.

   SETUP (one-time):
     1. Create a free project at https://supabase.com
     2. SQL Editor → run the snippet in SETUP.sql (kept alongside this file)
     3. Settings → API → copy the Project URL and the "anon public" key
     4. Paste them into CONFIG below.
   The anon key is safe to expose in client-side code (that's what it's for).
   ==================================================================== */
(function (global) {
  'use strict';

  const CONFIG = {
    url:     'PASTE_YOUR_SUPABASE_URL_HERE',       // e.g. https://abcdxyz.supabase.co
    anonKey: 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE'   // the "anon public" key
  };

  const configured = () =>
    /^https:\/\/.+\.supabase\.co/.test(CONFIG.url) && CONFIG.anonKey.length > 20;

  // ---------- localStorage fallback ----------
  const LKEY = g => 'hiscore:' + g;
  function localTop(game, n) {
    try { const a = JSON.parse(localStorage.getItem(LKEY(game)) || '[]');
      return a.sort((x, y) => y.score - x.score).slice(0, n); } catch (_) { return []; }
  }
  function localAdd(game, initials, score) {
    const a = localTop(game, 100);
    a.push({ initials, score });
    a.sort((x, y) => y.score - x.score);
    try { localStorage.setItem(LKEY(game), JSON.stringify(a.slice(0, 25))); } catch (_) {}
  }

  // ---------- Supabase REST ----------
  function headers() {
    return { apikey: CONFIG.anonKey, Authorization: 'Bearer ' + CONFIG.anonKey };
  }
  async function remoteTop(game, n) {
    const url = CONFIG.url + '/rest/v1/scores?select=initials,score' +
      '&game=eq.' + encodeURIComponent(game) + '&order=score.desc&limit=' + n;
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) throw new Error('read ' + r.status);
    return await r.json();
  }
  async function remoteAdd(game, initials, score) {
    const r = await fetch(CONFIG.url + '/rest/v1/scores', {
      method: 'POST',
      headers: Object.assign(headers(), { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ game, initials, score })
    });
    if (!r.ok) throw new Error('write ' + r.status);
  }

  // ---------- public API ----------
  const HiScores = {
    /** true when a real backend is wired up */
    online() { return configured(); },

    /** top N scores for a game → [{initials, score}], falls back to local */
    async top(game, n = 10) {
      if (configured()) { try { return await remoteTop(game, n); } catch (_) {} }
      return localTop(game, n);
    },

    /** highest score for a game, or null */
    async best(game) { const t = await this.top(game, 1); return t[0] || null; },

    /** submit a score (also mirrored locally). initials trimmed to 3 A–Z */
    async submit(game, score, initials) {
      initials = (initials || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
      score = Math.max(0, Math.round(+score || 0));
      localAdd(game, initials, score);
      if (configured()) { try { await remoteAdd(game, initials, score); } catch (_) {} }
      return { initials, score };
    },

    /** true if `score` would make the top `n` for `game` (for "new high score!") */
    async isHigh(game, score, n = 10) {
      const t = await this.top(game, n);
      return t.length < n || score > (t[t.length - 1].score || 0);
    },

    /** arcade-style 3-letter initials entry → Promise<string> ('' if cancelled) */
    enterInitials(defaultInitials = 'AAA') {
      return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.setAttribute('style',
          'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
          'background:rgba(23,20,14,.86);font-family:"Space Mono",ui-monospace,monospace;');
        let letters = (defaultInitials + 'AAA').slice(0, 3).toUpperCase().split('');
        const box = document.createElement('div');
        box.setAttribute('style',
          'background:#F4EEE2;border:2.5px solid #17140E;box-shadow:8px 8px 0 #17140E;padding:22px 26px;text-align:center;');
        box.innerHTML =
          '<div style="font-family:Syne,sans-serif;font-weight:800;text-transform:uppercase;color:#2438C8;font-size:1.2rem;margin-bottom:4px">New high score!</div>' +
          '<div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#6F6757;margin-bottom:14px">Enter your initials</div>' +
          '<div id="hsRow" style="display:flex;gap:10px;justify-content:center;margin-bottom:16px"></div>' +
          '<button id="hsOk" style="font-family:Hanken Grotesk,sans-serif;font-weight:600;font-size:.95rem;padding:9px 22px;border:2.5px solid #17140E;background:#2438C8;color:#fff;cursor:pointer;box-shadow:3px 3px 0 #17140E">Save</button>';
        wrap.appendChild(box); document.body.appendChild(wrap);
        const row = box.querySelector('#hsRow');
        const slots = letters.map((ch, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = ch;
          b.setAttribute('style', 'width:52px;height:64px;border:2.5px solid #17140E;background:#FBF7EE;' +
            'font-family:Syne,sans-serif;font-weight:800;font-size:2rem;color:#17140E;cursor:pointer;box-shadow:2px 2px 0 #17140E');
          b.addEventListener('click', () => { letters[i] = next(letters[i]); b.textContent = letters[i]; });
          row.appendChild(b); return b;
        });
        function next(c) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; const k = A.indexOf(c); return A[(k + 1) % A.length]; }
        // keyboard entry too
        let idx = 0;
        function onKey(e) {
          const k = e.key.toUpperCase();
          if (/^[A-Z0-9]$/.test(k)) { letters[idx % 3] = k; slots[idx % 3].textContent = k; idx++; e.preventDefault(); }
          else if (e.key === 'Backspace') { idx = Math.max(0, idx - 1); e.preventDefault(); }
          else if (e.key === 'Enter') { done(); }
        }
        function done() { window.removeEventListener('keydown', onKey); wrap.remove(); resolve(letters.join('')); }
        box.querySelector('#hsOk').addEventListener('click', done);
        window.addEventListener('keydown', onKey);
      });
    }
  };

  global.HiScores = HiScores;
})(window);
