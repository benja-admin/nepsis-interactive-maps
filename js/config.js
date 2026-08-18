/* ------------------------------------------------------------------
   Nepsis Ministries Holy Land map - configuration
   Every data source below is public and requires NO API key or signup.
   ------------------------------------------------------------------ */

window.HL_CONFIG = {

  /* Global elevation model. Tilezen "terrarium" PNGs on AWS Open Data.
     Free, no key, CORS-enabled, zoom 0-15 worldwide.
     https://registry.opendata.aws/terrain-tiles/                        */
  dem: {
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 14,
    attribution:
      '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Tilezen Terrain Tiles</a> (NASA SRTM / USGS / NOAA)'
  },

  /* Glyph (font) server for map labels. Public, key-free.
     If labels ever stop drawing, swap in another PBF glyph host here. */
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  fontRegular: 'Open Sans Regular',
  fontBold: 'Open Sans Bold',

  /* Basemaps - Esri public tile services, key-free with attribution. */
  esriAttribution:
    'Imagery &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, USGS, NASA',

  basemaps: {
    satellite: {
      label: 'Satellite',
      hint: 'True-colour imagery. Best for seeing real terrain and vegetation.',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      maxzoom: 18, saturation: 0, hueRotate: 0, brightnessMin: 0, brightnessMax: 1, contrast: 0
    },
    relief: {
      label: 'Shaded relief',
      hint: 'Bare landform. The clearest way to read valleys, ridges and the Rift.',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'],
      maxzoom: 13, saturation: -0.15, hueRotate: 0, brightnessMin: 0.05, brightnessMax: 1, contrast: 0.1
    },
    topo: {
      label: 'Topographic',
      hint: 'Contours, roads and modern place names for orientation.',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
      maxzoom: 18, saturation: 0, hueRotate: 0, brightnessMin: 0, brightnessMax: 1, contrast: 0
    },
    parchment: {
      label: 'Parchment',
      hint: 'Physical map warmed to an atlas look - good for printing and study notes.',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'],
      maxzoom: 8, saturation: -0.35, hueRotate: 0.12, brightnessMin: 0.18, brightnessMax: 1, contrast: -0.1
    }
  },

  /* Optional modern-labels overlay (off by default). */
  referenceLabels: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 18
  },

  /* Camera presets. [lng, lat, zoom, pitch, bearing] */
  views: {
    all:       { label: 'Whole Bible lands', c: [37.0, 33.6],   z: 4.1,  p: 25, b: 0 },
    levant:    { label: 'Israel & Judah',    c: [35.25, 31.90], z: 7.3,  p: 52, b: 0 },
    galilee:   { label: 'Sea of Galilee',    c: [35.58, 32.83], z: 10.2, p: 66, b: -18 },
    jerusalem: { label: 'Jerusalem',         c: [35.235, 31.775], z: 12.6, p: 68, b: -25 },
    rift:      { label: 'Jordan Rift',       c: [35.47, 31.65], z: 8.4,  p: 72, b: -8 },
    sinai:     { label: 'Sinai & the Exodus',c: [33.60, 29.60], z: 6.7,  p: 50, b: 0 },
    aegean:    { label: "Paul's Aegean",     c: [25.50, 38.60], z: 5.6,  p: 35, b: 0 }
  },

  defaults: {
    basemap: 'satellite',
    exaggeration: 2.0,
    era: 'all',
    view: 'levant'
  },

  /* Embedding (e.g. inside a WordPress page).
     The map auto-detects when it is inside an <iframe> and switches on
     "cooperative gestures": a plain scroll then scrolls the host page
     instead of zooming the map, and touch panning needs two fingers.
     Force it either way with ?embed=1 or ?embed=0 on the iframe src.     */
  embed: {
    autoDetect: true,
    cooperativeGestures: true,   // require Ctrl/Cmd + scroll to zoom when embedded
    showFullMapButton: true,     // "Open full map" link out of the iframe
    hideSidebarByDefault: false  // set true if your embed is short (< 500px)
  },

  /* Back arrow, in the toolbar between the title and the search box.
     Shown by default. Hide it on a page with ?back=no, or pin it to a
     fixed destination with ?back=/some-page/.

     It NEVER sends anyone off the site. A plain browser "back" would
     bounce a visitor who arrived from Google straight back to Google,
     so instead we look for the last page they were on at `site` -
     first the breadcrumb the WordPress plugin records, then the
     referrer - and use `fallbackUrl` when there isn't one.            */
  back: {
    show: true,
    label: 'Back',
    site: 'https://nepsisministries.org',         // the only origin we will send people to
    fallbackUrl: 'https://nepsisministries.org/', // when no internal page is known
    storageKey: 'nepsis:lastPage'                 // written by the site-wide breadcrumb
  },

  /* ------------------------------------------------------------------
     Nepsis palette, applied to the things the map DRAWS. Chrome colours
     live in shared/theme-holy-land.css; these are the map's own layers,
     which MapLibre paints rather than CSS.

     Imagery, hillshade and the sky are deliberately absent: those are
     the terrain, not the interface, and forcing them into five colours
     would make the land less legible, not more branded.               */
  theme: {
    accent:       '#aa0000',   // selection ring, profile line
    accentFill:   'rgba(170,0,0,.16)',
    mapBg:        '#1a1a1a',   // behind the imagery, before tiles land
    markerStroke: '#1a1a1a',   // ring around each site dot
    labelHalo:    '#000000',
    siteLabel:    '#ffffff',
    regionLabel:  '#fafafa',
    profileGrid:  'rgba(26,26,26,.22)',
    profileText:  'rgba(26,26,26,.55)',
    profileSea:   '#1a1a1a',
    profileSeaText: 'rgba(26,26,26,.75)'
  },

  /* ------------------------------------------------------------------
     Cross-links into the sibling reconstructions. When a site panel
     opens for one of these, the panel offers a way through to the app
     that covers it in detail. Paths are relative to this folder, so
     they survive being moved to a subdirectory or another domain.    */
  deepLinks: {
    jerusalem: [
      { app: 'jerusalem', label: 'Walk the city, c. AD 30' },
      { app: 'temple',    label: "Step inside Herod's Temple" }
    ],
    capernaum:  [{ app: 'ministry', label: "Trace Christ's ministry" }],
    nazareth:   [{ app: 'ministry', label: "Trace Christ's ministry" }],
    bethlehem:  [{ app: 'ministry', label: "Trace Christ's ministry" }]
  },

  bibleUrl: function (ref) {
    return 'https://www.biblegateway.com/passage/?search=' +
      encodeURIComponent(ref) + '&version=ESV';
  }
};
