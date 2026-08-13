/* ====================================================================
   MUSIC ARCADE — shared accounts module (Supabase Auth, email + password)
   --------------------------------------------------------------------
   Include on any page:  <script src="/auth.js" defer></script>
   It injects a top-right account control + a sign-in / sign-up modal,
   keeps the session across pages, and exposes a tiny API:

     MAAuth.onChange(fn)   -> fn(user, profile) now + on every change; returns an unsubscribe
     MAAuth.user()         -> the signed-in user (or null)
     MAAuth.profile()      -> { username } (or null)
     MAAuth.open('signin'|'signup'|'account')
     MAAuth.signOut()
     MAAuth.client()       -> Promise<supabase client>  (for per-user data: save/sync, etc.)

   Backend: the same Supabase project the gallery + hi-scores use. The
   publishable key is safe in the browser; every table is locked with RLS.
   Run supabase-auth.sql once and enable Email auth in the dashboard.
   ==================================================================== */
(function () {
  'use strict';
  if (window.MAAuth) return; // don't double-load

  var SB = { url: 'https://txzxmwwqqrapcirtrurt.supabase.co', anonKey: 'sb_publishable_7DFs8Be2RgFe38U3k_HmtA_k1md1zlX' };
  var sb = null, sbReady = null, user = null, profile = null, booted = false, listeners = [];
  var entitlements = [], entListeners = [];

  // ---- supabase client (session persisted in localStorage → shared across pages) ----
  function ensureSb() {
    if (sbReady) return sbReady;
    sbReady = new Promise(function (res, rej) {
      function mk() { try { sb = window.supabase.createClient(SB.url, SB.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); res(sb); } catch (e) { rej(e); } }
      if (window.supabase && window.supabase.createClient) return mk();
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = mk; s.onerror = function () { rej(new Error('Could not load the sign-in library.')); };
      document.head.appendChild(s);
    });
    return sbReady;
  }
  function emit() { listeners.forEach(function (cb) { try { cb(user, profile); } catch (e) {} }); }

  // ---- entitlements (Pro subscription + one-time purchases); written only by the payment webhook ----
  function activeEnt(e) { return e && e.status === 'active' && (!e.period_end || new Date(e.period_end) > new Date()); }
  function loadEntitlements() {
    if (!user) { entitlements = []; return Promise.resolve([]); }
    return sb.from('entitlements').select('product,kind,status,period_end').eq('user_id', user.id)
      .then(function (r) { entitlements = (r && !r.error && r.data) ? r.data : []; return entitlements; })
      .catch(function () { entitlements = []; return entitlements; });
  }
  function emitEnt() { entListeners.forEach(function (cb) { try { cb(entitlements); } catch (e) {} }); }
  function fetchProfile() {
    if (!user) { profile = null; return Promise.resolve(null); }
    return sb.from('profiles').select('username,role').eq('id', user.id).maybeSingle()
      .then(function (r) {
        // supabase-roles.sql not run yet → no `role` column. Don't lose the username over it.
        if (r && r.error) return sb.from('profiles').select('username').eq('id', user.id).maybeSingle()
          .then(function (r2) { profile = (r2 && r2.data) || null; return profile; });
        profile = (r && r.data) || null; return profile;
      })
      .catch(function () { profile = null; return null; });
  }
  function roleOf() { return (profile && profile.role) === 'teacher' ? 'teacher' : 'player'; }
  function displayName() {
    if (profile && profile.username) return profile.username;
    if (user && user.email) return user.email.split('@')[0];
    return 'Account';
  }

  // ---- public API ----
  window.MAAuth = {
    ready: ensureSb,
    user: function () { return user; },
    profile: function () { return profile; },
    onChange: function (cb) { listeners.push(cb); if (booted) { try { cb(user, profile); } catch (e) {} } return function () { var i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
    open: function (view) { openModal(view || (user ? 'account' : 'signin')); },
    close: closeModal,
    signOut: function () { return ensureSb().then(function () { return sb.auth.signOut(); }); },
    client: function () { return ensureSb().then(function () { return sb; }); },
    // player | teacher — teachers get the Rollbook tab in the site nav
    role: function () { return roleOf(); },
    isTeacher: function () { return roleOf() === 'teacher'; },
    setRole: function (r) { return ensureSb().then(needUser).then(function () { return saveRole(r); }); },
    // entitlements — read-only in the browser; the webhook is the source of truth
    entitlements: function () { return entitlements.slice(); },
    isPro: function () { return entitlements.some(function (e) { return e.product === 'pro' && activeEnt(e); }); },
    owns: function (product) { return entitlements.some(function (e) { return e.product === product && activeEnt(e); }); },
    hasAccess: function (product) { return window.MAAuth.isPro() || window.MAAuth.owns(product); },
    onEntitlements: function (cb) { entListeners.push(cb); if (booted) { try { cb(entitlements); } catch (e) {} } return function () { var i = entListeners.indexOf(cb); if (i >= 0) entListeners.splice(i, 1); }; },
    // re-fetch entitlements now (e.g. right after a checkout, while the webhook lands)
    refreshEntitlements: function () { return ensureSb().then(loadEntitlements).then(function (e) { renderControl(); emitEnt(); return e; }); }
  };

  // ---- per-user creations (save & sync); requires a signed-in user ----
  function needUser() { return user ? Promise.resolve() : Promise.reject(new Error('not signed in')); }
  window.MAAuth.creations = {
    list: function (kind) { return ensureSb().then(needUser).then(function () {
      return sb.from('creations').select('id,title,data,updated_at').eq('user_id', user.id).eq('kind', kind).order('updated_at', { ascending: false })
        .then(function (r) { if (r.error) throw r.error; return r.data || []; }); }); },
    get: function (id) { return ensureSb().then(needUser).then(function () {
      return sb.from('creations').select('id,title,data').eq('id', id).eq('user_id', user.id).maybeSingle()
        .then(function (r) { if (r.error) throw r.error; return r.data; }); }); },
    save: function (kind, item) { return ensureSb().then(needUser).then(function () {
      var t = (item.title || 'Untitled').slice(0, 80);
      if (item.id) return sb.from('creations').update({ title: t, data: item.data }).eq('id', item.id).eq('user_id', user.id).select('id,title,data,updated_at').single().then(chk);
      return sb.from('creations').insert({ user_id: user.id, kind: kind, title: t, data: item.data }).select('id,title,data,updated_at').single().then(chk);
      function chk(r) { if (r.error) throw r.error; return r.data; } }); },
    remove: function (id) { return ensureSb().then(needUser).then(function () {
      return sb.from('creations').delete().eq('id', id).eq('user_id', user.id).then(function (r) { if (r.error) throw r.error; return true; }); }); }
  };
  // ---- keyed progress (one creations row per course, kind 'progress', title = course id) ----
  window.MAAuth.progress = (function () {
    var ids = {};   // course id -> creations row id (remembered for the session so pushes update, not duplicate)
    return {
      pull: function (course) {
        return window.MAAuth.creations.list('progress').then(function (rows) {
          var row = null; for (var i = 0; i < rows.length; i++) { if (rows[i].title === course) { row = rows[i]; break; } }
          if (row) ids[course] = row.id;
          return row ? row.data : null;
        });
      },
      push: function (course, data) {
        return window.MAAuth.creations.save('progress', { id: ids[course], title: course, data: data })
          .then(function (row) { if (row && row.id) ids[course] = row.id; return row; });
      }
    };
  })();

  window.MAAuth.usernameFree = function (name) { return usernameFree(name); };
  window.MAAuth.setUsername = function (name) { return ensureSb().then(needUser).then(function () {
    return saveUsername(name || null).then(function (r) { if (r && r.error) throw r.error; profile = { username: name || null, role: roleOf() }; renderControl(); emit(); return profile; }); }); };

  // ---- reusable Save/open panel: cloud when signed in, this-device localStorage when signed out ----
  // MAAuth.mountVault(container, { kind, noun, getState, applyState })
  window.MAAuth.mountVault = function (container, opts) {
    var kind = opts.kind, noun = opts.noun || 'creation', LK = 'mavault.' + kind, busy = false;
    function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function local() { try { return JSON.parse(localStorage.getItem(LK)) || []; } catch (e) { return []; } }
    function setLocal(a) { try { localStorage.setItem(LK, JSON.stringify(a)); } catch (e) {} }
    function toast(m) { maToast(m); }
    function render() {
      container.innerHTML = '';
      var signedIn = !!user;
      // save row
      var row = el('div', 'mav-row');
      var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'mav-name'; inp.placeholder = 'name this ' + noun + '…'; inp.maxLength = 80;
      var save = el('button', 'mav-save', 'Save'); save.type = 'button';
      row.appendChild(inp); row.appendChild(save); container.appendChild(row);
      // status line
      var note = el('div', 'mav-note');
      if (signedIn) note.textContent = 'Saved to your account — on any device.';
      else { note.appendChild(document.createTextNode('Saved on this device. ')); var a = el('a', 'mav-link', 'Sign in'); a.href = '#'; a.addEventListener('click', function (e) { e.preventDefault(); window.MAAuth.open('signin'); }); note.appendChild(a); note.appendChild(document.createTextNode(' to sync everywhere.')); }
      container.appendChild(note);
      var listEl = el('div', 'mav-list'); container.appendChild(listEl);

      save.addEventListener('click', function () {
        if (busy) return; var title = (inp.value || '').trim() || ('Untitled ' + noun); var data = opts.getState();
        busy = true; save.disabled = true;
        if (signedIn) window.MAAuth.creations.save(kind, { title: title, data: data }).then(function () { inp.value = ''; toast('Saved “' + title + '”'); busy = false; save.disabled = false; render(); })
          .catch(function (e) { busy = false; save.disabled = false; toast('Couldn’t save — ' + (e.message || 'try again')); });
        else { var a = local(); a.unshift({ id: uid(), title: title, data: data, updated_at: new Date().toISOString() }); setLocal(a); inp.value = ''; toast('Saved “' + title + '” on this device'); busy = false; save.disabled = false; render(); }
      });

      function drawItems(items) {
        listEl.innerHTML = '';
        if (!items.length) { listEl.appendChild(el('div', 'mav-empty', 'No saved ' + noun + 's yet.')); return; }
        items.forEach(function (it) {
          var r = el('div', 'mav-item');
          var nm = el('span', 'mav-itnm', it.title || ('Untitled ' + noun)); r.appendChild(nm);
          var open = el('button', 'mav-mini', 'Open'); open.type = 'button'; open.addEventListener('click', function () { opts.applyState(it.data); toast('Opened “' + (it.title || noun) + '”'); }); r.appendChild(open);
          var del = el('button', 'mav-mini mav-del', '✕'); del.type = 'button'; del.title = 'Delete';
          del.addEventListener('click', function () {
            if (signedIn) window.MAAuth.creations.remove(it.id).then(render).catch(function (e) { toast('Couldn’t delete — ' + (e.message || '')); });
            else { setLocal(local().filter(function (x) { return x.id !== it.id; })); render(); }
          }); r.appendChild(del);
          listEl.appendChild(r);
        });
      }
      if (signedIn) { listEl.appendChild(el('div', 'mav-empty', 'Loading…')); window.MAAuth.creations.list(kind).then(drawItems).catch(function (e) { listEl.innerHTML = ''; listEl.appendChild(el('div', 'mav-empty', 'Couldn’t load your ' + noun + 's.')); }); }
      else drawItems(local());
    }
    injectVaultStyles();
    var off = window.MAAuth.onChange(function () { render(); });
    render();
    return off;
  };
  function injectVaultStyles() {
    if (document.getElementById('mav-styles')) return;
    var css = '' +
      '.mav-row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;}' +
      '.mav-name{flex:1;min-width:150px;font:inherit;font-weight:600;padding:9px 11px;border:2.5px solid #17140E;border-radius:10px;background:#fff;box-shadow:2px 2px 0 #17140E;}' +
      '.mav-save{cursor:pointer;border:2.5px solid #17140E;border-radius:10px;background:#1F9D55;color:#fff;font-weight:800;padding:9px 18px;box-shadow:2px 2px 0 #17140E;}' +
      '.mav-save:active{transform:translate(2px,2px);box-shadow:none;} .mav-save[disabled]{opacity:.6;}' +
      '.mav-note{font-size:.78rem;font-weight:700;color:#8a7f6a;margin-bottom:10px;} .mav-link{color:#2438C8;font-weight:800;}' +
      '.mav-list{display:flex;flex-direction:column;gap:7px;}' +
      '.mav-item{display:flex;align-items:center;gap:9px;border:2px solid #e4dcc9;border-radius:11px;padding:8px 11px;}' +
      '.mav-itnm{flex:1;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.mav-mini{cursor:pointer;border:2px solid #17140E;border-radius:8px;background:#fff;color:#17140E;font-weight:800;font-size:.8rem;padding:5px 11px;box-shadow:2px 2px 0 #17140E;}' +
      '.mav-mini:active{transform:translate(2px,2px);box-shadow:none;} .mav-del{color:#C0453B;padding:5px 9px;}' +
      '.mav-empty{color:#8a7f6a;font-weight:700;font-size:.86rem;padding:2px 0;}';
    var st = document.createElement('style'); st.id = 'mav-styles'; st.textContent = css; document.head.appendChild(st);
  }

  // ---- auth actions ----
  function doSignUp(email, pw, username, role) { return ensureSb().then(function () { return sb.auth.signUp({ email: email, password: pw, options: { data: { username: username, role: (role === 'teacher' ? 'teacher' : 'player') } } }); }); }
  function doSignIn(email, pw) { return ensureSb().then(function () { return sb.auth.signInWithPassword({ email: email, password: pw }); }); }
  function doGoogle() { return ensureSb().then(function () { return sb.auth.signInWithOAuth({ provider: 'google' }); }); } // returns to Supabase Site URL (no redirect allowlist needed)
  function doReset(email) { return ensureSb().then(function () { return sb.auth.resetPasswordForEmail(email); }); } // reset email → Site URL
  function doUpdatePassword(pw) { return ensureSb().then(function () { return sb.auth.updateUser({ password: pw }); }); }
  function usernameFree(name) { return ensureSb().then(function () { return sb.rpc('username_available', { p_name: name }).then(function (r) { return r.error ? true : !!r.data; }); }); }
  function saveUsername(name) { return ensureSb().then(function () { return sb.from('profiles').update({ username: name }).eq('id', user.id); }); }
  function saveRole(r) {
    var want = (r === 'teacher') ? 'teacher' : 'player';
    // via ensureSb so a not-yet-ready client rejects instead of throwing mid-callback
    return ensureSb().then(needUser).then(function () {
      return sb.from('profiles').update({ role: want }).eq('id', user.id);
    }).then(function (res) {
      if (res && res.error) throw res.error;
      profile = profile || {}; profile.role = want;
      renderControl(); syncNavTabs(); emit();
      return want;
    });
  }

  // ---- styles ----
  function injectStyles() {
    if (document.getElementById('maa-styles')) return;
    var css = '' +
      '.maa-ctl{position:fixed;top:10px;right:12px;z-index:9000;display:flex;gap:8px;align-items:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}' +
      '.maa-pro{cursor:pointer;text-decoration:none;border:2.5px solid #17140E;border-radius:999px;background:#FF4E86;color:#fff;font-weight:800;font-size:.8rem;line-height:1;padding:7px 12px;box-shadow:2px 2px 0 #17140E;white-space:nowrap;}' +
      '.maa-pro:active{transform:translate(2px,2px);box-shadow:none;}' +
      '.maa-btn{cursor:pointer;border:2.5px solid #17140E;border-radius:999px;background:#fff;color:#17140E;font-weight:800;font-size:.82rem;' +
        'padding:7px 14px;box-shadow:2px 2px 0 #17140E;display:inline-flex;align-items:center;gap:7px;line-height:1;max-width:46vw;}' +
      '.maa-btn:active{transform:translate(2px,2px);box-shadow:none;}' +
      '.maa-btn .maa-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:30vw;}' +
      '.maa-av{width:20px;height:20px;border-radius:50%;background:#2438C8;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;flex:none;}' +
      '.maa-modal{position:fixed;inset:0;z-index:9500;background:rgba(20,16,10,.55);display:none;align-items:center;justify-content:center;padding:18px;}' +
      '.maa-modal.on{display:flex;}' +
      '.maa-card{width:100%;max-width:380px;background:#FFFDF7;color:#17140E;border:3px solid #17140E;border-radius:18px;box-shadow:7px 8px 0 rgba(0,0,0,.35);' +
        'padding:20px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-height:90vh;overflow:auto;}' +
      '.maa-h{display:flex;align-items:center;gap:10px;margin:0 0 4px;}' +
      '.maa-h h3{font-family:"Syne",system-ui,sans-serif;font-weight:800;font-size:1.3rem;margin:0;flex:1;}' +
      '.maa-x{cursor:pointer;border:none;background:none;font-size:1.4rem;line-height:1;color:#8a7f6a;padding:2px 4px;}' +
      '.maa-tabs{display:flex;gap:8px;margin:12px 0 14px;}' +
      '.maa-tab{flex:1;cursor:pointer;border:2.5px solid #17140E;border-radius:11px;background:#fff;color:#17140E;font-weight:800;font-size:.85rem;padding:8px;box-shadow:2px 2px 0 #17140E;}' +
      '.maa-tab.on{background:#17140E;color:#FFFDF7;}' +
      '.maa-roles{display:flex;gap:8px;margin:2px 0 14px;}' +
      '.maa-role{flex:1;cursor:pointer;text-align:left;border:2.5px solid #17140E;border-radius:11px;background:#fff;color:#17140E;padding:9px 11px;box-shadow:2px 2px 0 #17140E;}' +
      '.maa-role b{display:block;font-weight:800;font-size:.86rem;}' +
      '.maa-role span{display:block;font-size:.7rem;opacity:.7;line-height:1.3;margin-top:2px;}' +
      '.maa-role.on{background:#17140E;color:#FFFDF7;}' +
      '.maa-role.on span{opacity:.75;}' +
      '.maa-lbl{font-weight:800;font-size:.74rem;letter-spacing:.04em;text-transform:uppercase;opacity:.65;margin:2px 0 6px;}' +
      '.maa-f{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}' +
      '.maa-f label{font-weight:800;font-size:.62rem;letter-spacing:.07em;text-transform:uppercase;color:#8a7f6a;}' +
      '.maa-f input{font:inherit;font-weight:600;padding:10px 11px;border:2.5px solid #17140E;border-radius:10px;background:#fff;box-shadow:2px 2px 0 #17140E;}' +
      '.maa-f input:focus{outline:3px solid #2438C8;outline-offset:1px;}' +
      '.maa-go{width:100%;cursor:pointer;border:2.5px solid #17140E;border-radius:12px;background:#1F9D55;color:#fff;font-family:"Syne",system-ui,sans-serif;' +
        'font-weight:800;font-size:1.05rem;padding:12px;box-shadow:3px 3px 0 #17140E;}' +
      '.maa-go:active{transform:translate(3px,3px);box-shadow:none;} .maa-go[disabled]{opacity:.6;cursor:default;}' +
      '.maa-google{width:100%;cursor:pointer;border:2.5px solid #17140E;border-radius:12px;background:#fff;color:#17140E;font-weight:800;font-size:.95rem;padding:11px;box-shadow:2px 2px 0 #17140E;display:flex;align-items:center;justify-content:center;gap:9px;}' +
      '.maa-google:active{transform:translate(2px,2px);box-shadow:none;} .maa-google svg{flex:none;}' +
      '.maa-or{display:flex;align-items:center;gap:10px;color:#8a7f6a;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;margin:13px 0;}' +
      '.maa-or::before,.maa-or::after{content:"";flex:1;height:2px;background:#e4dcc9;}' +
      '.maa-forgot{display:block;text-align:center;margin-top:12px;color:#2438C8;font-weight:700;font-size:.82rem;text-decoration:none;cursor:pointer;}' +
      '.maa-alt{width:100%;margin-top:9px;cursor:pointer;border:2.5px solid #17140E;border-radius:12px;background:#fff;color:#17140E;font-weight:800;font-size:.92rem;padding:10px;box-shadow:2px 2px 0 #17140E;}' +
      '.maa-msg{font-size:.85rem;font-weight:700;margin:2px 0 10px;min-height:1em;}' +
      '.maa-msg.err{color:#C0453B;} .maa-msg.ok{color:#1F9D55;}' +
      '.maa-sub{font-size:.8rem;color:#8a7f6a;font-weight:600;margin:0 0 12px;}' +
      '.maa-hint{font-size:.72rem;color:#8a7f6a;font-weight:600;margin-top:2px;}' +
      '.maa-pw-badge{display:inline-block;font-weight:800;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:#8a5a00;background:#FFE9A8;border:2px solid #17140E;border-radius:999px;padding:3px 10px;margin:0 0 12px;}' +
      '.maa-golink{display:block;text-align:center;text-decoration:none;box-sizing:border-box;}' +
      '@media (prefers-reduced-motion:reduce){.maa-btn,.maa-go,.maa-tab{transition:none;}}';
    var st = document.createElement('style'); st.id = 'maa-styles'; st.textContent = css; document.head.appendChild(st);
  }

  // ---- account control (top-right) ----
  var ctl;
  function renderControl() {
    if (!ctl) { ctl = document.createElement('div'); ctl.className = 'maa-ctl'; (document.body || document.documentElement).appendChild(ctl); }
    ctl.innerHTML = '';
    if (user && !(window.MAAuth.isPro && window.MAAuth.isPro())) {   // signed in but not Pro → discoverable upgrade
      var pro = document.createElement('a'); pro.className = 'maa-pro'; pro.href = '/upgrade.html';
      pro.textContent = '✦ Go Pro'; pro.title = 'Unlock every course & pack';
      ctl.appendChild(pro);
    }
    var b = document.createElement('button'); b.type = 'button'; b.className = 'maa-btn';
    if (user) {
      var nm = displayName();
      var av = document.createElement('span'); av.className = 'maa-av'; av.textContent = (nm[0] || '?').toUpperCase();
      var sp = document.createElement('span'); sp.className = 'maa-nm'; sp.textContent = nm;
      b.appendChild(av); b.appendChild(sp); b.title = 'Your account';
      b.addEventListener('click', function () { openModal('account'); });
    } else {
      b.textContent = 'Sign in'; b.title = 'Sign in or create an account';
      b.addEventListener('click', function () { openModal('signin'); });
    }
    ctl.appendChild(b);
    syncNavTabs();
  }

  // ---- modal ----
  var modal, cardBody, view = 'signin';
  function buildModal() {
    modal = document.createElement('div'); modal.className = 'maa-modal';
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    var card = document.createElement('div'); card.className = 'maa-card';
    cardBody = document.createElement('div'); card.appendChild(cardBody);
    modal.appendChild(card); (document.body || document.documentElement).appendChild(modal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('on')) closeModal(); });
  }
  function openModal(v) { if (!modal) buildModal(); view = v; renderModal(); modal.classList.add('on'); }
  function closeModal() { if (modal) modal.classList.remove('on'); }

  // ---- reusable paywall overlay: MAAuth.paywall({ title, body, product }) ----
  var pwEl = null;
  function closePaywall() { if (pwEl) pwEl.classList.remove('on'); }
  window.MAAuth.paywall = function (opts) {
    opts = opts || {};
    injectStyles();
    if (!pwEl) { pwEl = document.createElement('div'); pwEl.className = 'maa-modal'; document.body.appendChild(pwEl);
      pwEl.addEventListener('click', function (e) { if (e.target === pwEl) closePaywall(); }); }
    var title = opts.title || 'A Pro lesson';
    var body = opts.body || 'This is part of Music Arcade Pro.';
    var href = '/upgrade.html' + (opts.product ? ('?highlight=' + encodeURIComponent(opts.product)) : '');
    pwEl.innerHTML =
      '<div class="maa-card">' +
        '<div class="maa-h"><h3></h3><button class="maa-x" type="button" aria-label="Close">×</button></div>' +
        '<div class="maa-pw-badge">✦ Music Arcade Pro</div>' +
        '<p class="maa-sub"></p>' +
        '<a class="maa-go maa-golink" href="' + href + '">See plans →</a>' +
        (user ? '' : '<button class="maa-alt" type="button" data-pw="signin">I already have an account — sign in</button>') +
      '</div>';
    pwEl.querySelector('.maa-h h3').textContent = title;   // textContent → safe against any markup in the strings
    pwEl.querySelector('.maa-sub').textContent = body;
    pwEl.querySelector('.maa-x').addEventListener('click', closePaywall);
    var si = pwEl.querySelector('[data-pw="signin"]');
    if (si) si.addEventListener('click', function () { closePaywall(); openModal('signin'); });
    pwEl.classList.add('on');
  };

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var _toastEl, _toastT;
  function maToast(msg) {
    if (!_toastEl) { _toastEl = document.createElement('div'); _toastEl.id = 'maa-toast'; (document.body || document.documentElement).appendChild(_toastEl);
      _toastEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#17140E;color:#FFFDF7;font-family:"Syne",system-ui,sans-serif;font-weight:800;font-size:1rem;padding:11px 20px;border-radius:14px;box-shadow:4px 6px 0 rgba(0,0,0,.3);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:9600;max-width:90vw;text-align:center;'; }
    _toastEl.textContent = msg; _toastEl.style.opacity = '1'; _toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(_toastT); _toastT = setTimeout(function () { _toastEl.style.opacity = '0'; _toastEl.style.transform = 'translateX(-50%) translateY(20px)'; }, 1900);
  }
  function field(labelTxt, type, id, ph) {
    var w = el('div', 'maa-f'); var l = el('label', null, labelTxt); l.htmlFor = 'maa-' + id;
    var i = document.createElement('input'); i.type = type; i.id = 'maa-' + id; i.autocomplete = (type === 'password' ? (view === 'signup' ? 'new-password' : 'current-password') : (id === 'email' ? 'email' : 'off')); if (ph) i.placeholder = ph;
    w.appendChild(l); w.appendChild(i); return { wrap: w, input: i };
  }
  function header(title) {
    var h = el('div', 'maa-h'); h.appendChild(el('h3', null, title));
    var x = el('button', 'maa-x', '×'); x.type = 'button'; x.title = 'Close'; x.addEventListener('click', closeModal); h.appendChild(x);
    return h;
  }
  function setMsg(node, text, kind) { node.className = 'maa-msg' + (kind ? ' ' + kind : ''); node.textContent = text || ''; }

  /* Two choices at sign-up. Teachers get the Rollbook — a private weekly timetable
     and lesson log — added to the site nav. Everyone can switch later in Your account. */
  var ROLE_COPY = {
    player:  { t: 'I\u2019m learning',  s: 'Games, courses and practice tools' },
    teacher: { t: 'I teach',        s: 'Adds the Rollbook: timetable & lesson notes' }
  };
  function rolePicker(current, onPick) {
    var wrap = el('div', 'maa-roles'), btns = {};
    ['player', 'teacher'].forEach(function (k) {
      var b = el('button', 'maa-role' + (current === k ? ' on' : '')); b.type = 'button';
      b.appendChild(el('b', null, ROLE_COPY[k].t));
      b.appendChild(el('span', null, ROLE_COPY[k].s));
      b.addEventListener('click', function () {
        current = k;
        Object.keys(btns).forEach(function (x) { btns[x].className = 'maa-role' + (x === k ? ' on' : ''); });
        if (onPick) onPick(k);
      });
      btns[k] = b; wrap.appendChild(b);
    });
    function paint(k) { current = k; Object.keys(btns).forEach(function (x) { btns[x].className = 'maa-role' + (x === k ? ' on' : ''); }); }
    return { wrap: wrap, get: function () { return current; }, set: paint };
  }

  /* Teachers get a Rollbook tab wherever the site's section nav appears.
     Injected rather than hard-coded into 20-odd pages, so it can't drift. */
  function syncNavTabs() {
    var navs = document.querySelectorAll('nav.tabs');
    for (var i = 0; i < navs.length; i++) {
      var nav = navs[i], have = nav.querySelector('a[data-maa-rollbook]');
      if (window.MAAuth.isTeacher()) {
        if (!have) {
          var a = document.createElement('a');
          a.href = '/rollbook.html'; a.textContent = 'Rollbook';
          a.setAttribute('data-maa-rollbook', '1');
          if (/\/rollbook\.html$/.test(location.pathname)) { a.className = 'cur'; a.setAttribute('aria-current', 'page'); }
          nav.appendChild(a);
        }
      } else if (have) { have.parentNode.removeChild(have); }
    }
  }
  window.MAAuth.syncNav = syncNavTabs;

  function renderModal() {
    cardBody.innerHTML = '';
    if (view === 'account') return renderAccount();
    if (view === 'reset') return renderReset();
    // sign in / sign up
    cardBody.appendChild(header(view === 'signup' ? 'Create your account' : 'Welcome back'));
    cardBody.appendChild(el('p', 'maa-sub', 'One account across the whole Music Arcade — save your songs, charts and solos and pick them up on any device.'));
    var tabs = el('div', 'maa-tabs');
    var t1 = el('button', 'maa-tab' + (view === 'signin' ? ' on' : ''), 'Sign in'); t1.type = 'button';
    var t2 = el('button', 'maa-tab' + (view === 'signup' ? ' on' : ''), 'Create account'); t2.type = 'button';
    t1.addEventListener('click', function () { view = 'signin'; renderModal(); });
    t2.addEventListener('click', function () { view = 'signup'; renderModal(); });
    tabs.appendChild(t1); tabs.appendChild(t2); cardBody.appendChild(tabs);

    // Continue with Google
    var gbtn = el('button', 'maa-google'); gbtn.type = 'button';
    gbtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Continue with Google</span>';
    gbtn.addEventListener('click', function () { gbtn.disabled = true; doGoogle().catch(function () { gbtn.disabled = false; }); });
    cardBody.appendChild(gbtn);
    cardBody.appendChild(el('div', 'maa-or', 'or'));

    var form = document.createElement('form'); form.autocomplete = 'on';
    var uname;
    var roles;
    if (view === 'signup') {
      form.appendChild(el('div', 'maa-lbl', 'Which are you?'));
      roles = rolePicker('player'); form.appendChild(roles.wrap);
      uname = field('Username', 'text', 'username', 'e.g. jazzcat'); form.appendChild(uname.wrap);
    }
    var email = field('Email', 'email', 'email', 'you@example.com'); form.appendChild(email.wrap);
    var pw = field('Password', 'password', 'pw', view === 'signup' ? 'at least 6 characters' : ''); form.appendChild(pw.wrap);
    var msg = el('div', 'maa-msg'); form.appendChild(msg);
    var go = el('button', 'maa-go', view === 'signup' ? 'Create account' : 'Sign in'); go.type = 'submit'; form.appendChild(go);
    cardBody.appendChild(form);

    if (view === 'signin') {
      var fp = el('a', 'maa-forgot', 'Forgot your password?'); fp.href = '#';
      fp.addEventListener('click', function (e) { e.preventDefault(); var em = email.input.value.trim();
        if (!/.+@.+\..+/.test(em)) return setMsg(msg, 'Type your email above first, then tap this.', 'err');
        setMsg(msg, 'Sending a reset link…');
        doReset(em).then(function (r) { if (r && r.error) return setMsg(msg, prettyErr(r.error), 'err'); setMsg(msg, 'Check your email for a link to reset your password.', 'ok'); })
          .catch(function (er) { setMsg(msg, prettyErr(er), 'err'); }); });
      cardBody.appendChild(fp);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = email.input.value.trim(), p = pw.input.value;
      if (!/.+@.+\..+/.test(em)) return setMsg(msg, 'Please enter a valid email.', 'err');
      if (!p || p.length < 6) return setMsg(msg, 'Password must be at least 6 characters.', 'err');
      go.disabled = true;
      if (view === 'signup') {
        var un = (uname.input.value || '').trim();
        if (un && !/^[A-Za-z0-9_.\- ]{2,24}$/.test(un)) { go.disabled = false; return setMsg(msg, 'Username: 2–24 letters, numbers, spaces or _ . -', 'err'); }
        setMsg(msg, 'Creating your account…');
        (un ? usernameFree(un) : Promise.resolve(true)).then(function (free) {
          if (!free) { go.disabled = false; return setMsg(msg, 'That username is taken — try another.', 'err'); }
          doSignUp(em, p, un, roles.get()).then(function (r) {
            go.disabled = false;
            if (r.error) return setMsg(msg, prettyErr(r.error), 'err');
            if (r.data && r.data.session) { closeModal(); } // signed in immediately (email confirmation off)
            else setMsg(msg, 'Almost there — check your email to confirm your account, then sign in.', 'ok');
          }).catch(function (er) { go.disabled = false; setMsg(msg, prettyErr(er), 'err'); });
        });
      } else {
        setMsg(msg, 'Signing in…');
        doSignIn(em, p).then(function (r) { go.disabled = false; if (r.error) return setMsg(msg, prettyErr(r.error), 'err'); closeModal(); })
          .catch(function (er) { go.disabled = false; setMsg(msg, prettyErr(er), 'err'); });
      }
    });
    setTimeout(function () { (view === 'signup' ? uname.input : email.input).focus(); }, 30);
  }

  function renderReset() {
    cardBody.appendChild(header('Set a new password'));
    cardBody.appendChild(el('p', 'maa-sub', 'Choose a new password for your account.'));
    var f = document.createElement('form'); var pw = field('New password', 'password', 'newpw', 'at least 6 characters'); f.appendChild(pw.wrap);
    var msg = el('div', 'maa-msg'); f.appendChild(msg);
    var go = el('button', 'maa-go', 'Save password'); go.type = 'submit'; f.appendChild(go); cardBody.appendChild(f);
    f.addEventListener('submit', function (e) { e.preventDefault(); var p = pw.input.value;
      if (!p || p.length < 6) return setMsg(msg, 'Password must be at least 6 characters.', 'err');
      go.disabled = true; setMsg(msg, 'Saving…');
      doUpdatePassword(p).then(function (r) { go.disabled = false; if (r && r.error) return setMsg(msg, prettyErr(r.error), 'err'); setMsg(msg, 'Password updated — you’re signed in!', 'ok'); setTimeout(closeModal, 1300); })
        .catch(function (er) { go.disabled = false; setMsg(msg, prettyErr(er), 'err'); }); });
    setTimeout(function () { pw.input.focus(); }, 30);
  }

  function renderAccount() {
    cardBody.appendChild(header('Your account'));
    cardBody.appendChild(el('p', 'maa-sub', user ? ('Signed in as ' + user.email) : 'Not signed in'));
    var un = field('Username', 'text', 'username2', 'set a username');
    un.input.value = (profile && profile.username) || '';
    cardBody.appendChild(un.wrap);
    cardBody.appendChild(el('div', 'maa-lbl', 'Which are you?'));
    var msg = el('div', 'maa-msg');
    var roles = rolePicker(roleOf(), function (k) {
      setMsg(msg, 'Saving…');
      saveRole(k).then(function () {
        setMsg(msg, k === 'teacher' ? 'Teacher mode on — the Rollbook tab is in the nav now.' : 'Switched to learner.', 'ok');
      }).catch(function (er) {
        roles.set(roleOf());   // put the highlight back, but keep the reason on screen
        setMsg(msg, /column|schema|does not exist/i.test(prettyErr(er))
          ? 'Roles aren’t set up on the database yet — run supabase-roles.sql in Supabase.'
          : prettyErr(er), 'err');
      });
    });
    cardBody.appendChild(roles.wrap);
    cardBody.appendChild(msg);
    var save = el('button', 'maa-go', 'Save username'); save.type = 'button'; cardBody.appendChild(save);
    if (window.MAAuth.isPro && window.MAAuth.isPro()) {
      var mng = el('a', 'maa-alt', 'Manage subscription →'); mng.href = 'https://app.lemonsqueezy.com/my-orders'; mng.target = '_blank'; mng.rel = 'noopener';
      mng.style.display = 'block'; mng.style.textDecoration = 'none'; mng.style.textAlign = 'center'; mng.style.boxSizing = 'border-box'; cardBody.appendChild(mng);
    } else {
      var gp = el('a', 'maa-alt', '✦ Go Pro'); gp.href = '/upgrade.html';
      gp.style.display = 'block'; gp.style.textDecoration = 'none'; gp.style.textAlign = 'center'; gp.style.boxSizing = 'border-box'; cardBody.appendChild(gp);
    }
    var page = el('a', 'maa-alt', 'Your saved work & songs →'); page.href = '/account.html'; page.style.display = 'block'; page.style.textDecoration = 'none'; page.style.textAlign = 'center'; page.style.boxSizing = 'border-box'; cardBody.appendChild(page);
    var out = el('button', 'maa-alt', 'Sign out'); out.type = 'button'; cardBody.appendChild(out);
    save.addEventListener('click', function () {
      var name = (un.input.value || '').trim();
      if (name && !/^[A-Za-z0-9_.\- ]{2,24}$/.test(name)) return setMsg(msg, 'Username: 2–24 letters, numbers, spaces or _ . -', 'err');
      save.disabled = true; setMsg(msg, 'Saving…');
      (name ? usernameFree(name) : Promise.resolve(true)).then(function (free) {
        if (name && !free && name.toLowerCase() !== ((profile && profile.username) || '').toLowerCase()) { save.disabled = false; return setMsg(msg, 'That username is taken.', 'err'); }
        saveUsername(name || null).then(function (r) { save.disabled = false; if (r.error) return setMsg(msg, prettyErr(r.error), 'err'); profile = { username: name || null, role: roleOf() }; setMsg(msg, 'Saved!', 'ok'); renderControl(); emit(); })
          .catch(function (er) { save.disabled = false; setMsg(msg, prettyErr(er), 'err'); });
      });
    });
    out.addEventListener('click', function () { window.MAAuth.signOut().then(closeModal); });
  }

  function prettyErr(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || 'Something went wrong.';
    if (/Invalid login/i.test(m)) return 'Wrong email or password.';
    if (/already registered|already been registered/i.test(m)) return 'That email already has an account — try signing in.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries — give it a minute.';
    if (/load the sign-in/i.test(m)) return m;
    return m;
  }

  // ---- boot ----
  function boot() {
    injectStyles(); renderControl();
    ensureSb()
      .then(function () { return sb.auth.getSession(); })
      .then(function (r) { user = (r && r.data && r.data.session) ? r.data.session.user : null; return fetchProfile(); })
      .then(function () { return loadEntitlements(); })
      .then(function () { booted = true; renderControl(); emit(); emitEnt(); })
      .catch(function () { booted = true; renderControl(); emit(); emitEnt(); });
    ensureSb().then(function () {
      sb.auth.onAuthStateChange(function (evt, session) {
        user = session ? session.user : null;
        if (evt === 'PASSWORD_RECOVERY') openModal('reset'); // arrived from a reset email link
        fetchProfile().then(loadEntitlements).then(function () { renderControl(); emit(); emitEnt(); });
      });
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
