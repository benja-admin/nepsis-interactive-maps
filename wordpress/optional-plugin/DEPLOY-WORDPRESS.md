# Putting the map on your WordPress site

For **self-hosted WordPress** (wordpress.org), embedded in a page.

There are two routes. **Route A is the easy one** and is what most people should use.

| | Route A — plugin ZIP | Route B — manual upload |
|---|---|---|
| How | Plugins → Add New → Upload | cPanel/FTP + a plugin file |
| cPanel or FTP needed | No | Yes |
| Where the map lives | inside the plugin | `public_html/holy-land-map/` |
| Updating | re-upload the ZIP | re-upload changed files |
| Survives a host migration | Yes, it's part of the plugin | Only if you copy the folder too |

Both end up with the same `[holy_land_map]` shortcode and identical behaviour on the page.

---

# Route A — install the packaged plugin (5 minutes)

1. Grab **`holy-land-map.zip`** from the project folder.
2. WordPress admin → **Plugins** → **Add New Plugin** → **Upload Plugin**.
3. Choose the ZIP → **Install Now** → **Activate**.
4. Add a **Shortcode** block to any page containing `[holy_land_map]`. Publish.

That's the whole thing. The map files travel inside the plugin, so there is no separate upload and
nothing to keep in sync. On the Plugins screen you'll see an **Open map** link to view it
full-screen.

**If your host caps upload size** ("The uploaded file exceeds upload_max_filesize"), the ZIP is
only ~66 KB, so this is essentially never a problem here — but if you hit it, use Route B.

### Rebuilding the ZIP after you edit the data

```bash
python3 build_data.py      # regenerate data/ from build_data.py
python3 build_plugin.py    # repackage → holy-land-map.zip
```

Then re-upload in WordPress (it will offer to replace the existing plugin). The plugin version
number is baked into the iframe URL, so bumping `Version:` in `wordpress/holy-land-map.php` and
`HL3D_VERSION` together forces browsers past their cached copy. `build_plugin.py` refuses to build
if those two disagree.

Skip to [Shortcode options](#shortcode-options).

---

# Route B — manual upload

Use this if you'd rather keep the map outside WordPress entirely, or your host blocks plugin
uploads. Budget about 15 minutes.

The map is plain static files, so it does **not** go through WordPress at all. You drop the
folder next to WordPress on the same server, Apache serves it directly, and a page on your site
displays it in an iframe.

## Step 1 — Upload the map folder

Get the `holy-land-3d` folder onto your server as `public_html/holy-land-map/`.

**Via cPanel File Manager** (easiest, no software to install):

1. Zip the `holy-land-3d` folder on your computer.
2. cPanel → **File Manager** → open **public_html** (on some hosts: `www`, `htdocs`, or
   `public_html/yoursite.com`). This is the folder containing `wp-config.php`, `wp-content`, etc.
3. **+ Folder** → name it `holy-land-map` → enter it.
4. **Upload** → drop in your zip → back in File Manager, right-click it → **Extract**.
5. Delete the zip.
6. **Important:** if extracting created `holy-land-map/holy-land-3d/index.html`, move everything up
   one level so `index.html` sits directly in `holy-land-map/`.
7. Turn on **Settings → Show Hidden Files (dotfiles)** and confirm `.htaccess` came across. If it
   didn't, create it and paste in the contents of the `.htaccess` from this repo.

**Via FTP/SFTP** (FileZilla, Cyberduck): connect with the credentials from your host, and drag the
folder into `public_html/`, renaming it `holy-land-map`.

**Do not upload it inside `wp-content/`.** That folder gets rewritten, scanned, and sometimes wiped
by migration and security plugins.

### What you should have

```
public_html/
├── wp-admin/
├── wp-content/
├── wp-config.php
├── index.php
└── holy-land-map/          ← new
    ├── .htaccess
    ├── index.html
    ├── css/style.css
    ├── js/app.js
    ├── js/config.js
    └── data/…
```

## Step 2 — Check it works on its own

Visit **`https://yoursite.com/holy-land-map/`**.

You should get the full map: satellite terrain, tilted, markers across Israel.

This works without any WordPress configuration because WordPress's own `.htaccess` only routes a
request to `index.php` when the file or directory doesn't exist — and yours now does. If you see a
**404 from your theme**, the folder is in the wrong place or is named differently. If you see a
**directory listing**, `index.html` is one level too deep (see step 1.6).

## Step 3 — Install the shortcode plugin

1. Upload `wordpress/holy-land-map.php` to `wp-content/plugins/holy-land-map.php`.
2. WordPress admin → **Plugins** → activate **Holy Land 3D Map**.

The plugin detects that it has no bundled map folder and automatically looks for
`/holy-land-map/` instead — it's the same file used in Route A, so there is nothing to edit. It
will show a one-line notice on the Plugins screen confirming which path it's using.

Then in any page or post, add a **Shortcode** block containing:

```
[holy_land_map]
```

Publish and view the page. Done.

<details>
<summary><b>Prefer not to install a plugin?</b></summary>

Use a **Custom HTML** block instead and paste the contents of
`wordpress/embed-snippet.html`. Same result, but you have to edit the path and styling by hand in
every page you use it on. Make sure you paste into the *Custom HTML* block or the Classic Editor's
**Text** tab — the Visual tab strips `<iframe>` and `<style>`.
</details>

---

<a id="shortcode-options"></a>

# Shortcode options

```
[holy_land_map]                                  full map, 78% of viewport height
[holy_land_map height="600px"]                   fixed height
[holy_land_map fullwidth="yes"]                  break out of the content column
[holy_land_map view="galilee" era="gospels"]     open on the lake, Gospel sites only
[holy_land_map site="capernaum"]                 open on Capernaum with its panel showing
[holy_land_map view="rift" basemap="relief" exag="3"]   the Jordan Rift, bare landform, 3× relief
[holy_land_map caption="no"]                     hide the instructions line underneath
```

| Attribute | Values |
|---|---|
| `height` / `minheight` | any CSS length, e.g. `600px`, `70vh` |
| `view` | `all` `levant` `galilee` `jerusalem` `rift` `sinai` `aegean` |
| `era` | `patriarchs` `exodus` `judges` `united` `divided` `exile` `intertest` `gospels` `acts` `all` |
| `site` | any site id, e.g. `capernaum`, `jerusalem`, `mount-sinai`, `megiddo` |
| `basemap` | `satellite` `relief` `topo` `parchment` |
| `exag` | `0`–`6` |
| `fullwidth` | `yes` / `no` |
| `caption` | `yes` / `no` |
| `path` | only if the map isn't where the plugin expects: a folder (`/holy-land-map/`) or a full URL |

Site ids are the name lowercased with hyphens — you can see them all in `data/sites.json`, or grab
one by clicking a marker on the live map and reading the last field of the URL hash.

This makes the map genuinely reusable in teaching: a post on the feeding of the five thousand can
open on Tabgha, a post on Elijah can open on Carmel.

---

## The one behaviour worth knowing about

When the map is inside an iframe it switches on **cooperative gestures**. Scrolling the wheel over
it scrolls *your page* as normal; zooming the map needs **Ctrl** (or **⌘**) + scroll, and panning
on a phone needs **two fingers**. Without this, anyone scrolling down your page would get trapped
in the map. The map shows a brief on-screen hint the first time someone tries.

There's also an **"Full map"** button in the map's toolbar when embedded, which opens the
standalone version in a new tab, carrying the current camera position and era across.

---

## Troubleshooting

**Blank or dark box where the map should be.**
A security plugin (Wordfence, iThemes Security, All In One WP Security) is sending
`X-Frame-Options: DENY` for the whole site. The `.htaccess` in the map folder overrides it back to
`SAMEORIGIN` — confirm that file uploaded (it's hidden by default in File Manager). If your host
runs Nginx rather than Apache, ask support to set `add_header X-Frame-Options SAMEORIGIN;` for
`/holy-land-map/`.

**Map is there but no place names.**
The label fonts come from `fonts.openmaptiles.org`. If a firewall or a privacy plugin blocks it,
markers still work but labels vanish. Swap `glyphs` in `js/config.js` for another PBF glyph host.

**Terrain is flat.**
The elevation tiles come from `s3.amazonaws.com`. Check the browser console (F12) for blocked
requests — some aggressive CDN or ad-blocking setups intercept S3.

**"Mixed content" warning.**
Your site is on HTTPS but something is loading over HTTP. Every source the map uses is HTTPS, so
this is almost always a different plugin. Check that `src` in the iframe is `/holy-land-map/…`
(root-relative) and not `http://yoursite.com/…`.

**Caching plugin serving a stale map after you edit it.**
WP Rocket / LiteSpeed / W3 Total Cache generally leave static subfolders alone, but Cloudflare
does not. Purge the Cloudflare cache, or add a page rule bypassing cache for
`yoursite.com/holy-land-map/*`.

**It's slow on mobile.**
Drop `height` to `60vh` and consider `basemap="relief"` as the default — the shaded-relief tiles
are far lighter than satellite imagery and arguably read the landform better anyway.

---

## Updating the map later

Edit `build_data.py` to add or correct sites, then:

```bash
python3 build_data.py
```

**Route A:** run `python3 build_plugin.py` and re-upload the ZIP in WordPress.
**Route B:** re-upload `data/` and whatever else changed by FTP.

Nothing else in WordPress needs touching. Because `.htaccess` marks `index.html` as no-cache,
changes show up immediately; if you edited `js/` or `data/`, hard-refresh once
(**Ctrl/⌘ + Shift + R**) to get past the 7-day asset cache.

---

## If you'd rather not touch the server

A free static host on a subdomain is the alternative: push the repo to GitHub, connect it to
**Cloudflare Pages** or **Netlify**, and point `map.yoursite.com` at it with one CNAME record. You
then iframe `https://map.yoursite.com/?embed=1` from your WordPress page and everything above still
applies. It's faster globally and takes all the map traffic off your WordPress server, at the cost
of one DNS record and one extra account. Say the word and I'll write those steps out.
