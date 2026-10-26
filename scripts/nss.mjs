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

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");

/** Game species id → NSS id (the folder numbers of the NSS download). */
export const NSS_IDS = {
  1: 160, 2: 161, 3: 162, 4: 163, // Agumon line
  5: 168, 6: 169, 7: 170, 8: 171, // Gabumon line
  9: 193, 10: 194, 11: 195, 12: 196, // Patamon line (MagnaAngemon = Holyangemon)
  13: 186, 14: 187, 15: 177, 16: 178, 17: 182, 18: 183, // Tentomon, Palmon, Gomamon lines
  19: 431, 20: 387, 21: 263, 22: 502, // Kunemon, Goblimon (Goburimon), Leomon, Devimon
  23: 405, 24: 406, 25: 407, 26: 408, // Guilmon, Growlmon (Growmon), WarGrowlmon (Megalogrowmon), Gallantmon (Dukemon)
  27: 416, 28: 417, 29: 418, 30: 466, // Salamon (Plotmon), Gatomon (Tailmon), Angewomon, Magnadramon (Holydramon)
  31: 681, // Gigimon
};

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

/** sprites.json and sprite-bounds.json entries for every species with art under assets/. */
export function spriteTables() {
  const sprites = {};
  const bounds = {};
  for (const id of Object.keys(NSS_IDS)) {
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
  for (const [id, nss] of Object.entries(NSS_IDS)) {
    const folder = String(nss).padStart(4, "0");
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
  console.log(`assets: ${portraits} portraits, ${sheets} animated sprites`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, src] = process.argv.slice(2);
  if (cmd !== "import" || !src) {
    console.error("usage: node scripts/nss.mjs import <NSS download folder>");
    process.exit(1);
  }
  importFrom(src);
}
