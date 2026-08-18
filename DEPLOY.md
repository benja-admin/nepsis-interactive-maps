# Putting the map on your site

**WordPress plugin, full-page takeover.** Install the plugin, put `[nepsis_map]` on a page, and
that page *becomes* the map — edge to edge, with your theme's header, footer, sidebars and the
admin bar all out of the way. A back arrow in the map's toolbar returns visitors to wherever they
came from.

The takeover works by replacing the page template outright, not by hiding things with CSS. So
there is no theme wrapper left to fight with, and it behaves the same on every theme.

---

## Install

1. **Plugins → Add New Plugin → Upload Plugin** → choose **`nepsis-holy-land-map.zip`**.
2. **Install Now** → **Activate**.
3. **Pages → Add New.** Title it whatever you like ("Holy Land Map"). Add a **Shortcode** block
   containing:

   ```
   [nepsis_map]
   ```

4. **Publish**, then click **View Page**.

The map fills the window. Nothing else to upload — the map files travel inside the plugin.

### Link it from your menu

**Appearance → Menus** → add the page you just made. That's what the back arrow will return people
to.

---

## The back arrow

Top-left of the map toolbar. By default it does what the browser's back button does, so visitors
return to whatever page sent them.

```
[nepsis_map]                       back arrow uses browser history
[nepsis_map back="/resources/"]    always returns to a specific page
[nepsis_map back="no"]             no back arrow
```

If someone lands on the map directly — from a search result or a shared link — there is no history
to go back to, so the arrow returns them to your site's home page instead of stranding them.

Behind the scenes the map lives in an iframe, and `history.back()` called from inside a frame is
not dependable across browsers. So the map asks the page around it to do the going-back, and that
page acts on the real browser history. You don't have to do anything; it's just why it works.

---

## Shortcode options

```
[nepsis_map]                                   full page, whole Bible lands
[nepsis_map view="galilee" era="gospels"]      open on the lake, Gospel sites only
[nepsis_map site="capernaum"]                  open on a site with its panel showing
[nepsis_map view="rift" basemap="relief" exag="3"]
[nepsis_map back="/bible-study/"]
```

| Attribute | Values | Default |
|---|---|---|
| `fullpage` | `yes` / `no` — `no` embeds inline, keeping your header and footer | `yes` |
| `back` | `yes` / `no` / a URL or `/path` | `yes` |
| `view` | `all` `levant` `galilee` `jerusalem` `rift` `sinai` `aegean` | `levant` |
| `era` | `patriarchs` `exodus` `judges` `united` `divided` `exile` `intertest` `gospels` `acts` `all` | `all` |
| `site` | any site id — `capernaum`, `jerusalem`, `mount-sinai`, `megiddo`… | — |
| `basemap` | `satellite` `relief` `topo` `parchment` | `satellite` |
| `exag` | `0`–`6` | `2` |
| `height` / `minheight` / `caption` / `fullwidth` | inline mode only | — |

Site ids are the name lowercased with hyphens; the full list is in `data/sites.json`. Invalid
values fall back to defaults rather than breaking.

This makes the map reusable in teaching — a post on the feeding of the five thousand can open on
Tabgha, one on Elijah on Carmel:

```
[nepsis_map fullpage="no" height="520px" site="tabgha"]
```

### Inline instead of full page

```
[nepsis_map fullpage="no"]
[nepsis_map fullpage="no" height="600px" fullwidth="yes"]
```

Inline embeds switch on **cooperative gestures**: plain scrolling moves your page, zooming needs
**Ctrl** (or **⌘**) + scroll, and panning on a phone needs two fingers — so readers scrolling past
don't get trapped in the map. Full-page mode turns that off, because there's no page to scroll.

---

## Updating it later

The map's data lives in `data/data.js` (a plain `window.HL_DATA = { … }`
assignment); edit it directly to add or correct sites — no build step.
To change the shared look of all four studies, edit the files in
`shared/`.

Re-upload the changed files to your host, or re-zip and re-upload the
plugin in WordPress; it will offer to replace the existing plugin. Bump `Version:` and
`NEPSIS_MAP_VERSION` together in `plugin/nepsis-holy-land-map.php` to push past browser caches —
the build refuses to run if those two disagree.

---

## Troubleshooting

**The page still shows my header and footer.**
The takeover only fires on pages whose stored content contains the shortcode. Some page builders
(certain Elementor and Divi layouts) keep content outside `post_content`, where WordPress can't see
it. Add the shortcode in the normal block editor instead, or force it:
`add_filter( 'nepsis_map_do_takeover', '__return_true' );`

**A strip of theme styling still shows through.**
Rare, but a theme can inject markup before `wp_head`. For a completely bare document:
`add_filter( 'nepsis_map_use_wp_head', '__return_false' );`
That also disables analytics and SEO plugins on that page, so only use it if you need to.

**The back arrow does nothing.**
It messages the surrounding page, and browsers block that across origins. If you moved the map to
another domain with `path=`, give it an explicit destination instead: `[nepsis_map back="/"]`.

**The map area is blank or dark.**
A security plugin is sending `X-Frame-Options: DENY` site-wide. The `.htaccess` inside the plugin's
`map/` folder overrides it to `SAMEORIGIN`. On Nginx, ask your host to set
`add_header X-Frame-Options SAMEORIGIN;` for the plugin directory.

**Map loads but there are no place names.**
Label fonts come from `fonts.openmaptiles.org`. If a firewall or privacy plugin blocks it, markers
still work but labels vanish. Swap the `glyphs` URL in `js/config.js` for another PBF glyph host.

**Terrain looks completely flat.**
Elevation tiles come from `s3.amazonaws.com`. Open the console (F12) and look for blocked requests.

**Slow on mobile.**
Use `basemap="relief"` — the shaded-relief tiles are far lighter than satellite imagery and
arguably read the landform better anyway.

---

## Not using WordPress at all?

`nepsis-map-upload.zip` is still in the project: the same map as a plain folder you can drop into
`public_html/` and open at `yoursite.com/nepsis-map/`. Add `?back=1` to the URL if you want the
back arrow there too.
