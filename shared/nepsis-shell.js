/* ==================================================================
   Nepsis Ministries — shared site shell
   ------------------------------------------------------------------
   Injects one masthead into every app so the four reconstructions read
   as a single site. No dependencies, no build step, and every link is
   relative, so the whole folder works three ways without editing:

     • double-clicked from disk  (file://…/index.html)
     • served from a static host (GitHub Pages, /public_html/…)
     • dropped into a WordPress subfolder at any path

   Each page declares, BEFORE loading this file:

       <script>window.NEPSIS_APP = { id: 'temple', base: '../../' };</script>

   `base` is the relative path from that page back to the site root.
   ================================================================== */

(function () {
  'use strict';

  var CFG = window.NEPSIS_APP || {};
  var BASE = typeof CFG.base === 'string' ? CFG.base : '';

  /* The four apps, in the order a reader should meet them: the whole
     land, then the ministry across it, then the city, then the Temple
     at the centre of the city. */
  var APPS = [
    {
      id: 'holy-land',
      path: 'index.html',
      name: 'The Holy Land',
      sub: '150 sites · Genesis to Revelation'
    },
    {
      id: 'ministry',
      path: 'apps/ministry/index.html',
      name: 'Ministry of Christ',
      sub: 'Three years · c. AD 27\u201330'
    },
    {
      id: 'jerusalem',
      path: 'apps/jerusalem/index.html',
      name: 'Ancient Jerusalem',
      sub: 'The city at Passover · c. AD 30'
    },
    {
      id: 'temple',
      path: 'apps/temple/index.html',
      name: "Herod's Temple",
      sub: 'The Second Temple and its courts'
    }
  ];

  var SITE = 'https://nepsisministries.org/';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function href(app) { return BASE + app.path; }

  function byId(id) {
    for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i];
    return null;
  }

  /* Public helper, so an app can deep-link into a sibling app without
     hard-coding a path that breaks when the folder moves. */
  var NEPSIS = window.NEPSIS = window.NEPSIS || {};
  NEPSIS.apps = APPS;
  NEPSIS.site = SITE;
  NEPSIS.base = BASE;
  NEPSIS.href = function (id) { var a = byId(id); return a ? href(a) : BASE + 'index.html'; };
  NEPSIS.current = byId(CFG.id) || APPS[0];

  /* ?nav=0 removes the masthead — for the WordPress embed, where the
     surrounding page already carries the site navigation. */
  function navWanted() {
    try {
      var v = new URLSearchParams(location.search).get('nav');
      return !(v === '0' || v === 'no' || v === 'off');
    } catch (e) { return true; }
  }

  function build() {
    if (document.getElementById('nm-shell')) return;

    if (!navWanted()) {
      document.documentElement.classList.add('nm-off');
      return;
    }

    var here = NEPSIS.current;

    var tabs = '';
    var menu = '<div class="nm-mh">Interactive studies</div>';

    for (var i = 0; i < APPS.length; i++) {
      var a = APPS[i];
      var cur = a.id === here.id;
      var mark = cur ? ' aria-current="page"' : '';
      tabs += '<a href="' + esc(href(a)) + '"' + mark + '>' + esc(a.name) + '</a>';
      menu += '<a href="' + esc(href(a)) + '"' + mark + '>' +
              '<b>' + esc(a.name) + '</b><span>' + esc(a.sub) + '</span></a>';
    }

    menu += '<a class="nm-out" href="' + SITE + '" target="_top" rel="noopener">' +
            '<b>nepsisministries.org</b><span>Back to the main site</span></a>';

    var el = document.createElement('div');
    el.id = 'nm-shell';
    el.setAttribute('role', 'banner');
    el.innerHTML =
      '<a class="nm-brand" href="' + esc(BASE + 'index.html') + '" ' +
        'title="Nepsis Ministries — the Holy Land">' +
        '<img src="' + esc(BASE + 'shared/nepsis-logo.png') + '" alt="Nepsis Ministries">' +
      '</a>' +

      '<div class="nm-here"><b>' + esc(here.name) + '</b>' +
        '<span>' + esc(here.sub) + '</span></div>' +

      '<nav class="nm-tabs" aria-label="Interactive studies">' + tabs + '</nav>' +

      '<div class="nm-menuwrap" id="nm-menuwrap">' +
        '<button class="nm-menubtn" id="nm-menubtn" type="button" ' +
          'aria-haspopup="true" aria-expanded="false" aria-controls="nm-menu">' +
          'Studies <i>&#9662;</i></button>' +
        '<div class="nm-menu" id="nm-menu" role="menu" ' +
          'aria-label="Interactive studies">' + menu + '</div>' +
      '</div>' +

      '<a class="nm-site" href="' + SITE + '" target="_top" rel="noopener" ' +
        'title="Back to nepsisministries.org"><i>&#8617;</i><span>Site</span></a>';

    document.body.insertBefore(el, document.body.firstChild);

    wireMenu();
    setTitle(here);
  }

  function setTitle(here) {
    if (!document.title || document.title.indexOf('Nepsis') === -1) {
      document.title = here.name + ' \u2014 Nepsis Ministries';
    }
    if (!document.querySelector('link[rel="icon"]')) {
      var ico = document.createElement('link');
      ico.rel = 'icon';
      ico.type = 'image/png';
      ico.href = BASE + 'shared/nepsis-mark.png';
      document.head.appendChild(ico);
    }
  }

  function wireMenu() {
    var wrap = document.getElementById('nm-menuwrap');
    var btn = document.getElementById('nm-menubtn');
    var menu = document.getElementById('nm-menu');
    if (!wrap || !btn || !menu) return;

    function close() {
      wrap.classList.remove('nm-open');
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !wrap.classList.contains('nm-open');
      wrap.classList.toggle('nm-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        var first = menu.querySelector('a:not([aria-current])');
        if (first) first.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wrap.classList.contains('nm-open')) {
        close();
        btn.focus();
      }
    });

    menu.addEventListener('keydown', function (e) {
      var list = Array.prototype.slice.call(menu.querySelectorAll('a'));
      var i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
    });
  }

  NEPSIS.build = build;

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
