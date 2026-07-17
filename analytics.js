/* ═══════════════════════════════════════════════════════════════
   William Troy Music — Google Analytics 4 + cookie consent
   One shared file loaded by every page via  <script src="/analytics.js" defer></script>
   Analytics stays OFF (Consent Mode: denied) until the visitor accepts.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var GA_ID = 'G-KPTMZ76C55';
  var KEY = 'wtm-consent'; // localStorage: 'granted' | 'denied'

  // --- gtag bootstrap ---
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());

  // Consent Mode v2 — everything denied by default (GDPR-friendly)
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });

  gtag('config', GA_ID);

  // Load the GA library (sends cookieless pings while denied)
  var lib = document.createElement('script');
  lib.async = true;
  lib.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(lib);

  // Re-apply a previous choice
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  if (choice === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  if (choice === 'granted' || choice === 'denied') return; // already decided

  // --- Cookie banner ---
  function decide(granted) {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch (e) {}
    if (granted) gtag('consent', 'update', { analytics_storage: 'granted' });
    var el = document.getElementById('wtm-cookie-bar');
    if (el) el.parentNode.removeChild(el);
  }

  function showBanner() {
    if (document.getElementById('wtm-cookie-bar')) return;

    var bar = document.createElement('div');
    bar.id = 'wtm-cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.style.cssText =
      'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;' +
      'max-width:560px;margin:0 auto;background:#1E1729;color:#F4EEE3;' +
      'border-radius:14px;padding:16px 18px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.28);' +
      'font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:14.5px;line-height:1.5;' +
      'display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;';

    var txt = document.createElement('div');
    txt.style.cssText = 'flex:1 1 240px;min-width:200px;';
    txt.innerHTML = 'This site uses cookies to measure anonymous visits with Google Analytics. ' +
      'No ads, no tracking beyond that.';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;flex:0 0 auto;';

    function mkBtn(label, bg, fg) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText =
        'cursor:pointer;border:0;border-radius:9px;padding:9px 16px;' +
        'font-family:inherit;font-size:14px;font-weight:700;background:' + bg + ';color:' + fg + ';';
      return b;
    }

    var decline = mkBtn('Decline', 'transparent', '#F4EEE3');
    decline.style.border = '1.5px solid rgba(244,238,227,.35)';
    var accept = mkBtn('Accept', '#16B59E', '#08201C');

    decline.addEventListener('click', function () { decide(false); });
    accept.addEventListener('click', function () { decide(true); });

    btns.appendChild(decline);
    btns.appendChild(accept);
    bar.appendChild(txt);
    bar.appendChild(btns);
    document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
