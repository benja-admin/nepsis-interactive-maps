# Nepsis Ministries — Holy Land 3D Map

> **This repo is now four studies in one site** — the Holy Land map, the
> Ministry of Christ, Ancient Jerusalem, and Herod's Temple, sharing one
> masthead and one set of branding. For how they fit together, the shared
> palette, cross-links, and the WordPress `app="…"` attribute, see
> **[`SITE.md`](SITE.md)**. The rest of this file documents the Holy Land
> map itself.


An interactive, realistically shaded **3D terrain map of the Bible lands**, built for study and
teaching. 150 sites from Genesis to Revelation, filterable by biblical era, each with a short
historical note and links to the passages where it appears — laid over real elevation data so you
can see *why* the geography matters.

**No API keys. No accounts. No build step. No tracking.** Clone it, open it, done.

<!-- Replace with your own screenshot once deployed -->
<!-- ![Holy Land 3D](docs/screenshot.png) -->

---

## Why 3D

Flat Bible maps hide the thing that shaped the whole narrative: the land is steep, narrow, and
divided by a rift valley. On this map you can see it directly.

| Thing you can see | Why it matters |
|---|---|
| Jerusalem at ~750 m on a ridge, Jericho at ~-250 m | Scripture *always* says people went **up** to Jerusalem and **down** to Jericho — a 1,000 m drop in 25 km (Luke 10:30) |
| The Dead Sea at -430 m, lowest land on earth | The rift the Jordan pours into and never leaves (Ezekiel 47:8) |
| The Sea of Galilee at -210 m, ringed by hills | Cold air spilling off the Golan is what makes the squalls of Mark 4:35-41 |
| The Megiddo pass | Where the international highway squeezes through a ridge — the most fought-over ground in the Near East (2 Kings 23:29) |
| The Judean wilderness starting a few km east of Bethlehem | Farmland to desert in one rain shadow (1 Samuel 23:14) |
| Mount Hermon at 2,814 m over Caesarea Philippi | The setting of Peter's confession (Matthew 16:13) |

---

## Features

- **Real 3D terrain** — global 30 m elevation, tilt and orbit freely, adjustable vertical
  exaggeration (0–6×)
- **150 sites** across the whole Bible world: Ur to Rome, Thebes to Nineveh, with a dense cluster
  through Israel, Judah and Galilee
- **Era timeline** — 9 periods from *Patriarchs* to *Early Church*. Sliding it re-filters both the
  site markers and the regional labels, so the Divided Kingdom shows Israel/Judah and Samaria,
  while Early Church opens out to Asia, Macedonia and Rome
- **Scripture references** on every site, linked straight to the passage
- **Live elevation readout** under the cursor, corrected for exaggeration
- **Elevation profile tool** — click points on the map and get a real cross-section with distance,
  high/low and total relief
- **Four basemaps**: satellite, shaded relief, topographic, and a warm "parchment" atlas look
- **Search** by biblical name, modern name, or verse reference
- **Shareable URLs** — the hash encodes camera, era, basemap and selected site
- Honest about uncertainty: disputed identifications (Ai, Emmaus, Sodom, Sinai, Bethsaida, Cana)
  say so in the panel

---

## Quick start

```bash
git clone https://github.com/<you>/holy-land-3d.git
cd nepsis-map
```

Then either:

**Just open it.** Double-click `index.html`. The data ships as a plain `<script>` bundle, so it
works straight off disk over `file://`.

**Or serve it** (recommended, and required for the `data/*.json` files to be fetchable by other
tools):

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

### Deploy to WordPress

Zip the `plugin/` folder together with the site files (or upload the whole
site folder to your host and point the plugin at it). Then in WordPress:
Plugins → Add New → **Upload Plugin** → Activate → put `[nepsis_map]` in a
page. Use `[nepsis_map app="ministry"]` (or `jerusalem`, `temple`) for the
other studies. Full walkthrough in **[DEPLOY.md](DEPLOY.md)**.

```
[holy_land_map]
[holy_land_map view="galilee" era="gospels" height="600px"]
[holy_land_map site="capernaum" fullwidth="yes"]
```

The map detects that it is inside an iframe and switches on cooperative gestures, so a plain
scroll moves the host page rather than zooming the map.

### Deploy to GitHub Pages

1. Push the repo to GitHub (public repo).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The included workflow (`.github/workflows/pages.yml`) runs the test suite and, if it passes,
   publishes the repo root on every push to `main`.

Live at `https://YOURNAME.github.io/holy-land-3d/`. Nothing to compile.

**On your own domain:** use a *subdomain* (`map.yoursite.com`) via one CNAME record, and commit a
`CNAME` file so the setting survives Actions deploys. Full walkthrough, DNS instructions per
provider, and the Cloudflare gotcha: **[DEPLOY-GITHUB-PAGES.md](DEPLOY-GITHUB-PAGES.md)**.

> If you already run WordPress on the apex domain, **do not** add the `A` records that most Pages
> tutorials tell you to — that would take your site offline. The subdomain route touches nothing
> that already exists.

---

## Controls

| | |
|---|---|
| Drag | Pan |
| Scroll | Zoom |
| **Right-drag** or **Ctrl**+drag | Tilt and rotate — this is where the 3D pays off |
| Click a marker | Open the site panel |
| <kbd>/</kbd> | Focus search |
| <kbd>P</kbd> | Elevation profile tool |
| <kbd>Esc</kbd> | Close panels |
| <kbd>?</kbd> | Help |

---

## Project layout

```
index.html                    the Holy Land map — the site's front door
css/style.css                 the map's styles
js/config.js                  tile sources, basemaps, camera presets, colours  ← swap providers here
js/app.js                     all map + UI logic
data/
  data.js                     the bundle the map loads via <script> (works over file://)
  sites.json                  the same 150 sites as GeoJSON
  regions.json                regional/label points as GeoJSON
  meta.json                   era and category definitions

apps/
  ministry/index.html         Ministry of Christ — standalone page
  jerusalem/index.html        Ancient Jerusalem — standalone page
  temple/index.html           Herod's Temple — standalone page

shared/                       the shared UI, loaded by all four pages
  nepsis.css                  palette + the masthead
  nepsis-shell.js             the app switcher, injected into every page
  theme-*.css                 per-app recolour to the Nepsis palette
  nepsis-logo.png             the wordmark
  nepsis-mark.png             the favicon

plugin/
  nepsis-holy-land-map.php    WordPress shortcode + full-page takeover
  templates/fullscreen.php    the standalone page a study is served in
wordpress/
  embed-snippet.html          plain iframe block, no plugin needed

.htaccess                     Apache: frame options, MIME types, gzip, caching
.nojekyll                     tells GitHub Pages to serve the folder as-is
CNAME.example                 copy to CNAME for a GitHub Pages custom domain
SITE.md                       how the four studies fit together as one site
DEPLOY.md                     WordPress plugin install + shortcode reference
DEPLOY-GITHUB-PAGES.md        GitHub Pages on your own subdomain
```

Every page is plain HTML/CSS/JS with relative links only. There is no
build step, no framework, and nothing to install — open `index.html` and
it runs.

### URL parameters

Both the standalone page and the iframe accept deep links:

```
?view=galilee&era=gospels          open on the lake, Gospel-era sites only
?site=capernaum                    open on a site with its panel showing
?basemap=relief&exag=3             bare landform at 3× vertical exaggeration
?embed=1                           force embedded behaviour (cooperative gestures)
?back=1                            show the back arrow, using browser history
?back=/resources/                  show it, always returning to that page
```

Invalid values fall back to defaults rather than breaking. The `#hash` the map writes as you move
takes precedence over these, so a URL copied from the address bar always restores exactly what you
were looking at.

### Editing the dataset

Every site lives in `data/sites.json` (plus `data/regions.json` and
`data/meta.json`), and the running map reads the combined copy from
`data/data.js`. Each site carries its name, modern name, coordinates,
category, rank, eras, description, scripture references and any note on
identification. **Rank** controls the zoom at which a site appears — `1`
is always visible, `4` only when zoomed in.

To change the map's data, edit `data/data.js` directly (it assigns
`window.HL_DATA = { … }`), keeping the JSON files in `data/` in step if
you consume them elsewhere. No build step is involved — the map loads
`data/data.js` as a plain `<script>`, which is what lets it run straight
off disk.

---

## Data sources

All public, all key-free.

| Layer | Source | Licence |
|---|---|---|
| Elevation (terrain + hillshade + profiles) | [Tilezen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) on AWS Open Data — NASA SRTM, USGS NED, NOAA ETOPO1 | [Mixed, see attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) |
| Satellite / relief / topo / physical imagery | [Esri ArcGIS Online](https://server.arcgisonline.com/) — Esri, Maxar, Earthstar Geographics, USGS | Esri terms of use |
| Label fonts | [fonts.openmaptiles.org](https://fonts.openmaptiles.org/) | Open Sans, Apache 2.0 |
| Map engine | [MapLibre GL JS](https://maplibre.org/) 5.24 | BSD-3 |

Swap any of these in `js/config.js` — the basemap list, the DEM, the glyph server and the camera
presets are all data, not code.

## On the site identifications

Locations follow mainstream biblical geography (the identifications you'll find in the *Carta
Bible Atlas*, the *ESV Bible Atlas*, and standard reference works). Coordinates point at the
excavated tell or the traditional site, not at a modern municipality's centre.

Where scholars genuinely disagree, the site panel says so rather than pretending otherwise —
Ai, Emmaus, Gilgal, Sodom, Mount Sinai, Bethsaida, Cana and Mount Tabor all carry notes. Sepphoris,
Masada, Qumran and Persepolis are included for first-century and exilic context even though they
are never named in Scripture.

Corrections are welcome — open an issue with a source and I'll take it.

## Licence

Code: [MIT](LICENSE). Map and elevation data remain under the licences of their providers above.
