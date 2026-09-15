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

Not enabled yet. When ready: **Settings → Pages → Custom domain** →
`kurtisbarnard.co.uk`, which writes a `CNAME` file here. Then at the registrar
point the root at GitHub's four A records and `www` at `kurtis252.github.io.`
Keep the old host running until DNS resolves, and leave **Enforce HTTPS** on
once it is offered.

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
- The four "loop" slots are empty placeholders awaiting GIFs.
- Instagram / LinkedIn / Vimeo profile links are placeholders.
- The Drone block is type-only; no stills yet.
