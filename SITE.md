# Nepsis Holy Land — the four studies as one site

This repository is four interactive reconstructions served as a single
site, sharing one masthead, one palette, and one set of branding. It is
built to open three ways with **no build step and no dependencies**:

- double-clicked from disk (`file://…/index.html`)
- served from any static host (GitHub Pages, `/public_html/…`)
- dropped into a WordPress subfolder at any path

If you only want to understand the Holy Land map itself — its data
model, eras, or the WordPress plugin — see [`README.md`](README.md).
This file is about how the four fit together.

---

## The four studies

| Study | Folder | What it is |
|---|---|---|
| **The Holy Land** | `index.html` | 3D terrain map, 150 sites, Genesis to Revelation |
| **Ministry of Christ** | `apps/ministry/` | Three ministry years, 34 journeys, c. AD 27–30 |
| **Ancient Jerusalem** | `apps/jerusalem/` | The city at Passover, c. AD 30 |
| **Herod's Temple** | `apps/temple/` | The Second Temple and its courts |

The Holy Land map is the front door (`index.html` at the root), which is
why the site opens there by default. The other three sit under `apps/`.

---

## How they share one identity

Everything shared lives in `shared/`:

```
shared/
  nepsis.css            palette tokens + the masthead
  nepsis-shell.js       the app switcher, injected into all four pages
  theme-holy-land.css   per-app recolour, loaded AFTER each app's own CSS
  theme-ministry.css
  theme-jerusalem.css
  theme-temple.css
  nepsis-logo.png       the wordmark, in the masthead + each loader
  nepsis-mark.png       the staurogram, used as the favicon
```

Each page declares who it is and where the root is, then loads the
shell — always as the **last** thing in `<head>`, after the app's own
`<style>`, so the theme layer wins on equal specificity:

```html
<link rel="stylesheet" href="../../shared/nepsis.css">
<link rel="stylesheet" href="../../shared/theme-jerusalem.css">
<script>window.NEPSIS_APP = { id: 'jerusalem', base: '../../' };</script>
<script defer src="../../shared/nepsis-shell.js"></script>
```

`base` is the relative path from that page back to the site root: `''`
for the Holy Land map at the root, `'../../'` for the three under
`apps/<id>/`. Because every link the shell builds is relative to `base`,
the whole folder can move anywhere without editing a single path.

### The palette

Five colours, and only five, in all site chrome:

| | |
|---|---|
| `#000000` | headings, the wordmark |
| `#1a1a1a` | body text, dark ground |
| `#aa0000` | the single accent — current study, links, active state |
| `#fafafa` | panel "paper" |
| `#ffffff` | fields and lifted surfaces |

Two deliberate exceptions, both because the colour **carries meaning**
the reconstruction exists to convey, and flattening it to one accent
would destroy that meaning:

- Ancient Jerusalem's confidence chips (excavated / probable / disputed)
  keep a green–amber–red scale, darkened for a paper ground.
- Herod's Temple's passage guide keeps four distinguishable dots
  (explicit / probable / court / disputed).

The **3D scenes themselves are never repainted** — terrain, masonry,
marble, gold, sky and water are the reconstruction, not the interface.
The palette governs chrome only.

---

## Cross-links between studies

Two paths connect the studies, both driven by data so they survive the
folder being moved:

1. **The masthead** is on every page: inline tabs above 1180px wide,
   collapsing to a dropdown below. The current study is marked with the
   accent.

2. **Site panels in the Holy Land map** offer a way through to the study
   that covers a place in detail. This is the `deepLinks` map in
   `js/config.js` — e.g. clicking Jerusalem offers "Walk the city" and
   "Step inside Herod's Temple"; Capernaum, Nazareth and Bethlehem offer
   "Trace Christ's ministry". Ancient Jerusalem likewise links out to the
   Temple from within the city.

An app used on its own (without the shell) simply shows no cross-links,
rather than breaking.

---

## Running it

```
# any static server; the site is pure files
python3 -m http.server 8000
# → http://localhost:8000/
```

Or just open `index.html`. Everything works from `file://` too — that
constraint is why the map uses raw WebGL/MapLibre with no bundler.

### Suppressing the masthead

Add `?nav=0` to any page to remove the shared bar — used when the page
is embedded in a WordPress page that already carries the site's own
navigation. The WordPress plugin passes this automatically.

---

## WordPress

The bundled plugin (`plugin/`) serves any of the four studies through
its full-page takeover. The `app` attribute selects which:

```
[nepsis_map]                     the Holy Land map (default)
[nepsis_map app="ministry"]      Ministry of Christ
[nepsis_map app="jerusalem"]     Ancient Jerusalem
[nepsis_map app="temple"]        Herod's Temple
```

`view`, `era`, `site`, `basemap` and `exag` apply to the Holy Land map
only; the other three ignore them but share `home`, `back` and `embed`,
so the back arrow and cross-app navigation behave identically
everywhere. An unrecognised `app` value falls back to the map, so a typo
can never point the iframe off the site.

See [`README.md`](README.md) for the full shortcode reference.

---

## Checking it works

There is nothing to build and nothing to run — open `index.html` in a
browser and click through the four studies from the masthead. To confirm
the whole site is intact, check that:

- the masthead appears on all four pages, with the current study marked
  in red and the other three reachable from the dropdown or tabs;
- the Holy Land map's site panels for Jerusalem, Capernaum, Nazareth and
  Bethlehem show a red button leading into the relevant study;
- Ancient Jerusalem links out to Herod's Temple from within the city;
- adding `?nav=0` to any page hides the shared bar (used by the
  WordPress embed).

The pages are plain HTML/CSS/JS with only relative links, so if the
folder opens at all, every asset resolves.

## What was changed when merging

Each app kept its own document — they have hard global-name collisions
(`gl`, `cam`, `SITES`, `OBJ`, `V`, `P`), so a single combined file was
never an option. Merging was therefore additive:

- each app's own brand block, app menu and back link were **removed**,
  since the shared masthead now carries all three;
- panels were offset below the masthead by `--nm-h`; the canvases stay
  full-viewport, so no renderer's resize path was touched;
- the Holy Land map's hard-coded map colours moved into a `theme` block
  in `js/config.js` (with defaults in `app.js`, so an older config still
  draws);
- three WordPress-hosted logo URLs and eleven absolute links to the
  Temple Mount now point at files inside this folder.

The apps remain individually runnable: lifted out on their own, each one
still boots, just without the shared chrome.
