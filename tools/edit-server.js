#!/usr/bin/env node
// Local copy editor for index.html.
//
//   node tools/edit-server.js
//
// Opens a small UI on http://localhost:4321 listing every piece of copy on the
// page. Edit, save, optionally publish.
//
// Note: Pages serves the whole branch, so these two files are reachable on the
// live site as static text. They do nothing there -- the editor only works
// against a local server that can write to disk -- but do not put anything
// private in them.
//
// Strings are addressed by their exact text plus which occurrence they are, so
// index.html needs no editing markers and this keeps working after the page is
// re-exported from Claude Design.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "index.html");
const PORT = 4321;

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

// Only these three need escaping back; leave everything else as typed so the
// copy stays readable in the source.
const encode = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Regions we must not treat as copy: inline CSS, and the whole component script.
function maskedRanges(html) {
  const out = [];
  const add = (re) => {
    let m;
    while ((m = re.exec(html))) out.push([m.index, m.index + m[0].length]);
  };
  add(/<style[\s\S]*?<\/style>/g);
  add(/<script[\s\S]*?<\/script>/g);
  return out;
}

function extract(html) {
  const masked = maskedRanges(html);
  const inMasked = (i) => masked.some(([a, b]) => i >= a && i < b);

  const items = [];
  const seen = new Map();
  const re = />([^<>{}]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const start = m.index + 1;
    if (inMasked(start)) continue;
    const raw = m[1];
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length < 2) continue;
    if (/^[\s|·—–-]+$/.test(text)) continue;

    // Which section is this in, and what element holds it?
    const before = html.slice(0, start);
    const sec = before.lastIndexOf("data-screen-label=");
    let section = "Page";
    if (sec !== -1) {
      const q = /data-screen-label="([^"]*)"/.exec(html.slice(sec, sec + 80));
      if (q) section = q[1];
    }
    // `before` ends on the ">" that opened this text node; drop it so the
    // owning tag is what sits at the end of the string.
    const tagM = /<([a-zA-Z][\w-]*)[^<>]*$/.exec(before.replace(/>$/, ""));
    const tag = tagM ? tagM[1].toLowerCase() : "?";

    // Match on the decoded text: that is what the rendered page shows, and the
    // editor pairs these up with what it finds in the DOM. Keying on the raw
    // source form means anything containing an entity ("Loops &amp; experiments")
    // never matches its own element.
    const key = decode(text);
    const nth = (seen.get(key) || 0);
    seen.set(key, nth + 1);

    items.push({ id: items.length, text: decode(text), section, tag, key, nth, start, end: start + raw.length, raw });
  }
  return items;
}

function applyEdits(html, edits) {
  const items = extract(html);
  const byKey = new Map();
  items.forEach((it) => byKey.set(it.key + "" + it.nth, it));

  const patches = [];
  for (const e of edits) {
    const it = byKey.get(e.key + "" + e.nth);
    if (!it) continue;
    const next = encode(String(e.text));
    if (next === it.raw.trim()) continue;
    // Keep whatever leading/trailing whitespace the source had.
    const lead = /^\s*/.exec(it.raw)[0];
    const tail = /\s*$/.exec(it.raw)[0];
    patches.push({ start: it.start, end: it.end, value: lead + next + tail });
  }
  // Splice from the end so earlier offsets stay valid.
  patches.sort((a, b) => b.start - a.start);
  let out = html;
  for (const p of patches) out = out.slice(0, p.start) + p.value + out.slice(p.end);
  return { html: out, changed: patches.length };
}

// ---- client logos -------------------------------------------------------
// The marquee track in index.html is the single source of truth. Each logo is
// one flat <img>, so the track's contents can be rewritten without a parser.

const LOGO_DIR = path.join(ROOT, "uploads", "logos");
const TRACK = /(<div data-logos="1"[^>]*>)([\s\S]*?)(<\/div>)/;

const IMG_TYPES = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
  "image/svg+xml": ".svg", "image/gif": ".gif"
};

const BASE_H = "clamp(46px, 5.6vw, 64px)";
const BASE_W = 200;

function logoStyle(scale) {
  // Knockout white, sitting straight on the page with no tile. Assumes the
  // file is already a white silhouette on transparency -- the editor's
  // "Make white" button converts anything that is not.
  //
  // Scale multiplies the shared base height rather than replacing it, so a
  // scaled logo still shrinks with the viewport like every other one.
  const s = Number(scale) > 0 ? Number(scale) : 1;
  const h = s === 1 ? BASE_H : "calc(" + BASE_H + " * " + s + ")";
  const w = Math.round(BASE_W * s);
  return "height: " + h + "; width: auto; max-width: " + w + "px; "
       + "object-fit: contain; display: block; flex: 0 0 auto; opacity: 0.82;";
}

function readLogos(html) {
  const m = TRACK.exec(html);
  if (!m) return [];
  const out = [];
  const re = /<img\s[^>]*>/g;
  let img;
  while ((img = re.exec(m[2]))) {
    const src = /src="([^"]*)"/.exec(img[0]);
    const alt = /alt="([^"]*)"/.exec(img[0]);
    const sc = /data-scale="([^"]*)"/.exec(img[0]);
    if (src) out.push({
      src: src[1],
      alt: alt ? decode(alt[1]) : "",
      scale: sc ? (Number(sc[1]) || 1) : 1
    });
  }
  return out;
}

function writeLogos(html, logos) {
  const m = TRACK.exec(html);
  if (!m) throw new Error("logo track not found in index.html");
  const body = logos.length
    ? "\n" + logos.map((l) =>
        // Deliberately not lazy: the cloned half of the marquee starts off
        // screen, so lazy tiles would scroll in blank and fill in late.
        '        <img src="' + l.src + '" alt="' + encode(l.alt || "") + '"' +
        (Number(l.scale) > 0 && Number(l.scale) !== 1 ? ' data-scale="' + Number(l.scale) + '"' : "") +
        ' style="' + logoStyle(l.scale) + '" />').join("\n") + "\n      "
    : "\n      ";
  return html.slice(0, m.index) + m[1] + body + m[3] + html.slice(m.index + m[0].length);
}

function git(args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd: ROOT }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: (stdout || "") + (stderr || "") })
    );
  });
}

const send = (res, code, body, type) => {
  res.writeHead(code, {
    "Content-Type": type || "application/json; charset=utf-8",
    // Never cache anything from this tool. It is a local editor whose whole
    // job is to show the current state of files on disk, and a cached
    // editor.html silently keeps running an old build of the UI -- which is
    // exactly how a fixed publish button stayed broken.
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/" || url === "/index.html") {
    return send(res, 200, fs.readFileSync(path.join(__dirname, "editor.html")), "text/html; charset=utf-8");
  }

  // The live page, served from this same origin so the editor can reach into
  // the iframe and make its text editable.
  if (url === "/site" || url.startsWith("/site/")) {
    let rel = url.slice("/site".length) || "/";
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.resolve(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return send(res, 403, "forbidden", "text/plain");
    const TYPES = {
      ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
      ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon"
    };
    return fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, "not found", "text/plain");
      send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    });
  }

  if (url === "/api/copy") {
    const items = extract(fs.readFileSync(PAGE, "utf8"));
    return send(res, 200, JSON.stringify(
      items.map(({ id, text, section, tag, key, nth }) => ({ id, text, section, tag, key, nth }))
    ));
  }

  if (url === "/api/logos" && req.method === "GET") {
    return send(res, 200, JSON.stringify(readLogos(fs.readFileSync(PAGE, "utf8"))));
  }

  if (url === "/api/logos" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    return req.on("end", () => {
      try {
        const msg = JSON.parse(body);
        const html = fs.readFileSync(PAGE, "utf8");
        let logos = readLogos(html);

        if (msg.op === "add") {
          const ext = IMG_TYPES[msg.mime];
          if (!ext) throw new Error("Unsupported image type: " + msg.mime);
          fs.mkdirSync(LOGO_DIR, { recursive: true });
          const safe = String(msg.name || "logo").toLowerCase()
            .replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "").slice(0, 40) || "logo";
          let file = safe + ext, i = 2;
          while (fs.existsSync(path.join(LOGO_DIR, file))) file = safe + "-" + i++ + ext;
          fs.writeFileSync(path.join(LOGO_DIR, file), Buffer.from(msg.data, "base64"));
          logos.push({ src: "uploads/logos/" + file, alt: msg.alt || safe.replace(/-/g, " ") });
        } else if (msg.op === "remove") {
          const gone = logos[msg.index];
          logos = logos.filter((_, i) => i !== msg.index);
          // Only delete the file if nothing else still points at it.
          if (gone && !logos.some((l) => l.src === gone.src)) {
            const f = path.resolve(path.join(ROOT, gone.src));
            if (f.startsWith(LOGO_DIR) && fs.existsSync(f)) fs.unlinkSync(f);
          }
        } else if (msg.op === "move") {
          const [item] = logos.splice(msg.index, 1);
          logos.splice(Math.max(0, Math.min(logos.length, msg.to)), 0, item);
        } else if (msg.op === "alt") {
          if (logos[msg.index]) logos[msg.index].alt = msg.alt;
        } else if (msg.op === "scale") {
          const s = Number(msg.scale);
          if (!(s > 0)) throw new Error("scale must be a positive number");
          if (logos[msg.index]) logos[msg.index].scale = Math.min(4, Math.max(0.25, s));
        } else if (msg.op === "replace") {
          // A converted copy of an existing logo, rendered in the browser.
          const cur = logos[msg.index];
          if (!cur) throw new Error("no logo at index " + msg.index);
          fs.mkdirSync(LOGO_DIR, { recursive: true });
          const suffix = /^[a-z-]{0,12}$/.test(msg.suffix || "") ? (msg.suffix || "-white") : "-white";
          const stem = path.basename(cur.src).replace(/\.[a-z0-9]+$/i, "")
            .replace(/-white(-\d+)?$/, "").replace(/-small(-\d+)?$/, "");
          let file = stem + suffix + ".png", i = 2;
          while (fs.existsSync(path.join(LOGO_DIR, file))) file = stem + suffix + "-" + i++ + ".png";
          fs.writeFileSync(path.join(LOGO_DIR, file), Buffer.from(msg.data, "base64"));
          const old = cur.src;
          cur.src = "uploads/logos/" + file;
          if (!logos.some((l) => l.src === old)) {
            const f = path.resolve(path.join(ROOT, old));
            if (f.startsWith(LOGO_DIR) && fs.existsSync(f)) fs.unlinkSync(f);
          }
        } else {
          throw new Error("unknown op");
        }

        fs.writeFileSync(PAGE + ".bak", html);
        fs.writeFileSync(PAGE, writeLogos(html, logos));
        send(res, 200, JSON.stringify({ logos }));
      } catch (err) {
        send(res, 500, JSON.stringify({ error: String(err && err.message || err) }));
      }
    });
  }

  if (url === "/api/save" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    return req.on("end", async () => {
      try {
        const { edits, publish } = JSON.parse(body);
        const html = fs.readFileSync(PAGE, "utf8");
        const { html: next, changed } = applyEdits(html, edits);
        if (changed) {
          fs.writeFileSync(PAGE + ".bak", html);
          fs.writeFileSync(PAGE, next);
        }
        let published = null;
        if (publish) {
          // Stage the images too, not just the page. Logo files live in
          // uploads/logos and are new (or deleted) files rather than edits to
          // a tracked one, so "add index.html" left them behind entirely and
          // the published page pointed at files that were never uploaded.
          const a = await git(["add", "-A", "--", "index.html", "uploads"]);
          const c = await git(["commit", "-m", "Content edits from the local editor"]);
          const p = await git(["push", "origin", "main"]);
          const log = [a.out, c.out, p.out].join("\n").trim();
          const nothing = /nothing to commit/i.test(c.out);
          published = { ok: a.ok && (c.ok || nothing) && p.ok, nothing, log };
        }
        send(res, 200, JSON.stringify({ changed, published }));
      } catch (err) {
        send(res, 500, JSON.stringify({ error: String(err && err.message || err) }));
      }
    });
  }

  send(res, 404, "not found", "text/plain");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("\n  Port " + PORT + " is already in use.");
    console.error("  The editor is probably already running -- try opening");
    console.error("  http://localhost:" + PORT + " first.\n");
    console.error("  If not, close whatever is using it, or on Windows:");
    console.error("    powershell \"Get-Process node | Stop-Process -Force\"\n");
  } else {
    console.error("\n  Could not start: " + err.message + "\n");
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log("\n  Editor:  http://localhost:" + PORT);
  console.log("  Editing: " + PAGE);
  console.log("\n  Leave this window open while you work. Ctrl+C to stop.\n");
});
