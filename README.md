# kurtisbarnard.co.uk

Portfolio site for Kurtis Barnard — motion design, videography, drone and photography.
Static one-page site, no build step, served by GitHub Pages.

## Files

```
index.html                 the page (markup + all styles inline)
support.js                 runtime: component bindings, scroll reveals, hero tilt
image-slot.js              drag-and-drop image slots (awards / loops)
.image-slots.state.json    saved slot images, as data URIs
.nojekyll                  stops Pages hiding dotfiles like the slot state
uploads/                   headshot.jpg + still-01…19.jpg
```

`index.html` uses `{{ name }}` bindings that `support.js` fills in at load —
the Vimeo embeds and the contact form action come from there, near the bottom
of the file. The literal `{{ … }}` you see in the raw `src` attributes is
expected; it is replaced before the iframe is used.

## Editing the copy

```bash
node tools/edit-server.js
```

Then open http://localhost:4321. Every string on the page is listed, grouped by
section, with the element type beside it. Edit, then either **Save locally**
(writes `index.html`, leaving the commit to you) or **Save & publish** (writes,
commits and pushes, so it is live in about a minute). The previous version is
kept as `index.html.bak`, which is git-ignored.

Strings are matched by their exact text and which occurrence they are, so no
editing markers are needed in `index.html` and the tool survives a re-export
from Design. Repeated copy is handled: "Videography" appears as both a heading
and a dropdown option, and they edit independently.

It only rewrites text between tags. Attributes are never touched, so links,
image paths, the Vimeo ids and the form action are out of reach here — those
are edited in `index.html` directly, or ask and I will.

## Local preview

Any static server from the repo root, e.g.

```bash
npx --yes serve .
```

The hero tilt effect needs HTTPS or localhost, so it will not work if you open
`index.html` as a `file://` URL.

## Deploying

Pages serves `main` at the repo root. Push to `main` and the site rebuilds:

```bash
git add -A && git commit -m "your change" && git push
```

Give it 30–60 seconds. Build status is under the repo's **Actions** tab.

## Custom domain

Set to `kurtisbarnard.co.uk`. **Do not delete the `CNAME` file** in the repo
root — removing it unsets the custom domain and the site drops back to the
github.io address.

`kurtis252.github.io/WEBSITE/` now 301s to the custom domain, so it is no
longer usable as a preview. Preview locally with `Edit site.bat` instead.

DNS is managed at names.co.uk (published via the phase8.net nameservers).
The apex needs GitHub's four A records:

```
185.199.108.153   185.199.109.153   185.199.110.153   185.199.111.153
```

and `www` a CNAME to `kurtis252.github.io.` — replacing the old Fastly
records (`151.101.0.119`, `151.101.64.119`) that pointed at Adobe Portfolio.

### HTTPS is not working yet

As of 2026-09-16 21:48 UTC — 24h40m after the domain was set — GitHub had still
not issued a certificate. `https_certificate.state` is null and `https://`
refuses the connection on both apex and www. Plain `http://` works and serves
the site.

Everything on our side checks out, so there is nothing to fix here:

- all four apex A records correct, on both Google and Cloudflare resolvers
- `www` CNAME resolving to `kurtis252.github.io`
- no CAA record, so Let's Encrypt is not blocked
- `/.well-known/acme-challenge/` reachable over http, answered by GitHub.com

Re-asserting the domain through the API was tried and changed nothing. The
remaining remedy is to remove the custom domain in **Settings → Pages** and add
it straight back, which forces a fresh request. That costs a minute or two
where the domain returns 404 while it is unset.

Note the API rejects a PUT carrying `https_enforced` while no certificate
exists, so enforcement can only be turned on after the certificate appears.

## Two sources of truth — read before re-exporting from Design

The page is authored in a Claude Design project and exported to this repo. But
the blob motion was rewritten *here*, in Git, and Design knows nothing about it.
A fresh export will therefore undo all of it: the tilt handling, pick-up-and-
throw, docking, and the lean physics.

The behaviour work lives in four commits on top of the last export, and the
same changes are kept as a single patch in `patches/blob-physics.patch`.
The last clean export is tagged `design-export-2026-09-15`.

To bring in a new export without losing the motion work:

```bash
git checkout -b design-import
# copy the new export's site/ contents over the repo root, then:
git add -A && git commit -m "Design export <date>"
git apply --3way patches/blob-physics.patch
```

Fix any conflicts, confirm the page still behaves, then merge to `main` and
tag the new export. If `git apply` cannot place a hunk, the four commits listed
by `git log design-export-2026-09-15..main` can be cherry-picked instead.

Longer term this is worth resolving properly: either the motion code moves back
into the Design project so Design is the single master, or the page stops being
regenerated from Design and this repo becomes the master. Replaying a patch
after every export works, but it is a standing tax.

## Known gaps

- No drone clips encoded yet, so the panel's clip grid hides itself. Put footage
  in `drone-source/` and run **Make drone clips.bat**.
- The drone panel's hero falls back to the videography reel. Set `droneReelId`
  once there is a dedicated aerial reel on Vimeo.
- Social buttons are hidden (`data-social` row) until the Instagram and LinkedIn
  profiles exist — they pointed at the sites' homepages.
- HTTPS certificate for the custom domain was still pending at the time of
  writing; **Enforce HTTPS** needs turning on once GitHub issues it.

## Drone clips

The Drone card opens a full-screen panel. The looping clips in it are built
from whatever is in `drone-source/` (git-ignored -- source footage does not
belong in the repo):

```bash
node tools/make-drone-clips.js
```

or double-click **Make drone clips.bat**. Each video becomes a silent 6-second
loop in `uploads/drone/` as both WebM and MP4, plus a poster frame, and the
grid in `index.html` is rewritten between the `drone-clips` markers.

By default it takes the clip from 25% into the file. To choose the moment,
put it in the filename after an @:

```
cromer-cliffs@14.mp4     starts at 14 seconds
cromer-cliffs@1:12.mp4   starts at 1 minute 12
```

Both 16:9 and 9:16 are handled: each clip keeps its own aspect ratio and the
grid is a masonry column layout, so portrait and landscape sit together without
either being cropped. Clips are fitted inside a 960px box, so a vertical clip
encodes at 540x960 rather than 960x1706.

Re-running skips anything already encoded unless the source is newer; pass
`--force` to redo everything. Emptying `drone-source/` clears the grid.

The panel hero is a Vimeo embed using the videography reel id unless a
`droneReelId` is set. Replacing the file behind that id on Vimeo updates the
site with no code change.

## Client logos

The "Companies I have worked with" band is a scrolling marquee fed from
`uploads/logos/`. Manage it in the editor (`node tools/edit-server.js`):
drop image files on the panel, rename them for alt text, reorder or remove.
Each change writes `index.html` immediately; use **Save & publish** to put it
live.

Logos are listed once in the markup and the second half of the marquee is
cloned at runtime, so adding a client is one line, not two.

With no logos the whole section is hidden, so it never ships as an empty band.

Each logo sits on a pale rounded tile. Client artwork arrives as dark
wordmarks, transparent PNGs and JPEGs with white backgrounds all mixed
together, and on this near-black page most of that would disappear without
one. SVG or transparent PNG look best.

Every row shows the file's weight and pixel size, so an oversized one is
visible before it goes live rather than after.

## Photography strips

The two scrolling bands under "Stills that stop the scroll" are managed the
same way, in the **Photography strips** panel:

- Drop or pick files into either band. Anything added is fitted to 640px
  tall, encoded as both JPEG and WebP, and stored as whichever came out
  smaller. The original is kept untouched if re-encoding would not help.
- `↑` `↓` reorder within a band, `⇅` sends a picture to the other band,
  `✕` removes it.
- `⤓` re-encodes one already in place, for the ones that predate the panel.
- Each row shows weight and pixel size; each band and the pair show a total.

New photographs land in `uploads/stills/`. The originals sit in `uploads/`
and are left where they are. A file is only deleted once nothing in the page
points at it, which is what keeps the headshot and the open-graph image safe.

Like the logos, each band is listed once and doubled at runtime so the -50%
loop seams; the copy is hidden from screen readers. On a phone
`mobileLayout` hides all but five of each half. Both of those assume the two
halves are equal, so nothing should ever write an odd number of children
into a band.

The top band is drawn taller than the bottom one (260px against 210px at the
widest), which is the only thing that distinguishes them.
