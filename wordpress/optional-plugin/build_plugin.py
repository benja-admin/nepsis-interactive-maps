#!/usr/bin/env python3
"""
Packages the map + shortcode into holy-land-map.zip, ready for
WordPress admin -> Plugins -> Add New -> Upload Plugin.

    python3 build_data.py     # first, so data/ is current
    python3 build_plugin.py

Produces:

    holy-land-map.zip
      holy-land-map/
        holy-land-map.php     the plugin
        readme.txt
        index.php             directory-listing guard
        map/                  the whole static map
          index.html, .htaccess, css/, js/, data/
"""

import os, re, shutil, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SLUG = "holy-land-map"
OUT_ZIP = os.path.join(HERE, SLUG + ".zip")
STAGE = os.path.join(HERE, ".build", SLUG)

# Everything the browser needs, and nothing else.
MAP_FILES = ["index.html", ".htaccess"]
MAP_DIRS = ["css", "js", "data"]

README_TXT = """=== Nepsis Ministries Holy Land Map ===
Contributors: nepsisministries
Tags: bible, map, 3d, terrain, bible study, geography
Requires at least: 5.0
Tested up to: 6.7
Requires PHP: 7.0
Stable tag: {version}
License: MIT
License URI: https://opensource.org/licenses/MIT

An interactive 3D terrain map of the Bible lands: 150 sites from Genesis to
Revelation, filterable by era, with scripture references.

== Description ==

Flat Bible maps hide the thing that shaped the whole narrative: the land is
steep, narrow and split by a rift valley. This plugin embeds a real 3D terrain
map so your readers can see it.

* 150 sites from Ur to Rome, each with a short historical note and linked
  scripture references
* A timeline filter covering nine biblical eras, from the Patriarchs to the
  early church
* Real global elevation data - tilt and orbit the landscape freely
* Live elevation readout, plus a tool that draws a cross-section between any
  points you click
* Four basemaps: satellite, shaded relief, topographic and a parchment atlas
  look
* Search by biblical name, modern name or verse

No API keys, no accounts, no tracking, and no external service to sign up for.

== Installation ==

1. Plugins -> Add New -> Upload Plugin -> choose `{slug}.zip`.
2. Install Now, then Activate.
3. Add `[holy_land_map]` to any page or post.

== Usage ==

`[holy_land_map]`
`[holy_land_map height="600px"]`
`[holy_land_map view="galilee" era="gospels"]`
`[holy_land_map site="capernaum" fullwidth="yes"]`
`[holy_land_map view="rift" basemap="relief" exag="3"]`

Attributes: `height`, `minheight`, `view`, `era`, `site`, `basemap`, `exag`,
`caption`, `fullwidth`, `class`, `path`.

== Frequently Asked Questions ==

= The map area is blank or dark =

A security plugin is almost certainly sending `X-Frame-Options: DENY` for the
whole site. The `.htaccess` inside the plugin's `map/` folder overrides it back
to `SAMEORIGIN`. On Nginx hosts, ask support to set
`add_header X-Frame-Options SAMEORIGIN;` for the plugin directory.

= Scrolling over the map hijacks my page =

It should not. Inside a page the map requires Ctrl (or Cmd) + scroll to zoom,
and two fingers to pan on touch, so ordinary scrolling moves your page.

= Can I host the map somewhere else? =

Yes. `[holy_land_map path="https://map.yoursite.com/"]`, or filter
`hl3d_map_root`.

== Changelog ==

= {version} =
* First release.
"""

INDEX_PHP = "<?php\n// Silence is golden.\n"


def plugin_version(php_path):
    src = open(php_path, encoding="utf-8").read()
    m = re.search(r"^\s*\*\s*Version:\s*([0-9][0-9.]*)", src, re.M)
    if not m:
        sys.exit("ERROR: could not read Version from the plugin header")
    d = re.search(r"define\(\s*'HL3D_VERSION',\s*'([^']+)'", src)
    if d and d.group(1) != m.group(1):
        sys.exit(
            "ERROR: header Version (%s) and HL3D_VERSION (%s) disagree"
            % (m.group(1), d.group(1))
        )
    return m.group(1)


def main():
    php_src = os.path.join(HERE, "wordpress", SLUG + ".php")
    if not os.path.exists(php_src):
        sys.exit("ERROR: missing " + php_src)

    version = plugin_version(php_src)

    missing = [
        f
        for f in MAP_FILES + MAP_DIRS
        if not os.path.exists(os.path.join(HERE, f))
    ]
    if missing:
        sys.exit("ERROR: missing map assets: " + ", ".join(missing))

    if not os.path.exists(os.path.join(HERE, "data", "data.js")):
        sys.exit("ERROR: data/data.js missing - run `python3 build_data.py` first")

    # --- stage -------------------------------------------------------
    if os.path.exists(os.path.dirname(STAGE)):
        shutil.rmtree(os.path.dirname(STAGE))
    os.makedirs(os.path.join(STAGE, "map"))

    shutil.copy2(php_src, os.path.join(STAGE, SLUG + ".php"))
    with open(os.path.join(STAGE, "readme.txt"), "w", encoding="utf-8") as f:
        f.write(README_TXT.format(version=version, slug=SLUG))
    with open(os.path.join(STAGE, "index.php"), "w", encoding="utf-8") as f:
        f.write(INDEX_PHP)

    for name in MAP_FILES:
        shutil.copy2(os.path.join(HERE, name), os.path.join(STAGE, "map", name))
    for name in MAP_DIRS:
        shutil.copytree(
            os.path.join(HERE, name),
            os.path.join(STAGE, "map", name),
            ignore=shutil.ignore_patterns("*.pyc", "__pycache__", ".DS_Store"),
        )

    # --- zip ---------------------------------------------------------
    if os.path.exists(OUT_ZIP):
        os.remove(OUT_ZIP)

    count = 0
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for root, dirs, files in os.walk(STAGE):
            dirs.sort()
            for fn in sorted(files):
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, os.path.dirname(STAGE))
                z.write(full, rel.replace(os.sep, "/"))
                count += 1

    shutil.rmtree(os.path.dirname(STAGE))

    size = os.path.getsize(OUT_ZIP)
    print("built  : %s.zip" % SLUG)
    print("version: %s" % version)
    print("files  : %d" % count)
    print("size   : %.0f KB" % (size / 1024.0))


if __name__ == "__main__":
    main()
