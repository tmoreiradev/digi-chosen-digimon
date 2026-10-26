// NotSpriteCollab (NSS, nss.pmdcollab.org) art for the Digimon pack: 40x40 portraits and
// SpriteCollab-style overworld folders (AnimData.xml + one PNG per animation).
//
//   node scripts/nss.mjs import <folder>   copy what this game uses from a local NSS download
//                                          (portrait/<nss>/Normal.png, sprite/<nss>/…) into assets/
// make-digimon-data.mjs calls spriteTables() to turn assets/ into sprites.json + sprite-bounds.json.
// Credits: see CREDITS.md (portraits and sprites by NeroIntruder and the NSS contributors).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { SPECIES, NSS_NAMES } from "./digimon-species.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");

/** NSS folder (4 digits) per game species id, resolved by name through the download's index.csv. */
export function nssFolders(src) {
  const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
  const index = new Map();
  for (const line of fs.readFileSync(path.join(src, "index.csv"), "utf8").split(/\r?\n/).slice(1)) {
    const cols = line.split(",").map((c) => c.replace(/"/g, ""));
    // A name can have alternate forms (Black, Snow…) in any order: the row whose form is the name
    // itself is the main one; without it, the first row wins.
    if (!cols[0] || !cols[3]) continue;
    if (cols[1] === cols[0] || !index.has(norm(cols[0]))) index.set(norm(cols[0]), cols[3]);
  }
  const out = {};
  SPECIES.forEach(([key, name], i) => {
    const folder = index.get(norm(NSS_NAMES[key] ?? name));
    if (folder) out[i + 1] = folder;
  });
  return out;
}

/** Engine animation → SpriteCollab animation names, first one present wins. */
const ANIMS = { walk: ["Walk"], idle: ["Idle"], attack: ["Attack"], hurt: ["Hurt"], charge: ["Charge"], faint: ["Faint", "Laying", "Sleep"] };

/** Width, height and RGBA pixels of an 8-bit RGBA, non-interlaced PNG (what SpriteCollab ships). */
export function readPng(file) {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) throw new Error(`${file}: only 8-bit RGBA, non-interlaced PNGs are supported`);
  const idat = [];
  for (let o = 8; o < b.length; ) {
    const len = b.readUInt32BE(o);
    const type = b.toString("ascii", o + 4, o + 8);
    if (type === "IDAT") idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const ul = y > 0 && x >= 4 ? px[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - ul;
        const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}

/** Animation table of an AnimData.xml: name → { fw, fh, d[], copyOf }. */
function parseAnimData(xml) {
  const out = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const body = m[1];
    const tag = (t) => body.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
    out[tag("Name")] = {
      fw: Number(tag("FrameWidth")),
      fh: Number(tag("FrameHeight")),
      d: [...body.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((x) => Number(x[1])),
      copyOf: tag("CopyOf"),
    };
  }
  return out;
}

/** The SpriteCollab animation used for each engine animation, CopyOf resolved. */
function pickAnims(table) {
  const out = {};
  for (const [engine, names] of Object.entries(ANIMS)) {
    const name = names.find((n) => table[n]);
    if (!name) continue;
    let src = name;
    for (let i = 0; i < 4 && table[src].copyOf; i++) src = table[src].copyOf;
    out[engine] = { name: src, ...table[src] };
  }
  return out;
}

/** Rows of opaque pixels within a frame cell, across every frame and direction: [top, bottom]. */
function opaqueRows({ w, h, px }, fh) {
  let top = fh;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    let any = false;
    for (let x = 0; x < w && !any; x++) any = px[(y * w + x) * 4 + 3] > 0;
    if (!any) continue;
    const local = y % fh;
    top = Math.min(top, local);
    bottom = Math.max(bottom, local);
  }
  return bottom < 0 ? [0, fh - 1] : [top, bottom];
}

/** sprites.json and sprite-bounds.json entries for every species (by id) with art under assets/. */
export function spriteTables(ids) {
  const sprites = {};
  const bounds = {};
  for (const id of ids.map(String)) {
    const entry = {};
    if (fs.existsSync(path.join(ASSETS, "portraits", `${id}.png`))) entry.portrait = `portraits/${id}.png`;
    const dir = path.join(ASSETS, "sprites", id);
    const xml = path.join(dir, "AnimData.xml");
    if (fs.existsSync(xml)) {
      entry.anims = {};
      bounds[id] = {};
      for (const [engine, a] of Object.entries(pickAnims(parseAnimData(fs.readFileSync(xml, "utf8"))))) {
        const file = `${a.name}-Anim.png`;
        const img = readPng(path.join(dir, file));
        entry.anims[engine] = { file, fw: a.fw, fh: a.fh, n: Math.round(img.w / a.fw), rows: Math.round(img.h / a.fh), d: a.d };
        bounds[id][engine] = opaqueRows(img, a.fh);
      }
    }
    if (Object.keys(entry).length) sprites[id] = entry;
  }
  return { sprites, bounds };
}

/** Copy the portraits and overworld folders this game uses from a local NSS download into assets/. */
function importFrom(src) {
  let portraits = 0;
  let sheets = 0;
  fs.mkdirSync(path.join(ASSETS, "portraits"), { recursive: true });
  for (const [id, folder] of Object.entries(nssFolders(src))) {
    const face = path.join(src, "portrait", folder, "Normal.png");
    if (fs.existsSync(face)) {
      fs.copyFileSync(face, path.join(ASSETS, "portraits", `${id}.png`));
      portraits++;
    }
    const xml = path.join(src, "sprite", folder, "AnimData.xml");
    if (!fs.existsSync(xml)) continue;
    const dest = path.join(ASSETS, "sprites", id);
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(xml, path.join(dest, "AnimData.xml"));
    for (const a of Object.values(pickAnims(parseAnimData(fs.readFileSync(xml, "utf8"))))) {
      fs.copyFileSync(path.join(src, "sprite", folder, `${a.name}-Anim.png`), path.join(dest, `${a.name}-Anim.png`));
    }
    sheets++;
  }
  console.log(`assets: ${portraits} portraits, ${sheets} animated sprites (${SPECIES.length} Digimon)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, src] = process.argv.slice(2);
  if (cmd !== "import" || !src) {
    console.error("usage: node scripts/nss.mjs import <NSS download folder>");
    process.exit(1);
  }
  importFrom(src);
}

/**
 * Colours of a portrait for the procedural map sprite: the face's background (a gradient) is
 * flood-filled from the border, stepping between similar neighbours so the fill follows the
 * gradient and stops at the Digimon's outline; the rest is bucketed and ranked.
 * Returns { body, belly, accent, outline } as [r, g, b].
 */
export function portraitPalette(file) {
  const { w, h, px } = readPng(file);
  const at = (x, y) => [px[(y * w + x) * 4], px[(y * w + x) * 4 + 1], px[(y * w + x) * 4 + 2]];
  const near = (a, b, t = 40) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < t;
  const background = new Uint8Array(w * h);
  const queue = [];
  for (let x = 0; x < w; x++) queue.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) queue.push([0, y], [w - 1, y]);
  for (const [x, y] of queue) background[y * w + x] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || background[ny * w + nx]) continue;
      if (!near(at(nx, ny), at(x, y), 24)) continue;
      background[ny * w + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  const buckets = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (background[y * w + x]) continue;
      const k = (c[0] >> 4) * 256 + (c[1] >> 4) * 16 + (c[2] >> 4);
      const e = buckets.get(k) ?? { n: 0, sum: [0, 0, 0] };
      e.n++;
      for (let i = 0; i < 3; i++) e.sum[i] += c[i];
      buckets.set(k, e);
    }
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => e.sum.map((v) => Math.round(v / e.n)));
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / 255;
  const mid = ranked.filter((c) => lum(c) > 55 && lum(c) < 225);
  const body = mid.find((c) => sat(c) > 0.18) ?? mid[0] ?? [180, 180, 180];
  const accent = mid.find((c) => !near(c, body, 120) && sat(c) > 0.18) ?? mid.find((c) => !near(c, body, 90)) ?? body;
  const belly = ranked.find((c) => lum(c) >= 200) ?? body.map((v) => Math.round(v + (255 - v) * 0.5));
  const outline = ranked.find((c) => lum(c) < 55) ?? body.map((v) => Math.round(v * 0.3));
  return { body, belly, accent, outline };
}
