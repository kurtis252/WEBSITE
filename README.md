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

HTTPS is issued by GitHub only after DNS resolves to them, and can take up to
24 hours. Turn on **Enforce HTTPS** in Settings → Pages once it is offered;
until then the domain may warn on `https://`.

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

- Contact form posts to `https://formspree.io/f/YOUR_FORM_ID` — needs a real
  Formspree form ID before it will deliver anything.
- No client logos added yet, so that section is currently hidden.
- Instagram / LinkedIn / Vimeo profile links are placeholders.
- The Drone block is type-only; no stills yet.

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
