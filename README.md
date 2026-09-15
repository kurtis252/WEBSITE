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

## Known gaps

- Contact form posts to `https://formspree.io/f/YOUR_FORM_ID` — needs a real
  Formspree form ID before it will deliver anything.
- The four "loop" slots are empty placeholders awaiting GIFs.
- Instagram / LinkedIn / Vimeo profile links are placeholders.
- The Drone block is type-only; no stills yet.
