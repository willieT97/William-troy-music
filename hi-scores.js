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
    url:     'https://txzxmwwqqrapcirtrurt.supabase.co',
    anonKey: 'sb_publishable_7DFs8Be2RgFe38U3k_HmtA_k1md1zlX'  // publishable key — safe in the browser
  };

  const configured = () =>
    /^https:\/\/.+\.supabase\.co/.test(CONFIG.url) && CONFIG.anonKey.length > 20;

  // keep names readable + safe: letters/numbers/spaces and a little punctuation, max 24
  function cleanName(n) {
    n = (n == null ? '' : String(n)).replace(/[^\p{L}\p{N} .'\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return n || 'Player';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // inject the leaderboard stylesheet once (uses the arcade palette with fallbacks)
  let styled = false;
  function injectStyles() {
    if (styled || typeof document === 'undefined') return; styled = true;
    const css =
      '.hsboard{font-family:"Space Mono",ui-monospace,monospace;font-size:.66rem;color:var(--ink,#17140E);width:100%;max-width:260px;margin:14px auto 0;}' +
      '.hsboard h3{font-family:"Space Mono",monospace;font-weight:700;font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted,#6F6757);margin:0 0 5px;display:flex;align-items:center;justify-content:center;gap:6px;}' +
      '.hsboard .hsdot{width:6px;height:6px;border-radius:50%;background:var(--muted,#6F6757);display:inline-block;}' +
      '.hsboard .hsdot.live{background:#1E9E6A;}' +
      '.hsboard ol{list-style:none;margin:0;padding:0;}' +
      '.hsboard li{display:flex;align-items:baseline;padding:2px 0;border-bottom:1px dashed rgba(23,20,14,.22);}' +
      '.hsboard .hsrank{width:1.6em;text-align:right;color:var(--muted,#6F6757);flex:0 0 auto;}' +
      '.hsboard .hsname{flex:1 1 auto;text-align:left;padding:0 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.hsboard .hssc{font-weight:700;color:var(--blue,#2438C8);flex:0 0 auto;}' +
      '.hsboard li.hsyou{color:var(--pink,#FF4E86);}.hsboard li.hsyou .hssc{color:var(--pink,#FF4E86);}' +
      '.hsboard .hsempty{color:var(--muted,#6F6757);opacity:.7;padding:3px 0;}' +
      '.hsboard.hsfixed{margin:14px auto 0;}' +
      '@media(min-width:1121px){.hsboard.hsfixed{position:fixed;top:50%;right:16px;transform:translateY(-50%);width:186px;max-width:186px;margin:0;background:var(--paper,#F4EEE2);border:2.5px solid var(--ink,#17140E);box-shadow:6px 6px 0 var(--ink,#17140E);padding:12px 14px 14px;z-index:50;}}';
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

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

    /** last name this device entered (remembered between games) */
    playerName() { try { return localStorage.getItem('hiscore:name') || ''; } catch (_) { return ''; } },

    /** top N scores for a game → [{initials, score}], falls back to local */
    async top(game, n = 10) {
      if (configured()) { try { return await remoteTop(game, n); } catch (_) {} }
      return localTop(game, n);
    },

    /** highest score for a game, or null */
    async best(game) { const t = await this.top(game, 1); return t[0] || null; },

    /** submit a score (also mirrored locally). name trimmed to 24 chars */
    async submit(game, score, name) {
      name = cleanName(name);
      score = Math.max(0, Math.round(+score || 0));
      try { localStorage.setItem('hiscore:name', name); } catch (_) {}
      localAdd(game, name, score);
      if (configured()) { try { await remoteAdd(game, name, score); } catch (_) {} }
      return { name, initials: name, score };
    },

    /** true if `score` would make the top `n` for `game` (for "new high score!") */
    async isHigh(game, score, n = 10) {
      const t = await this.top(game, n);
      return t.length < n || score > (t[t.length - 1].score || 0);
    },

    /** arcade-style name entry → Promise<string> ('' if cancelled) */
    enterName(defaultName = '') {
      return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.setAttribute('style',
          'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
          'background:rgba(23,20,14,.86);font-family:"Space Mono",ui-monospace,monospace;padding:16px;');
        const box = document.createElement('div');
        box.setAttribute('style',
          'background:#F4EEE2;border:2.5px solid #17140E;box-shadow:8px 8px 0 #17140E;padding:22px 26px;text-align:center;max-width:340px;width:100%;');
        box.innerHTML =
          '<div style="font-family:Syne,sans-serif;font-weight:800;text-transform:uppercase;color:#2438C8;font-size:1.2rem;margin-bottom:4px">New high score!</div>' +
          '<div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#6F6757;margin-bottom:14px">Enter your name</div>' +
          '<input id="hsName" type="text" maxlength="24" autocomplete="off" spellcheck="false" ' +
          'style="width:100%;box-sizing:border-box;font-family:Syne,sans-serif;font-weight:800;font-size:1.5rem;text-align:center;' +
          'color:#17140E;background:#FBF7EE;border:2.5px solid #17140E;box-shadow:2px 2px 0 #17140E;padding:10px 12px;margin-bottom:16px;outline:none;" />' +
          '<button id="hsOk" style="font-family:Hanken Grotesk,sans-serif;font-weight:600;font-size:.95rem;padding:9px 22px;border:2.5px solid #17140E;background:#2438C8;color:#fff;cursor:pointer;box-shadow:3px 3px 0 #17140E">Save</button>';
        wrap.appendChild(box); document.body.appendChild(wrap);
        const input = box.querySelector('#hsName');
        input.value = defaultName || '';
        setTimeout(() => { input.focus(); input.select(); }, 30);
        function done() {
          window.removeEventListener('keydown', onKey);
          const v = input.value; wrap.remove(); resolve(v);
        }
        function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); done(); } }
        box.querySelector('#hsOk').addEventListener('click', done);
        window.addEventListener('keydown', onKey);
      });
    },

    /** back-compat alias */
    enterInitials(def) { return this.enterName(typeof def === 'string' && def !== 'AAA' ? def : ''); },

    /**
     * Render a self-contained leaderboard into `container` and return an API.
     *   opts.n      how many rows (default 5)
     *   opts.title  heading text (default "High Scores")
     * Returns { refresh(highlight?), submitIfHigh(value) }.
     *   submitIfHigh: if `value` would make the top N, prompt for a name,
     *   submit it, and re-render with that row highlighted. Returns bool.
     */
    mountBoard(container, game, opts) {
      opts = opts || {};
      const n = opts.n || 5;
      const title = opts.title || 'High Scores';
      injectStyles();
      container.classList.add('hsboard');
      if (opts.fixed) {
        container.classList.add('hsfixed');
        // vertically align the fixed panel with the game's frame (the .panel), synced live
        const anchor = opts.anchor || document.querySelector('.panel') || document.querySelector('.stage');
        if (anchor && window.matchMedia) {
          const mq = window.matchMedia('(min-width:1121px)');
          const place = () => {
            if (mq.matches) {
              const r = anchor.getBoundingClientRect();
              container.style.position = 'fixed';
              container.style.top = Math.max(12, r.top) + 'px';
              container.style.left = (r.right + 22) + 'px';
              container.style.right = 'auto';
              container.style.transform = 'none';
            } else {
              container.style.position = container.style.top = container.style.left =
                container.style.right = container.style.transform = '';
            }
          };
          place();
          window.addEventListener('resize', place);
          window.addEventListener('scroll', place, { passive: true });
          window.addEventListener('load', place);
          setTimeout(place, 300);
          if (mq.addEventListener) mq.addEventListener('change', place); else if (mq.addListener) mq.addListener(place);
        }
      }
      container.innerHTML = '<h3><span class="hsdot"></span>' + esc(title) + '</h3><ol></ol>';
      const self = this;
      async function refresh(highlight) {
        let rows = []; try { rows = await self.top(game, n); } catch (_) {}
        const dot = container.querySelector('.hsdot'); if (dot) dot.classList.toggle('live', configured());
        const ol = container.querySelector('ol');
        if (!rows.length) { ol.innerHTML = '<li class="hsempty">No scores yet — be the first!</li>'; return; }
        let hl = highlight != null;
        ol.innerHTML = rows.map((r, i) => {
          const you = hl && r.score === highlight; if (you) hl = false;
          return '<li class="' + (you ? 'hsyou' : '') + '"><span class="hsrank">' + (i + 1) +
            '</span><span class="hsname">' + esc(r.initials) + '</span><span class="hssc">' + r.score + '</span></li>';
        }).join('');
      }
      async function submitIfHigh(value) {
        value = Math.max(0, Math.round(+value || 0));
        if (value > 0 && await self.isHigh(game, value, n)) {
          const nm = await self.enterName(self.playerName());
          if (nm) { await self.submit(game, value, nm); await refresh(value); return true; }
        }
        await refresh(); return false;
      }
      refresh();
      return { refresh, submitIfHigh };
    }
  };

  global.HiScores = HiScores;
})(window);
