/* ==================================================================
   Nepsis Ministries — shared analytics
   ------------------------------------------------------------------
   Loaded by all four studies, so tags live in ONE place instead of
   four HTML heads. Change an id here and every page follows.

   Two guards:

     1. ?nav=0  — the WordPress embed. The parent page already counts
        the visitor, so firing again from inside the iframe would
        double-count. When the masthead is suppressed, analytics is too.

     2. file://  — opened straight off disk (local preview). No point
        sending hits, and GTM/GA can error under the file: origin.

   \u26a0  DOUBLE-COUNTING: this file loads BOTH Google Tag Manager
   (GTM-TL5K46PZ) and gtag.js (G-6BB7ENGW9V), because that is what was
   provided. If your GTM container ALSO has a GA4 tag for G-6BB7ENGW9V,
   every page view is counted twice. Keep ONE path: either delete the
   GTM block below, or delete the gtag block below. See the comments.
   ================================================================== */

(function () {
  'use strict';

  var GTM_ID = 'GTM-TL5K46PZ';    // Google Tag Manager container
  var GA4_ID = 'G-6BB7ENGW9V';    // GA4 measurement id (gtag.js)

  /* -- guard 1: skip when embedded (masthead suppressed via ?nav=0) -- */
  try {
    var nav = new URLSearchParams(location.search).get('nav');
    if (nav === '0' || nav === 'no' || nav === 'off') return;
  } catch (e) { /* URLSearchParams missing: fall through, still counts */ }

  /* -- guard 2: skip local file previews -- */
  if (location.protocol === 'file:') return;

  /* ================================================================
     Google Tag Manager
     Delete this whole block to run gtag.js only.
     ================================================================ */
  (function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s),
        dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', GTM_ID);

  /* The GTM <noscript> iframe is intentionally omitted: these studies
     need JavaScript and WebGL to run at all, so a no-JS visitor never
     reaches a working page to be counted. */

  /* ================================================================
     Google tag (gtag.js)
     Delete this whole block to run Google Tag Manager only.
     ================================================================ */
  var g = document.createElement('script');
  g.async = true;
  g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(g);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID);
})();
