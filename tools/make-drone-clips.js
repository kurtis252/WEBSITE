#!/usr/bin/env node
// Turn drone footage into silent looping clips for the site.
//
//   node tools/make-drone-clips.js
//
// Drop any video into drone-source/ and run this. Each file becomes a muted
// loop in uploads/drone/ as both WebM and MP4, plus a poster frame, and the
// grid in index.html is rewritten to match.
//
// Two formats because one is not enough: VP9/WebM is smaller, but Safari's
// support for it is inconsistent and this site has already been bitten by
// iPhone-only faults. MP4/H.264 plays everywhere, so it sits second in the
// <video> as the fallback.
//
// Picking the moment: by default it takes CLIP_SECONDS from 25% into the
// file, which usually clears the take-off and settles into the shot. To choose
// the moment yourself, put it in the filename after an @, in seconds:
//
//   cromer-cliffs@14.mp4   ->  starts at 14s
//   cromer-cliffs@1:12.mp4 ->  starts at 1 minute 12
//
// Re-running skips anything already encoded unless the source is newer, so
// adding one clip does not re-encode the rest. Pass --force to redo everything.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "drone-source");
const OUT = path.join(ROOT, "uploads", "drone");
const PAGE = path.join(ROOT, "index.html");

const CLIP_SECONDS = 6;
const WIDTH = 960;            // grid cells are ~440px, so this stays sharp on retina
const FPS = 24;
const FORCE = process.argv.includes("--force");

const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|mts|webm)$/i;

function findFfmpeg(name) {
  const local = path.join(ROOT, "..", "ffmpeg", "bin", name + ".exe");
  if (fs.existsSync(local)) return local;
  try {
    execFileSync(name, ["-version"], { stdio: "ignore" });
    return name;
  } catch (e) {
    return null;
  }
}

const FFMPEG = findFfmpeg("ffmpeg");
const FFPROBE = findFfmpeg("ffprobe");

if (!FFMPEG) {
  console.error("\n  ffmpeg not found. Expected it on PATH or at ..\\ffmpeg\\bin\\ffmpeg.exe\n");
  process.exit(1);
}

function run(bin, args) {
  return execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
}

function duration(file) {
  if (!FFPROBE) return null;
  try {
    const out = run(FFPROBE, [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", file
    ]);
    const d = parseFloat(out.trim());
    return isFinite(d) ? d : null;
  } catch (e) {
    return null;
  }
}

// Drone footage comes in both landscape and 9:16, so each clip carries its own
// shape through to the page rather than being cropped into a common one.
function dimensions(file) {
  if (!FFPROBE) return null;
  try {
    const out = run(FFPROBE, [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,side_data_list",
      "-of", "default=noprint_wrappers=1", file
    ]);
    const w = /width=(\d+)/.exec(out), h = /height=(\d+)/.exec(out);
    if (!w || !h) return null;
    let W = +w[1], H = +h[1];
    // A phone or gimbal may record landscape with a rotation flag; respect it.
    const rot = /rotation=(-?\d+)/.exec(out);
    if (rot && Math.abs(+rot[1]) % 180 === 90) { const t = W; W = H; H = t; }
    return { w: W, h: H };
  } catch (e) {
    return null;
  }
}

// "14" or "1:12" -> seconds
function parseStamp(s) {
  const parts = String(s).split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

function slugify(s) {
  return s.toLowerCase().replace(/@.*$/, "").replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "clip";
}

function titleFrom(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function encode(src, slug, startAt) {
  // Fit inside a WIDTH square rather than forcing a width, so a 9:16 clip comes
  // out 540x960 instead of 960x1706 -- same visual size on the page, a third of
  // the pixels. The second scale keeps both dimensions even, which H.264 needs.
  const fit = `scale='min(${WIDTH},iw)':'min(${WIDTH},ih)':force_original_aspect_ratio=decrease,` +
              `scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=${FPS}`;
  const common = [
    "-ss", String(startAt), "-t", String(CLIP_SECONDS), "-i", src,
    "-an",                                     // silent: these are wallpaper, not films
    "-vf", fit,
  ];

  const webm = path.join(OUT, slug + ".webm");
  run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...common,
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
    "-row-mt", "1", "-deadline", "good", "-cpu-used", "3", webm]);

  const mp4 = path.join(OUT, slug + ".mp4");
  run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...common,
    "-c:v", "libx264", "-crf", "27", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);

  const jpg = path.join(OUT, slug + ".jpg");
  run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(startAt + 0.5), "-i", src, "-frames:v", "1",
    "-vf", `scale='min(${WIDTH},iw)':'min(${WIDTH},ih)':force_original_aspect_ratio=decrease`,
    "-q:v", "5", jpg]);

  return { webm, mp4, jpg };
}

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + "KB";

function main() {
  if (!fs.existsSync(SRC)) {
    fs.mkdirSync(SRC, { recursive: true });
    console.log("\n  Created drone-source/ — put video in it and run this again.\n");
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });

  const files = fs.readdirSync(SRC).filter((f) => VIDEO_EXT.test(f));
  if (!files.length) {
    // Still clear the grid: returning early here would leave the page pointing
    // at clips that are no longer there.
    writeGrid([]);
    console.log("\n  No video in drone-source/ — grid cleared.\n");
    return;
  }

  console.log("\n  " + files.length + " source file(s)\n");
  const clips = [];

  for (const f of files) {
    const src = path.join(SRC, f);
    const slug = slugify(f);
    const stamp = /@([0-9:.]+)\./.exec(f);
    const dur = duration(src);
    let startAt = stamp ? parseStamp(stamp[1]) : (dur ? dur * 0.25 : 0);
    if (!isFinite(startAt) || startAt < 0) startAt = 0;
    if (dur && startAt + CLIP_SECONDS > dur) startAt = Math.max(0, dur - CLIP_SECONDS);

    const webm = path.join(OUT, slug + ".webm");
    const fresh = fs.existsSync(webm) && fs.statSync(webm).mtimeMs > fs.statSync(src).mtimeMs;
    if (fresh && !FORCE) {
      console.log("  = " + slug + " (already done)");
    } else {
      process.stdout.write("  + " + slug + " from " + startAt.toFixed(1) + "s … ");
      try {
        const made = encode(src, slug, startAt);
        console.log("webm " + kb(made.webm) + ", mp4 " + kb(made.mp4));
      } catch (err) {
        console.log("FAILED");
        console.error("    " + String(err.stderr || err.message).split("\n")[0]);
        continue;
      }
    }
    const dim = dimensions(src) || { w: 16, h: 9 };
    clips.push({ slug, title: titleFrom(slug), w: dim.w, h: dim.h, portrait: dim.h > dim.w });
  }

  writeGrid(clips);
  console.log("\n  " + clips.length + " clip(s) written into index.html\n");
}

// Rewrite the grid between the markers in index.html.
function writeGrid(clips) {
  const START = "<!-- drone-clips:start -->";
  const END = "<!-- drone-clips:end -->";
  let html = fs.readFileSync(PAGE, "utf8");
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a === -1 || b === -1) {
    console.error("\n  Could not find the drone-clips markers in index.html — grid not updated.");
    return;
  }
  const nl = html.includes("\r\n") ? "\r\n" : "\n";
  // Each figure carries its own aspect ratio and sits in a masonry column, so
  // 16:9 and 9:16 can share the wall without either being cropped.
  const cell = (c) =>
    '        <figure data-drone-clip="1"' + (c.portrait ? ' data-portrait="1"' : '') +
    ' style="position: relative; margin: 0 0 clamp(12px, 1.6vw, 18px); aspect-ratio: ' + c.w + ' / ' + c.h +
    '; border-radius: 16px; overflow: hidden; background: oklch(0.2 0.09 264); break-inside: avoid; -webkit-column-break-inside: avoid;">' + nl +
    '          <video muted loop playsinline preload="none" poster="uploads/drone/' + c.slug + '.jpg" aria-label="' + c.title + '" style="width: 100%; height: 100%; object-fit: cover; display: block;">' + nl +
    '            <source src="uploads/drone/' + c.slug + '.webm" type="video/webm" />' + nl +
    '            <source src="uploads/drone/' + c.slug + '.mp4" type="video/mp4" />' + nl +
    '          </video>' + nl +
    '        </figure>';
  const body = clips.length
    ? nl + clips.map(cell).join(nl) + nl + "      "
    : nl + "      ";
  fs.writeFileSync(PAGE, html.slice(0, a + START.length) + body + html.slice(b));
}

main();
