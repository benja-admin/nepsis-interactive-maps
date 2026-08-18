/* ==================================================================
   Nepsis Ministries  -  interactive 3D map of the Holy Land
   MapLibre GL JS + Tilezen terrain + Esri imagery. No API keys.
   ================================================================== */
(function () {
  'use strict';

  var CFG = window.HL_CONFIG;

  /* Map-layer colours. Defaults mirror config.js so the app still draws
     if an older config without a `theme` block is dropped in. */
  var TH = (function (t) {
    t = t || {};
    return {
      accent:       t.accent       || '#aa0000',
      accentFill:   t.accentFill   || 'rgba(170,0,0,.16)',
      mapBg:        t.mapBg        || '#1a1a1a',
      markerStroke: t.markerStroke || '#1a1a1a',
      labelHalo:    t.labelHalo    || '#000000',
      siteLabel:    t.siteLabel    || '#ffffff',
      regionLabel:  t.regionLabel  || '#fafafa',
      profileGrid:  t.profileGrid  || 'rgba(26,26,26,.22)',
      profileText:  t.profileText  || 'rgba(26,26,26,.55)',
      profileSea:   t.profileSea   || '#1a1a1a',
      profileSeaText: t.profileSeaText || 'rgba(26,26,26,.75)'
    };
  }(CFG.theme));

  /* Sibling reconstructions this site also carries. The shared shell
     publishes window.NEPSIS.href(); without it (map used on its own)
     the links simply do not appear. */
  function siblingLinks(sid) {
    var defs = (CFG.deepLinks || {})[sid];
    if (!defs || !defs.length || !window.NEPSIS || !window.NEPSIS.href) return '';
    return defs.map(function (d) {
      return '<a class="btn nm-go" href="' + esc(window.NEPSIS.href(d.app)) + '">' +
             esc(d.label) + ' <span aria-hidden="true">&rarr;</span></a>';
    }).join('');
  }

  /* Optional override hooks. Only `navigate` is used, so the test suite can
     watch where the back arrow would send you without jsdom trying to
     actually follow the link. Nothing sets these in normal use. */
  var HOOKS = (window.__hlHooks = window.__hlHooks || {});

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var RANK_MINZOOM = { 1: 0, 2: 5.6, 3: 7.4, 4: 8.8 };

  var state = {
    era: CFG.defaults.era,
    categories: null,          // Set of enabled category ids
    exaggeration: CFG.defaults.exaggeration,
    basemap: CFG.defaults.basemap,
    labels: false,
    selected: null,            // site id
    sites: null,               // GeoJSON
    regions: null,
    meta: null,
    byId: {},
    profile: { on: false, pts: [] },
    embedded: false,
    ready: false
  };

  var map;

  /* ---------------------------------------------------------------- utils */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtM(m) {
    if (m == null || !isFinite(m)) return '—';
    var ft = Math.round(m * 3.28084);
    return Math.round(m).toLocaleString() + ' m  /  ' + ft.toLocaleString() + ' ft';
  }

  /** Structural check: are we actually inside an <iframe>? */
  function inFrame() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  /** Behavioural flag: should we act embedded (cooperative gestures etc.)?
      ?embed=1 / ?embed=0 on the URL overrides the structural detection.
      A full-page WordPress takeover is framed but passes embed=0, because
      the host page does not scroll and should not steal the wheel. */
  function isEmbedded() {
    var q = new URLSearchParams(location.search).get('embed');
    if (q === '1' || q === 'true') return true;
    if (q === '0' || q === 'false') return false;
    if (!CFG.embed || !CFG.embed.autoDetect) return false;
    return inFrame();
  }

  /** Back-button config from the query string.
        ?back=1            show it, use browser history
        ?back=/resources   show it, always return to that page
        (absent)           hide it
      Returns null when the button should not be shown at all. */
  function readBack() {
    var cfg = CFG.back || {};
    var raw = new URLSearchParams(location.search).get('back');

    // No ?back= at all: shown by default.
    if (raw === null) return cfg.show === false ? null : { url: null };

    var v = String(raw).trim();
    var lower = v.toLowerCase();

    if (v === '' || lower === '0' || lower === 'false' ||
        lower === 'no' || lower === 'off') return null;

    if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') {
      return { url: null };                       // work it out at click time
    }

    // An explicit destination, but only if it stays on the site.
    var safe = sameSiteUrl(v);
    return { url: safe };                         // null => fall back to the usual logic
  }

  function haversine(a, b) {      // [lng,lat] -> metres
    var R = 6371008.8, d2r = Math.PI / 180;
    var dLat = (b[1] - a[1]) * d2r, dLng = (b[0] - a[0]) * d2r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * d2r) * Math.cos(b[1] * d2r) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /** True elevation in metres above sea level (undoes terrain exaggeration). */
  function elevationAt(lngLat) {
    if (!map || !map.getTerrain()) return null;
    var raw = map.queryTerrainElevation(lngLat);
    if (raw == null || !isFinite(raw)) return null;
    var ex = state.exaggeration || 1;
    return ex === 0 ? raw : raw / ex;
  }

  /* ---------------------------------------------------------------- style */

  function rasterPaint(bm) {
    return {
      'raster-opacity': 1,
      'raster-saturation': bm.saturation || 0,
      'raster-hue-rotate': (bm.hueRotate || 0) * 360,
      'raster-brightness-min': bm.brightnessMin || 0,
      'raster-brightness-max': bm.brightnessMax == null ? 1 : bm.brightnessMax,
      'raster-contrast': bm.contrast || 0,
      'raster-fade-duration': 200
    };
  }

  function buildStyle() {
    var bm = CFG.basemaps[state.basemap];
    var sources = {
      'dem': {
        type: 'raster-dem',
        tiles: CFG.dem.tiles,
        encoding: CFG.dem.encoding,
        tileSize: CFG.dem.tileSize,
        maxzoom: CFG.dem.maxzoom,
        attribution: CFG.dem.attribution
      },
      'basemap': {
        type: 'raster', tiles: bm.tiles, tileSize: 256,
        maxzoom: bm.maxzoom, attribution: CFG.esriAttribution
      },
      'reflabels': {
        type: 'raster', tiles: CFG.referenceLabels.tiles, tileSize: 256,
        maxzoom: CFG.referenceLabels.maxzoom, attribution: ''
      },
      'sites': { type: 'geojson', data: emptyFC() },
      'regions': { type: 'geojson', data: emptyFC() },
      'selected': { type: 'geojson', data: emptyFC() },
      'profile': { type: 'geojson', data: emptyFC() }
    };

    var layers = [
      { id: 'bg', type: 'background', paint: { 'background-color': TH.mapBg } },
      { id: 'basemap', type: 'raster', source: 'basemap', paint: rasterPaint(bm) },
      {
        id: 'hillshade', type: 'hillshade', source: 'dem',
        paint: {
          'hillshade-exaggeration': 0.32,
          'hillshade-shadow-color': '#1d2530',
          'hillshade-highlight-color': '#fffaf0',
          'hillshade-accent-color': '#4a3b2a',
          'hillshade-illumination-direction': 315
        }
      },
      {
        id: 'reflabels', type: 'raster', source: 'reflabels',
        layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 }
      }
    ];

    /* region name labels ------------------------------------------------ */
    layers.push({
      id: 'region-labels', type: 'symbol', source: 'regions',
      minzoom: 3.2,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [CFG.fontBold],
        'text-letter-spacing': 0.28,
        'text-max-width': 8,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          3.2, ['case', ['==', ['get', 'tier'], 1], 13, ['==', ['get', 'tier'], 2], 10, 0],
          6, ['case', ['==', ['get', 'tier'], 1], 20, ['==', ['get', 'tier'], 2], 16, 13],
          10, ['case', ['==', ['get', 'tier'], 1], 26, ['==', ['get', 'tier'], 2], 22, 18]
        ],
        'symbol-sort-key': ['get', 'tier'],
        'text-allow-overlap': false
      },
      paint: {
        'text-color': TH.regionLabel,
        'text-opacity': 0.62,
        'text-halo-color': TH.labelHalo,
        'text-halo-width': 1.6,
        'text-halo-blur': 0.6
      }
    });

    /* selected-site ring ------------------------------------------------ */
    layers.push({
      id: 'selected-ring', type: 'circle', source: 'selected',
      paint: {
        'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': TH.accent, 'circle-stroke-width': 2.5,
        'circle-stroke-opacity': 0.95
      }
    });

    /* one dot layer + one label layer per rank tier --------------------- */
    [1, 2, 3, 4].forEach(function (rank) {
      layers.push({
        id: 'site-dot-' + rank, type: 'circle', source: 'sites',
        minzoom: RANK_MINZOOM[rank],
        filter: ['==', ['get', 'rank'], rank],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            3, 3, 8, 5.2, 13, 8
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': TH.markerStroke,
          'circle-stroke-width': 1.6,
          'circle-opacity': 0.96,
          'circle-pitch-alignment': 'map'
        }
      });
      layers.push({
        id: 'site-label-' + rank, type: 'symbol', source: 'sites',
        minzoom: RANK_MINZOOM[rank] + (rank === 1 ? 3.4 : 0.4),
        filter: ['==', ['get', 'rank'], rank],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [CFG.fontBold],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 10, 13.5, 14, 16],
          'text-offset': [0, 1.0],
          'text-anchor': 'top',
          'text-max-width': 9,
          'text-padding': 3,
          'symbol-sort-key': ['get', 'rank'],
          'text-allow-overlap': false
        },
        paint: {
          'text-color': TH.siteLabel,
          'text-halo-color': TH.labelHalo,
          'text-halo-width': 1.9,
          'text-halo-blur': 0.4
        }
      });
    });

    /* elevation-profile line -------------------------------------------- */
    layers.push({
      id: 'profile-line', type: 'line', source: 'profile',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': TH.accent, 'line-width': 3, 'line-dasharray': [2, 1.4] }
    });
    layers.push({
      id: 'profile-pts', type: 'circle', source: 'profile',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5, 'circle-color': TH.accent,
        'circle-stroke-color': TH.labelHalo, 'circle-stroke-width': 2
      }
    });

    return {
      version: 8,
      glyphs: CFG.glyphs,
      sources: sources,
      sky: {
        'sky-color': '#4a7fb5',
        'horizon-color': '#c8d8e6',
        'fog-color': '#dfe7ee',
        'fog-ground-blend': 0.55,
        'horizon-fog-blend': 0.5,
        'sky-horizon-blend': 0.7,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.6, 10, 0]
      },
      layers: layers
    };
  }

  function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

  window.__hlBuildStyle = buildStyle;

  /* ---------------------------------------------------------------- data */

  /* data/data.js is a plain <script> (not fetch) so the map also runs when
     index.html is opened straight off disk. data/*.json holds the same
     content for anyone who wants to consume it as GeoJSON. */
  function load() {
    var d = window.HL_DATA;
    if (!d || !d.sites || !d.regions || !d.meta) {
      throw new Error('data/data.js did not load. Check that the ' +
                      '<script src="data/data.js"> tag in index.html points at the file.');
    }
    state.sites = d.sites;
    state.regions = d.regions;
    state.meta = d.meta;
    state.categories = new Set(Object.keys(state.meta.categories));
    state.sites.features.forEach(function (f) {
      state.byId[f.properties.sid] = f;
    });
  }

  /* ---------------------------------------------------------------- filters */

  function siteFilter(rank) {
    var f = ['all', ['==', ['get', 'rank'], rank]];
    if (state.era !== 'all') f.push(['in', state.era, ['get', 'eras']]);
    var cats = Array.from(state.categories);
    if (cats.length !== Object.keys(state.meta.categories).length) {
      f.push(['in', ['get', 'category'], ['literal', cats]]);
    }
    return f;
  }

  function applyFilters() {
    if (!state.ready) return;
    [1, 2, 3, 4].forEach(function (r) {
      map.setFilter('site-dot-' + r, siteFilter(r));
      map.setFilter('site-label-' + r, siteFilter(r));
    });
    var rf = state.era === 'all' ? null : ['in', state.era, ['get', 'eras']];
    map.setFilter('region-labels', rf);
    renderResults($('#search').value);
    updateCount();
    writeHash();
  }

  function visibleSites() {
    return state.sites.features.filter(function (f) {
      var p = f.properties;
      if (state.era !== 'all' && p.eras.indexOf(state.era) === -1) return false;
      if (!state.categories.has(p.category)) return false;
      return true;
    });
  }

  function updateCount() {
    var n = visibleSites().length;
    $('#count').textContent = n + ' of ' + state.sites.features.length + ' sites';
  }

  /* ---------------------------------------------------------------- panel */

  function selectSite(sid, fly) {
    var f = state.byId[sid];
    if (!f) return;
    state.selected = sid;
    map.getSource('selected').setData({ type: 'FeatureCollection', features: [f] });

    var p = f.properties, c = f.geometry.coordinates;

    if (fly) {
      map.flyTo({
        center: c,
        zoom: Math.max(map.getZoom(), 11.5),
        pitch: Math.max(map.getPitch(), 55),
        duration: 1600, essential: true
      });
    }

    var eraNames = p.eras.map(function (id) {
      var e = state.meta.eras.filter(function (x) { return x.id === id; })[0];
      return e ? e.label : id;
    });

    var html = '' +
      '<div class="panel-tools">' +
        '<button class="mini-btn" id="panelMin" type="button" aria-expanded="true" ' +
          'aria-controls="panelBody" title="Minimise" aria-label="Minimise this site">' +
          '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
          '<path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round"/></svg></button>' +
        '<button class="mini-btn" id="panelClose" type="button" title="Close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
          '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round"/></svg></button>' +
      '</div>' +
      '<div class="p-head">' +
        '<div class="p-cat" style="color:' + esc(p.color) + '">' +
          '<span class="p-swatch" style="background:' + esc(p.color) + '"></span>' +
          esc(state.meta.categories[p.category].label) + '</div>' +
        '<h2>' + esc(p.name) + '</h2>' +
        (p.modern ? '<div class="p-modern">Today: ' + esc(p.modern) + '</div>' : '') +
      '</div>' +
      '<div class="p-body" id="panelBody">' +
      '<div class="p-stats">' +
        '<div><span class="k">Elevation</span><span class="v" id="pElev">measuring…</span></div>' +
        '<div><span class="k">Coordinates</span><span class="v">' +
          c[1].toFixed(4) + '°N, ' + c[0].toFixed(4) + '°E</span></div>' +
      '</div>' +
      '<div class="p-eras">' + eraNames.map(function (n) {
        return '<span class="era-chip">' + esc(n) + '</span>';
      }).join('') + '</div>' +
      '<p class="p-desc">' + esc(p.desc) + '</p>' +
      (p.refs && p.refs.length
        ? '<div class="p-refs"><h3>Scripture</h3><div class="ref-list">' +
          p.refs.map(function (r) {
            return '<a class="ref" href="' + esc(CFG.bibleUrl(r)) +
              '" target="_blank" rel="noopener">' + esc(r) + '</a>';
          }).join('') + '</div></div>'
        : '') +
      (p.note ? '<div class="p-note"><strong>Note on identification:</strong> ' + esc(p.note) + '</div>' : '') +
      '<div class="p-actions">' +
        siblingLinks(p.sid) +
        '<button class="btn" data-fly="' + esc(p.sid) + '">Fly here</button>' +
        '<button class="btn" id="pProfileFrom">Start elevation profile here</button>' +
      '</div>' +
      '</div>';   // .p-body

    var panel = $('#panel');
    panel.innerHTML = html;
    panel.classList.add('open');

    $('#panelClose').onclick = closePanel;
    $('#panelMin').onclick = function () {
      setPanelMin(!panel.classList.contains('minimised'), true);
    };
    setPanelMin(!uiGet('panel', true), false);   // remember the user's choice

    panel.querySelector('[data-fly]').onclick = function () { selectSite(sid, true); };
    $('#pProfileFrom').onclick = function () {
      setProfileMode(true);
      addProfilePoint(c);
    };

    // Elevation needs terrain tiles for this spot; retry until they land.
    var tries = 0;
    (function poll() {
      var el = $('#pElev');
      if (!el || state.selected !== sid) return;
      var m = elevationAt(c);
      if (m != null) {
        el.textContent = fmtM(m) + (m < 0 ? '  (below sea level)' : '');
      } else if (tries++ < 40) {
        setTimeout(poll, 250);
      } else {
        el.textContent = '— (zoom in to measure)';
      }
    })();

    writeHash();
  }

  function closePanel() {
    state.selected = null;
    $('#panel').classList.remove('open');
    map.getSource('selected').setData(emptyFC());
    writeHash();
  }

  /* ---------------------------------------------------------------- search */

  function renderResults(q) {
    var box = $('#results');
    q = (q || '').trim().toLowerCase();
    if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }

    var hits = visibleSites().filter(function (f) {
      var p = f.properties;
      return p.name.toLowerCase().indexOf(q) > -1 ||
        (p.modern || '').toLowerCase().indexOf(q) > -1 ||
        (p.refs || []).join(' ').toLowerCase().indexOf(q) > -1 ||
        p.desc.toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) {
      var an = a.properties.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      var bn = b.properties.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      return (an - bn) || (a.properties.rank - b.properties.rank) ||
        a.properties.name.localeCompare(b.properties.name);
    }).slice(0, 14);

    if (!hits.length) {
      box.innerHTML = '<div class="res-empty">No sites match “' + esc(q) +
        '” in the current era filter.</div>';
      box.classList.add('open');
      return;
    }

    box.innerHTML = hits.map(function (f) {
      var p = f.properties;
      return '<button class="res" data-sid="' + esc(p.sid) + '">' +
        '<span class="res-dot" style="background:' + esc(p.color) + '"></span>' +
        '<span class="res-txt"><strong>' + esc(p.name) + '</strong>' +
        (p.modern ? '<em>' + esc(p.modern) + '</em>' : '') + '</span></button>';
    }).join('');
    box.classList.add('open');

    $$('.res', box).forEach(function (b) {
      b.onclick = function () {
        selectSite(b.getAttribute('data-sid'), true);
        box.classList.remove('open');
        $('#search').blur();
      };
    });
  }

  /* ------------------------------------------------------- elevation profile */

  function setProfileMode(on) {
    state.profile.on = on;
    $('#btnProfile').classList.toggle('active', on);
    document.body.classList.toggle('profile-mode', on);
    if (!on) {
      state.profile.pts = [];
      map.getSource('profile').setData(emptyFC());
      $('#profile').classList.remove('open');
    } else {
      $('#profileHint').style.display = 'block';
      $('#profile').classList.add('open');
      drawProfile();
    }
  }

  function addProfilePoint(lngLat) {
    var c = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    state.profile.pts.push(c);
    var pts = state.profile.pts;
    var feats = pts.map(function (p) {
      return { type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} };
    });
    if (pts.length > 1) {
      feats.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: pts }, properties: {}
      });
    }
    map.getSource('profile').setData({ type: 'FeatureCollection', features: feats });
    $('#profile').classList.add('open');
    drawProfile();
  }

  function sampleProfile(samples) {
    var pts = state.profile.pts;
    if (pts.length < 2) return null;

    // cumulative distances along the polyline
    var segs = [], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = haversine(pts[i - 1], pts[i]);
      segs.push({ a: pts[i - 1], b: pts[i], d: d, start: total });
      total += d;
    }
    if (total === 0) return null;

    var out = [], missing = 0;
    for (var s = 0; s <= samples; s++) {
      var target = (total * s) / samples;
      var seg = segs[segs.length - 1];
      for (var j = 0; j < segs.length; j++) {
        if (target <= segs[j].start + segs[j].d) { seg = segs[j]; break; }
      }
      var t = seg.d === 0 ? 0 : (target - seg.start) / seg.d;
      var lng = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
      var lat = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
      var e = elevationAt([lng, lat]);
      if (e == null) { missing++; e = null; }
      out.push({ d: target, e: e, lng: lng, lat: lat });
    }
    return { pts: out, total: total, missing: missing };
  }

  function drawProfile() {
    var wrap = $('#profileBody');
    var pts = state.profile.pts;

    if (pts.length < 2) {
      wrap.innerHTML = '<div class="prof-empty">Click two or more points on the map to draw a cross-section.</div>';
      return;
    }

    var data = sampleProfile(180);
    if (!data) { wrap.innerHTML = '<div class="prof-empty">Points are too close together.</div>'; return; }

    var vals = data.pts.filter(function (p) { return p.e != null; });
    if (vals.length < 2) {
      wrap.innerHTML = '<div class="prof-empty">Terrain data for this line is not loaded yet. ' +
        'Zoom the map so the whole line is visible, then click <em>Redraw</em>.</div>' +
        '<button class="btn" id="profRedraw">Redraw</button>';
      $('#profRedraw').onclick = drawProfile;
      return;
    }

    var W = 640, H = 190, PAD = { l: 52, r: 14, t: 14, b: 30 };
    var minE = Math.min.apply(null, vals.map(function (p) { return p.e; }));
    var maxE = Math.max.apply(null, vals.map(function (p) { return p.e; }));
    if (maxE - minE < 60) { maxE = minE + 60; }
    var padE = (maxE - minE) * 0.12;
    minE -= padE; maxE += padE;

    var x = function (d) { return PAD.l + (d / data.total) * (W - PAD.l - PAD.r); };
    var y = function (e) { return PAD.t + (1 - (e - minE) / (maxE - minE)) * (H - PAD.t - PAD.b); };

    var line = '', area = '', started = false;
    data.pts.forEach(function (p) {
      if (p.e == null) return;
      var cmd = started ? 'L' : 'M';
      line += cmd + x(p.d).toFixed(1) + ' ' + y(p.e).toFixed(1) + ' ';
      started = true;
    });
    area = line + 'L' + x(data.total).toFixed(1) + ' ' + (H - PAD.b) + ' L' +
      x(0).toFixed(1) + ' ' + (H - PAD.b) + ' Z';

    // gridlines: sea level plus 4 even steps
    var ticks = [];
    for (var i = 0; i <= 4; i++) ticks.push(minE + ((maxE - minE) * i) / 4);
    if (minE < 0 && maxE > 0) ticks.push(0);

    var grid = ticks.map(function (t) {
      var isSea = Math.abs(t) < 0.5;
      return '<line x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y(t).toFixed(1) +
        '" y2="' + y(t).toFixed(1) + '" stroke="' + (isSea ? TH.profileSea : TH.profileGrid) +
        '" stroke-width="' + (isSea ? 1.4 : 1) + '"' + (isSea ? '' : ' stroke-dasharray="3 3"') + '/>' +
        '<text x="' + (PAD.l - 7) + '" y="' + (y(t) + 3.5).toFixed(1) +
        '" text-anchor="end" fill="' + (isSea ? TH.profileSeaText : TH.profileText) +
        '" font-size="10">' + Math.round(t) + '</text>';
    }).join('');

    var km = data.total / 1000;
    var lo = Math.min.apply(null, vals.map(function (p) { return p.e; }));
    var hi = Math.max.apply(null, vals.map(function (p) { return p.e; }));

    wrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="prof-svg" preserveAspectRatio="none">' +
        grid +
        '<path d="' + area + '" fill="' + TH.accentFill + '"/>' +
        '<path d="' + line + '" fill="none" stroke="' + TH.accent + '" stroke-width="2" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
        '<text x="' + PAD.l + '" y="' + (H - 9) + '" fill="' + TH.profileText + '" font-size="10">0 km</text>' +
        '<text x="' + (W - PAD.r) + '" y="' + (H - 9) + '" text-anchor="end" fill="' + TH.profileText + '" ' +
          'font-size="10">' + km.toFixed(1) + ' km</text>' +
      '</svg>' +
      '<div class="prof-stats">' +
        '<span><b>Length</b> ' + km.toFixed(1) + ' km</span>' +
        '<span><b>Low</b> ' + Math.round(lo) + ' m</span>' +
        '<span><b>High</b> ' + Math.round(hi) + ' m</span>' +
        '<span><b>Relief</b> ' + Math.round(hi - lo) + ' m</span>' +
        (data.missing ? '<span class="warn">' + data.missing + ' gaps — zoom in and redraw</span>' : '') +
      '</div>';
  }

  /* ---------------------------------------------------------------- hash */

  var hashLock = false;

  function writeHash() {
    if (!state.ready || hashLock) return;
    var c = map.getCenter();
    var parts = [
      c.lng.toFixed(4), c.lat.toFixed(4),
      map.getZoom().toFixed(2), Math.round(map.getPitch()),
      Math.round(map.getBearing()), state.era,
      state.basemap, state.exaggeration.toFixed(1),
      state.selected || ''
    ];
    var h = '#' + parts.join(',');
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return null;
    var p = h.split(',');
    if (p.length < 5) return null;
    var o = {
      center: [parseFloat(p[0]), parseFloat(p[1])],
      zoom: parseFloat(p[2]), pitch: parseFloat(p[3]), bearing: parseFloat(p[4]),
      era: p[5] || 'all', basemap: p[6] || CFG.defaults.basemap,
      exaggeration: parseFloat(p[7]), site: p[8] || ''
    };
    if (!isFinite(o.center[0]) || !isFinite(o.center[1]) || !isFinite(o.zoom)) return null;
    if (!CFG.basemaps[o.basemap]) o.basemap = CFG.defaults.basemap;
    if (!isFinite(o.exaggeration)) o.exaggeration = CFG.defaults.exaggeration;
    return o;
  }

  /** Opening state from the query string, e.g.
        ?view=galilee&era=gospels&site=capernaum&basemap=relief&exag=3
      Useful for deep-linking a specific study from a blog post or a
      WordPress shortcode. A #hash, if present, wins over all of this. */
  function readQuery() {
    var q = new URLSearchParams(location.search);
    var out = {};

    var v = q.get('view');
    if (v && CFG.views[v]) out.view = v;

    var e = q.get('era');
    if (e === 'all' || state.meta.eras.some(function (x) { return x.id === e; })) out.era = e;

    var s = q.get('site');
    if (s && state.byId[s]) out.site = s;

    var b = q.get('basemap');
    if (b && CFG.basemaps[b]) out.basemap = b;

    var x = parseFloat(q.get('exag'));
    if (isFinite(x) && x >= 0 && x <= 6) out.exaggeration = x;

    return out;
  }

  /* ---------------------------------------------------------------- UI */

  /** Short form for the Era card's badge, so it still reads at a glance
      when the card is collapsed. */
  function eraBadgeText(label) {
    var short = {
      'All eras': 'All',
      'Patriarchs': 'Patriarchs',
      'Exodus & Conquest': 'Exodus',
      'Judges': 'Judges',
      'United Kingdom': 'United',
      'Divided Kingdom': 'Divided',
      'Exile & Return': 'Exile',
      'Between Testaments': 'Between',
      'Life of Christ': 'Christ',
      'Early Church': 'Church'
    };
    return short[label] || label;
  }

  function buildUI() {
    /* era card */
    var eras = state.meta.eras;
    var slider = $('#eraSlider');
    slider.max = String(eras.length);   // index eras.length == "All"
    slider.value = String(eras.length);

    function setEraByIndex(i) {
      state.era = (i >= eras.length) ? 'all' : eras[i].id;
      var e = (i >= eras.length)
        ? { label: 'All eras', range: 'Genesis to Revelation', blurb: 'Every site in the dataset, whatever its period.' }
        : eras[i];
      $('#eraLabel').textContent = e.label;
      $('#eraRange').textContent = e.range;
      $('#eraBlurb').textContent = e.blurb;
      $('#eraBadge').textContent = eraBadgeText(e.label);
      applyFilters();
    }
    slider.oninput = function () { setEraByIndex(parseInt(slider.value, 10)); };
    window.__setEra = function (id) {
      var i = eras.map(function (e) { return e.id; }).indexOf(id);
      slider.value = String(i < 0 ? eras.length : i);
      setEraByIndex(parseInt(slider.value, 10));
    };
    window.__setEra(state.era);

    /* category legend / filter */
    var legend = $('#legend');
    legend.innerHTML = Object.keys(state.meta.categories).map(function (id) {
      var c = state.meta.categories[id];
      return '<label class="leg"><input type="checkbox" checked data-cat="' + esc(id) + '">' +
        '<span class="leg-dot" style="background:' + esc(c.color) + '"></span>' +
        esc(c.label) + '</label>';
    }).join('');
    $$('#legend input').forEach(function (cb) {
      cb.onchange = function () {
        var id = cb.getAttribute('data-cat');
        if (cb.checked) state.categories.add(id); else state.categories.delete(id);
        applyFilters();
      };
    });

    /* basemaps */
    var bmWrap = $('#basemaps');
    bmWrap.innerHTML = Object.keys(CFG.basemaps).map(function (id) {
      var b = CFG.basemaps[id];
      return '<button class="chip' + (id === state.basemap ? ' active' : '') +
        '" data-bm="' + esc(id) + '" title="' + esc(b.hint) + '">' + esc(b.label) + '</button>';
    }).join('');
    $$('#basemaps .chip').forEach(function (b) {
      b.onclick = function () { setBasemap(b.getAttribute('data-bm')); };
    });

    /* views */
    var vWrap = $('#views');
    vWrap.innerHTML = Object.keys(CFG.views).map(function (id) {
      var v = CFG.views[id];
      return '<button class="chip" data-view="' + esc(id) + '">' + esc(v.label) + '</button>';
    }).join('');
    $$('#views .chip').forEach(function (b) {
      b.onclick = function () {
        var v = CFG.views[b.getAttribute('data-view')];
        map.flyTo({ center: v.c, zoom: v.z, pitch: v.p, bearing: v.b, duration: 2000, essential: true });
      };
    });

    /* exaggeration */
    var ex = $('#exag');
    ex.value = String(state.exaggeration);
    $('#exagVal').textContent = state.exaggeration.toFixed(1) + '×';
    ex.oninput = function () {
      state.exaggeration = parseFloat(ex.value);
      $('#exagVal').textContent = state.exaggeration.toFixed(1) + '×';
      map.setTerrain(state.exaggeration > 0
        ? { source: 'dem', exaggeration: state.exaggeration }
        : null);
      writeHash();
      if (state.profile.pts.length > 1) drawProfile();
    };

    /* labels overlay */
    $('#chkLabels').onchange = function () {
      state.labels = this.checked;
      map.setLayoutProperty('reflabels', 'visibility', state.labels ? 'visible' : 'none');
    };

    /* hillshade toggle */
    $('#chkHillshade').onchange = function () {
      map.setLayoutProperty('hillshade', 'visibility', this.checked ? 'visible' : 'none');
    };

    /* search */
    var si = $('#search');
    si.oninput = function () { renderResults(si.value); };
    si.onfocus = function () { renderResults(si.value); };
    si.onkeydown = function (e) {
      if (e.key === 'Escape') { si.value = ''; renderResults(''); si.blur(); }
      if (e.key === 'Enter') {
        var first = $('#results .res');
        if (first) first.click();
      }
    };
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.searchbox')) $('#results').classList.remove('open');
    });

    /* collapsible panels */
    initSidebar();
    initSections();

    /* profile tool */
    $('#btnProfile').onclick = function () { setProfileMode(!state.profile.on); };
    $('#profClear').onclick = function () {
      state.profile.pts = [];
      map.getSource('profile').setData(emptyFC());
      drawProfile();
    };
    $('#profMin').onclick = function () {
      setProfileMin(!$('#profile').classList.contains('minimised'), true);
    };
    setProfileMin(!uiGet('profile', true), false);
    $('#profClose').onclick = function () { setProfileMode(false); };

    /* reset north / pitch */
    $('#btnReset').onclick = function () {
      map.easeTo({ pitch: 55, bearing: 0, duration: 900 });
    };

    /* help */
    $('#btnHelp').onclick = function () { $('#help').classList.add('open'); };
    $('#helpClose').onclick = function () { $('#help').classList.remove('open'); };
    $('#help').addEventListener('click', function (e) {
      if (e.target.id === 'help') $('#help').classList.remove('open');
    });
  }

  function setBasemap(id) {
    if (!CFG.basemaps[id] || id === state.basemap) return;
    state.basemap = id;
    var b = CFG.basemaps[id];

    // Swap tiles in place - much faster than rebuilding the whole style.
    // maxzoom can't change on the fly, but MapLibre overzooms the last
    // available level, so low-res basemaps still fill the screen.
    var src = map.getSource('basemap');
    if (src && src.setTiles) src.setTiles(b.tiles);

    var paint = rasterPaint(b);
    Object.keys(paint).forEach(function (k) {
      if (k === 'raster-fade-duration') return;
      map.setPaintProperty('basemap', k, paint[k]);
    });

    $$('#basemaps .chip').forEach(function (c) {
      c.classList.toggle('active', c.getAttribute('data-bm') === id);
    });
    writeHash();
  }

  /* ------------------------------------------------------------ UI state */

  /* Panel open/closed choices persist between visits. Wrapped because
     private-browsing modes can throw on access. */
  var STORE_PREFIX = 'nepsis:ui:';

  function uiGet(key, fallback) {
    try {
      var v = window.localStorage.getItem(STORE_PREFIX + key);
      if (v === null) return fallback;
      return v === '1';
    } catch (e) { return fallback; }
  }

  function uiSet(key, val) {
    try { window.localStorage.setItem(STORE_PREFIX + key, val ? '1' : '0'); }
    catch (e) { /* nothing we can do, and nothing breaks */ }
  }

  /** Collapsible sidebar sections. */
  function initSections() {
    $$('#sidebar .sec').forEach(function (sec) {
      var id = sec.getAttribute('data-sec');
      var head = $('.sec-head', sec);
      var body = $('.sec-body', sec);
      if (!id || !head || !body) return;

      function apply(open, save) {
        sec.classList.toggle('collapsed', !open);
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (save) uiSet('sec.' + id, open);
      }

      apply(uiGet('sec.' + id, true), false);

      head.addEventListener('click', function () {
        apply(sec.classList.contains('collapsed'), true);
      });
    });
  }

  /** Sidebar show/hide, on every screen size. */
  function setSidebar(open, save) {
    document.body.classList.toggle('sidebar-hidden', !open);
    var btn = $('#btnMenu');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (save !== false) uiSet('sidebar', open);
  }

  function toggleSidebar() {
    setSidebar(document.body.classList.contains('sidebar-hidden'), true);
  }

  function initSidebar() {
    // Default: open on a roomy screen, out of the way on a phone or in a
    // short embed (config.embed.hideSidebarByDefault sets .compact).
    var wide = window.innerWidth > 900 &&
               !document.body.classList.contains('compact');
    setSidebar(uiGet('sidebar', wide), false);

    $('#btnMenu').onclick = toggleSidebar;
    $('#btnSideCollapse').onclick = function () { setSidebar(false, true); };
    $('#sideHandle').onclick = function () { setSidebar(true, true); };
  }

  /** Site panel minimise - collapses to just its title bar. */
  function setPanelMin(min, save) {
    var panel = $('#panel');
    if (!panel) return;
    panel.classList.toggle('minimised', min);
    var btn = $('#panelMin', panel);
    if (btn) {
      btn.setAttribute('aria-expanded', min ? 'false' : 'true');
      btn.setAttribute('title', min ? 'Expand' : 'Minimise');
      btn.setAttribute('aria-label', min ? 'Expand this site' : 'Minimise this site');
    }
    if (save !== false) uiSet('panel', !min);
  }

  /** Elevation-profile drawer minimise. */
  function setProfileMin(min, save) {
    var drawer = $('#profile');
    if (!drawer) return;
    drawer.classList.toggle('minimised', min);
    var btn = $('#profMin');
    if (btn) {
      btn.textContent = min ? 'Expand' : 'Minimise';
      btn.setAttribute('aria-expanded', min ? 'false' : 'true');
    }
    if (save !== false) uiSet('profile', !min);
  }

  /* ---------------------------------------------------------------- back */

  /**
   * Resolve a URL and return it ONLY if it stays on the site.
   *
   * "On the site" means the origin the page is served from, or the origin
   * configured as back.site. Everything else - other domains, javascript:,
   * data:, protocol-relative //evil.example - returns null.
   *
   * @param  {string} u  Raw URL or path.
   * @return {string|null} Absolute URL, or null if it would leave the site.
   */
  function sameSiteUrl(u) {
    if (!u) return null;
    var allowed = {};
    allowed[location.origin] = true;

    var cfgSite = (CFG.back && CFG.back.site) || '';
    if (cfgSite) {
      try { allowed[new URL(cfgSite, location.href).origin] = true; } catch (e) { /* ignore */ }
    }

    var parsed;
    try { parsed = new URL(u, location.href); } catch (e) { return null; }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!allowed[parsed.origin]) return null;
    return parsed.href;
  }

  function stripHash(u) {
    return String(u || '').split('#')[0];
  }

  /**
   * The last page on the site the visitor was looking at.
   *
   * 1. The breadcrumb the WordPress plugin writes on every other page.
   *    Survives arriving with no referrer, and is the most accurate.
   * 2. The referrer, when it is on the site.
   *
   * Returns null when the visitor came from outside, or landed here cold.
   */
  function lastInternalPage() {
    var key = (CFG.back && CFG.back.storageKey) || 'nepsis:lastPage';
    var here = stripHash(location.href);

    var stored = null;
    try { stored = window.sessionStorage.getItem(key); } catch (e) { /* blocked */ }
    var safeStored = sameSiteUrl(stored);
    if (safeStored && stripHash(safeStored) !== here) return safeStored;

    var ref = sameSiteUrl(document.referrer);
    if (ref && stripHash(ref) !== here) return ref;

    return null;
  }

  /** True when the browser's previous entry is a page on this site. */
  function cameFromSite() {
    var ref = sameSiteUrl(document.referrer);
    return !!ref && stripHash(ref) !== stripHash(location.href);
  }

  /**
   * Back arrow, shown when the page is opened with ?back=…
   *
   * Getting "go back" right from inside an iframe is the fiddly part:
   * calling history.back() in a frame is not reliably the same as the user
   * pressing the browser's back button. So when we are framed we ask the
   * host page to do it, via postMessage, and only fall back to our own
   * history if nobody is listening.
   */
  function addBackButton(back) {
    var btn = document.createElement('button');
    btn.id = 'btnBack';
    btn.className = 'icon-btn labelled';
    btn.type = 'button';
    btn.title = 'Back to the previous page';
    btn.setAttribute('aria-label', 'Back to the previous page');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path d="M19 12H5M11 18l-6-6 6-6" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg><span>' + esc((CFG.back && CFG.back.label) || 'Back') + '</span>';

    btn.addEventListener('click', function () { goBack(back); });

    // Between the title and the search box.
    var bar = $('#topbar');
    var search = $('.searchbox', bar);
    if (bar) {
      if (search) bar.insertBefore(btn, search);
      else bar.appendChild(btn);
    }
    document.body.classList.add('has-back');
  }

  /* Single place where the app changes the address bar. Overridable via
     window.__hlHooks.navigate, which the test suite uses to observe
     navigation without actually performing it. */
  function navigate(url, win) {
    var w = win || window;
    if (HOOKS && typeof HOOKS.navigate === 'function') { HOOKS.navigate(url, w); return; }
    w.location.href = url;
  }

  function goBack(back) {
    // 1. An explicit, already-validated destination wins.
    if (back && back.url) {
      try {
        if (inFrame() && window.top) { navigate(back.url, window.top); return; }
      } catch (e) { /* cross-origin parent - fall through */ }
      navigate(back.url);
      return;
    }

    // 2. Framed: ask the host page to do it. It owns the real history and
    //    the breadcrumb. Our WordPress template listens for this; if
    //    nothing answers we work it out ourselves a moment later.
    if (inFrame()) {
      var posted = false;
      try {
        window.parent.postMessage({ source: 'nepsis-map', action: 'back' }, '*');
        posted = true;
      } catch (e) { /* ignore */ }
      setTimeout(goBackHere, posted ? 350 : 0);
      return;
    }

    // 3. Plain standalone page.
    goBackHere();
  }

  /**
   * Go back without ever leaving the site.
   *
   * history.back() is preferred when we can see the visitor came from one
   * of our own pages, because it restores their scroll position. When they
   * arrived from outside - a search result, a shared link - stepping back
   * would take them off the site, so we navigate to the last internal page
   * we know about, or to the configured home.
   */
  function goBackHere() {
    if (cameFromSite() && window.history.length > 1) {
      window.history.back();
      return;
    }

    var prev = lastInternalPage();
    if (prev) { navigate(prev); return; }

    navigate((CFG.back && CFG.back.fallbackUrl) || '/');
  }

  /* --------------------------------------------------------------- embed */

  /** "Open full map" link, shown only when running inside an iframe.
      Carries the current camera / era / selection across via the hash. */
  function addFullMapButton() {
    var a = document.createElement('a');
    a.id = 'btnFullMap';
    a.className = 'icon-btn labelled';
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Open the full map in a new tab';
    a.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M14 4h6v6M20 4l-8 8' +
      'M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round"/></svg><span>Full map</span>';

    var base = location.href.split('#')[0].split('?')[0];
    a.href = base + '?embed=0';
    a.addEventListener('mousedown', function () {   // refresh just before opening
      a.href = base + '?embed=0' + (location.hash || '');
    });

    var actions = $('.top-actions');
    if (actions) actions.insertBefore(a, actions.firstChild);
  }

  /* ---------------------------------------------------------------- init */

  /**
   * ?home=https://example.org/ overrides the site the back arrow is bound
   * to. The WordPress plugin passes this so the map works on whatever
   * domain it is installed on - staging, a new domain - without anyone
   * having to edit js/config.js.
   */
  function applyHomeOverride() {
    var h = new URLSearchParams(location.search).get('home');
    if (!h) return;
    try {
      var u = new URL(h, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      CFG.back = CFG.back || {};
      CFG.back.site = u.origin;
      CFG.back.fallbackUrl = u.href;
    } catch (e) { /* leave the configured values alone */ }
  }

  function init() {
    applyHomeOverride();

    var h = readHash();
    var q = readQuery();
    var emb = CFG.embed || {};

    state.embedded = isEmbedded();
    if (state.embedded) {
      document.body.classList.add('embedded');
      if (emb.hideSidebarByDefault) document.body.classList.add('compact');
    }

    /* query string sets the opening state... */
    if (q.era) state.era = q.era;
    if (q.basemap) state.basemap = q.basemap;
    if (q.exaggeration != null) state.exaggeration = q.exaggeration;

    var start = CFG.views[q.view || CFG.defaults.view];
    var camera = { c: start.c, z: start.z, p: start.p, b: start.b };

    // ?site= with no explicit ?view= opens on that site
    if (q.site && !q.view) {
      camera = { c: state.byId[q.site].geometry.coordinates, z: 12, p: 62, b: -20 };
    }

    /* ...and a #hash, which is what the share URL produces, overrides it. */
    if (h) {
      state.era = h.era; state.basemap = h.basemap;
      state.exaggeration = h.exaggeration;
      camera = { c: h.center, z: h.zoom, p: h.pitch, b: h.bearing };
    }

    map = new maplibregl.Map({
      container: 'map',
      style: buildStyle(),
      center: camera.c,
      zoom: camera.z,
      pitch: camera.p,
      bearing: camera.b,
      maxPitch: 85,
      minZoom: 2,
      maxZoom: 16,
      attributionControl: false,
      hash: false,
      // Inside an iframe, a bare scroll should scroll the host page, not the
      // map. Cooperative gestures make zoom need Ctrl/Cmd, and pan need two
      // fingers on touch - the standard behaviour for an embedded map.
      cooperativeGestures: state.embedded && emb.cooperativeGestures !== false
    });
    window.hlMap = map;

    var back = readBack();
    if (back) addBackButton(back);
    if (state.embedded && emb.showFullMapButton !== false) addFullMapButton();

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
    map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('style.load', function () {
      map.setTerrain({ source: 'dem', exaggeration: state.exaggeration });
    });

    map.on('load', function () {
      map.getSource('sites').setData(state.sites);
      map.getSource('regions').setData(state.regions);
      state.ready = true;

      buildUI();
      applyFilters();

      var openSite = (h && h.site && state.byId[h.site]) ? h.site : q.site;
      if (openSite) selectSite(openSite, false);

      $('#loading').classList.add('done');
      setTimeout(function () {
        var l = $('#loading'); if (l && l.parentNode) l.parentNode.removeChild(l);
      }, 700);
    });

    map.on('error', function (e) {
      // Tile 404s over ocean are normal; only surface real style/font failures.
      var msg = (e && e.error && e.error.message) || '';
      if (/glyph|font/i.test(msg)) {
        var w = $('#warn');
        w.textContent = 'Label fonts failed to load. Markers still work; check the glyphs URL in js/config.js.';
        w.classList.add('open');
      }
      // eslint-disable-next-line no-console
      console.warn('[nepsis-map]', msg || e);
    });

    /* interaction ---------------------------------------------------- */

    var dotLayers = [1, 2, 3, 4].map(function (r) { return 'site-dot-' + r; });
    var hoverPopup = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, offset: 12, className: 'hl-popup'
    });

    dotLayers.forEach(function (id) {
      map.on('mouseenter', id, function (e) {
        map.getCanvas().style.cursor = 'pointer';
        var p = e.features[0].properties;
        hoverPopup.setLngLat(e.features[0].geometry.coordinates)
          .setHTML('<strong>' + esc(p.name) + '</strong>' +
            (p.modern ? '<em>' + esc(p.modern) + '</em>' : ''))
          .addTo(map);
      });
      map.on('mouseleave', id, function () {
        map.getCanvas().style.cursor = state.profile.on ? 'crosshair' : '';
        hoverPopup.remove();
      });
      map.on('click', id, function (e) {
        if (state.profile.on) return;
        e.originalEvent.stopPropagation();
        selectSite(e.features[0].properties.sid, false);
      });
    });

    map.on('click', function (e) {
      if (state.profile.on) {
        addProfilePoint(e.lngLat);
        return;
      }
      var hit = map.queryRenderedFeatures(e.point, { layers: dotLayers });
      if (!hit.length && state.selected) closePanel();
    });

    /* live elevation readout under the cursor */
    var elBox = $('#cursorElev');
    map.on('mousemove', function (e) {
      var m = elevationAt(e.lngLat);
      elBox.innerHTML =
        '<span class="ce-lbl">Elev</span> <span class="ce-val">' +
        (m == null ? '—' : Math.round(m).toLocaleString() + ' m') + '</span>' +
        '<span class="ce-ll">' + e.lngLat.lat.toFixed(3) + '°N ' +
        e.lngLat.lng.toFixed(3) + '°E</span>';
    });
    map.on('mouseout', function () { elBox.innerHTML = ''; });

    map.on('moveend', writeHash);

    /* keyboard shortcuts */
    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
      if (e.key === 'Escape') { closePanel(); $('#help').classList.remove('open'); }
      if (e.key === 'p' || e.key === 'P') setProfileMode(!state.profile.on);
      if (e.key === '[' || e.key === ']') { e.preventDefault(); toggleSidebar(); }
      if (e.key === '?') $('#help').classList.add('open');
    });
  }

  /* ---------------------------------------------------------------- go */

  try {
    load();
    init();
  } catch (err) {
    $('#loading').innerHTML =
      '<div class="load-err"><h2>Could not start the map</h2>' +
      '<p>' + esc(err.message) + '</p>' +
      '<p>Check that <code>data/data.js</code> is present next to ' +
      '<code>index.html</code> and that the page was not blocked from ' +
      'loading it.</p></div>';
    // eslint-disable-next-line no-console
    console.error(err);
  }

})();
