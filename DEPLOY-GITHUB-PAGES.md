# Hosting the map on GitHub Pages, under your own domain

Free, fast, global CDN, automatic HTTPS, and every `git push` redeploys it. Your WordPress server
never serves the map or its tiles.

---

## ⚠️ Read this first

**Your apex domain (`yoursite.com`) must keep pointing at your WordPress host.**

Most GitHub Pages tutorials tell you to add four `A` records pointing `yoursite.com` at GitHub's IP
addresses. If you do that, **your WordPress site goes offline.** Those guides assume GitHub Pages
*is* the whole website. Yours isn't.

So the map goes on a **subdomain**:

```
yoursite.com          →  your WordPress host      (untouched)
www.yoursite.com      →  your WordPress host      (untouched)
map.yoursite.com      →  GitHub Pages             (new — one CNAME record)
```

You add exactly **one** DNS record. Nothing existing gets edited or deleted. If something goes
wrong, delete that one record and you're back where you started — your WordPress site is never at
risk at any point.

---

## Step 1 — Push the repo to GitHub

Create a new repository at <https://github.com/new>. Name it `holy-land-3d`. **Public** — private
repos need a paid plan to use Pages.

Then, from inside the map folder:

```bash
git init
git add .
git commit -m "Holy Land 3D"
git branch -M main
git remote add origin https://github.com/YOURNAME/holy-land-3d.git
git push -u origin main
```

Replace `YOURNAME` with your GitHub username throughout this guide.

## Step 2 — Turn on Pages

Repo → **Settings** → **Pages** → under *Build and deployment*, set **Source: GitHub Actions**.

That's all — the workflow is already in the repo at `.github/workflows/pages.yml`. Go to the
**Actions** tab and you'll see it running. It runs the test suite first and refuses to deploy if
anything fails.

When it goes green, your map is live at:

```
https://YOURNAME.github.io/holy-land-3d/
```

**Open it and confirm it works before touching any DNS.** If it's broken here, DNS won't fix it.

## Step 3 — Choose your subdomain and commit a CNAME file

`map.yoursite.com` is the obvious choice. `bible-map`, `atlas`, or `holyland` work equally well —
just use the same name consistently from here on.

Create a file called exactly `CNAME` (capitals, no extension) in the repo root, containing one
line:

```
map.yoursite.com
```

There's a `CNAME.example` in the repo you can copy:

```bash
cp CNAME.example CNAME
# edit it to your actual subdomain, then:
git add CNAME && git commit -m "Custom domain" && git push
```

> **Why this file matters.** When you deploy via GitHub Actions (as you are), the Settings UI does
> *not* commit a CNAME file for you — that only happens with branch-based deploys. Without it, your
> custom domain setting gets wiped on the next deploy and the site reverts to `github.io`. This is
> the single most common way this setup breaks.
>
> If you'd rather not commit the file, the workflow also reads a repository variable: **Settings →
> Secrets and variables → Actions → Variables → New variable**, name `CUSTOM_DOMAIN`, value
> `map.yoursite.com`. The variable takes precedence over the file.

## Step 4 — Add the DNS record

### First, find out who actually runs your DNS

It's whoever your **nameservers** point to — which is often *not* where you bought the domain.
Check at <https://who.is> (search your domain, look at "Name Servers"), or run:

```bash
nslookup -type=NS yoursite.com
```

| Nameservers look like | Add the record here |
|---|---|
| `ns1.cloudflare.com` | Cloudflare dashboard → DNS |
| `ns1.siteground.net`, `ns1.bluehost.com`, `ns.hostinger.com`… | Your **web host's** control panel (cPanel → Zone Editor) |
| `ns1.domains.google`, `dns1.registrar-servers.com`, `ns01.domaincontrol.com` | Your **registrar** (Google Domains/Squarespace, Namecheap, GoDaddy) |

### Then add exactly this

| Field | Value |
|---|---|
| **Type** | `CNAME` |
| **Name** / Host | `map` &nbsp;*(just the word — most panels append the domain automatically)* |
| **Value** / Target / Points to | `YOURNAME.github.io` |
| **TTL** | Automatic, or 3600 |

Notes by provider:

- **Cloudflare** — set **Proxy status to "DNS only" (grey cloud)**. With the orange cloud on,
  GitHub cannot complete the certificate challenge and HTTPS will never turn on. You can switch it
  to proxied later once the cert is issued, but there is no real benefit — GitHub Pages already
  runs on a CDN.
- **Namecheap** — Advanced DNS → Add New Record → CNAME Record. Host `map`, Value
  `YOURNAME.github.io.` (Namecheap wants the trailing dot).
- **GoDaddy** — DNS → Records → Add → CNAME. Name `map`, Value `YOURNAME.github.io`.
- **cPanel Zone Editor** — Add Record → CNAME. Name `map.yoursite.com.`, Record `YOURNAME.github.io.`

**Do not** create a CNAME on `@` or the root. Do not touch existing `A`, `MX`, or `TXT` records —
`MX` is your email.

## Step 5 — Tell GitHub about the domain

Repo → **Settings** → **Pages** → *Custom domain* → enter `map.yoursite.com` → **Save**.

GitHub runs a DNS check. It usually passes within a few minutes; occasionally DNS takes a couple of
hours to propagate. Check progress yourself:

```bash
nslookup map.yoursite.com
# should resolve via YOURNAME.github.io
```

Once the check passes, wait for the certificate (usually minutes, sometimes up to 24h), then tick
**Enforce HTTPS**. The checkbox is greyed out until the cert is issued — that's normal, not an
error.

Optionally, **Verify domain** on the same page adds a TXT record that stops anyone else from ever
claiming your subdomain on GitHub. Nice to have, not required.

Now `https://map.yoursite.com/` serves the map.

## Step 6 — Embed it in WordPress

Same as before, with one attribute pointing at the new host:

```
[holy_land_map path="https://map.yoursite.com/"]
```

Everything else still works:

```
[holy_land_map path="https://map.yoursite.com/" view="galilee" era="gospels"]
[holy_land_map path="https://map.yoursite.com/" site="capernaum" height="600px"]
```

To avoid repeating the URL, open `wordpress/holy-land-map.php` and change one line near the top:

```php
define( 'HL3D_DEFAULT_PATH', 'https://map.yoursite.com/' );
```

Then plain `[holy_land_map]` works everywhere.

The iframe is now cross-origin, which changes nothing about how it behaves — cooperative gestures,
fullscreen, deep links and the "Full map" button all work identically. The one difference is that
`X-Frame-Options` no longer applies (GitHub Pages doesn't send it), so the security-plugin failure
mode from the same-server setup simply can't happen here.

---

## Updating the site

```bash
# edit data/data.js to add or fix sites, or shared/* to change the UI
git add -A && git commit -m "Add Ramoth Gilead" && git push
```

Live in about a minute. The workflow simply publishes the folder as-is —
there is no build step, so what you commit is exactly what ships.

---

## Troubleshooting

**"Domain does not resolve to the GitHub Pages server."**
DNS hasn't propagated, or the record is wrong. Check `nslookup map.yoursite.com`. The most common
mistakes are typing the full `map.yoursite.com` into a Host field that already appends the domain
(giving `map.yoursite.com.yoursite.com`), and using an `A` record instead of `CNAME`.

**Custom domain keeps resetting to blank after a deploy.**
You have no `CNAME` file in the repo. See step 3 — this is the classic Actions-deploy gotcha.

**"Enforce HTTPS" stays greyed out for more than a day.**
Almost always Cloudflare's orange cloud. Set the record to DNS only, then in Pages settings remove
the custom domain, save, re-add it, and save again to retrigger the certificate request.

**Site loads but every asset 404s.**
Missing `.nojekyll` (it's already in this repo — check it actually got committed; files starting
with a dot are easy to miss). Jekyll ignores some paths without it.

**404 at `https://YOURNAME.github.io/holy-land-3d/` too.**
Pages source isn't set to GitHub Actions, or the workflow failed. Check the Actions tab for a red
run and read the log.

**Map works but WordPress went down.**
You added `A` records to the apex. Delete them and restore the originals — your host's support can
tell you the correct IP in about a minute. This is why step 4 says to add one record and touch
nothing else.

---

## Which approach should you actually use?

|  | Same server (`/holy-land-map/`) | GitHub Pages (`map.yoursite.com`) |
|---|---|---|
| Setup | Upload a folder, ~15 min | Push + one DNS record, ~20 min |
| DNS changes | None | One CNAME |
| Updating | Re-upload files by FTP | `git push` |
| Speed | Your host's single server | Global CDN |
| Load on your WP server | Some | None |
| Version history / rollback | No | Yes |
| Risk to WordPress | None | None, if you only add the subdomain |
| Breaks if you change WP host | Yes, must re-upload | No |

Given the map is already a git repo with a passing test suite, GitHub Pages is the better
long-term home — you get free CDN hosting, and the tests gate every deploy. The same-server route
is the better choice if you want zero DNS involvement or your domain's DNS is managed by someone
else.

**You can also do both.** They don't conflict. Run the same-server copy today, set up Pages when
you have time, and switch the shortcode's `path` when you're ready.
