// PMD sprite-sheet renderer.
//
// Draws creatures from the original Pokémon Mystery Dungeon sheets that ship with
// the upstream game (PMD SpriteCollab, CC BY-NC 4.0). Each sheet stacks one block
// per animation; every block is `rows` rows (one per facing direction) of `n`
// frames sized `fw` x `fh`. A frame lives at (n * fw, anim.y + row * fh).
//
// The direction -> row mapping and the per-frame `d` durations are ported from the
// upstream renderer: rows are quantised from atan2(dx, dz) into 8 steps, with row 0
// facing the camera (+Z).
//
// A sprites.json entry can also come straight from a SpriteCollab-style folder: each animation
// carries its own `file` (`Walk-Anim.png`…, frames at y = row * fh) under <SHEET_DIR>/<id>/, and
// `portrait` names a face image (40x40) that menus and the HUD prefer.

import { PACK } from "../content/pack.js";

const BUNDLED = !!globalThis.__POKEBONK_DATA__;
const SPRITE_BASE = BUNDLED ? "" : "assets/";

const [SHEET_DIR] = PACK.spriteDirs; // animated sheets; static fallbacks carry their own path (meta.fallback)
const sheets = new Map(); // species id -> { img, ready, meta, kind }
let META = null;
let BOUNDS = null;
let scratch = null;

/** Wire the sprites.json table once at boot. */
export function initSprites(meta, bounds) {
  META = meta || {};
  BOUNDS = bounds || {};
}

/** Vertical bounds of the drawn part of one animation (see sprite-bounds.json). */
function boundsFor(id, name) {
  const all = BOUNDS?.[id];
  if (!all) return null;
  return all[name] || all.walk || all.idle || all.front || null;
}

/** True when the sprite table has an entry for this species. */
export function hasSprite(id) {
  return !!(META && META[id]);
}

/** True when the sheet draws this animation itself (a walk-only sheet plays its walk for the rest). */
export function hasAnim(id, name) {
  return !!META?.[id]?.anims?.[name];
}

function loadImage(src) {
  const img = new Image();
  const entry = { img, ready: false };
  img.addEventListener("load", () => { entry.ready = true; });
  img.addEventListener("error", () => { entry.ready = false; });
  img.src = src;
  return entry;
}

function loadSheet(id) {
  let s = sheets.get(id);
  if (s) return s;
  const meta = META?.[id];
  if (!meta) {
    sheets.set(id, null);
    return null;
  }
  const anims = meta.anims && Object.keys(meta.anims).length ? meta.anims : null;
  const perAnim = anims && Object.values(anims).some((a) => a.file);
  // "files": one image per animation; "pmd": one stacked sheet; "front": a static fallback;
  // "none": only a portrait (the world falls back to the procedural sprite).
  const kind = perAnim ? "files" : anims ? "pmd" : meta.fallback ? "front" : "none";
  s = { meta, kind, ready: false, img: null, files: null, portrait: null };
  if (kind === "files") {
    s.files = {};
    for (const [name, def] of Object.entries(anims)) s.files[name] = loadImage(`${SPRITE_BASE}${SHEET_DIR}/${id}/${def.file}`);
    s.ready = true; // per animation: drawSprite checks the one it needs
  } else if (kind !== "none") {
    const one = loadImage(SPRITE_BASE + (kind === "pmd" ? `${SHEET_DIR}/${id}.png` : meta.fallback));
    s.img = one.img;
    Object.defineProperty(s, "ready", { get: () => one.ready });
  }
  if (meta.portrait) s.portrait = loadImage(SPRITE_BASE + meta.portrait);
  sheets.set(id, s);
  return s;
}

/** The image and the y of row 0 for one animation of a loaded sheet (null while it loads). */
function animImage(s, chosen) {
  if (s.kind === "files") {
    const f = s.files[chosen.name];
    return f?.ready && f.img.naturalWidth ? { img: f.img, y: 0 } : null;
  }
  return s.ready && s.img?.naturalWidth ? { img: s.img, y: chosen.def.y ?? 0 } : null;
}

/** Quantise a facing vector onto the sheet's 8 direction rows. */
export function directionRow(dx, dz) {
  const a = Math.atan2(dx, dz);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

function animFor(meta, name) {
  const a = meta.anims;
  if (!a) return null;
  if (a[name]) return { name, def: a[name] };
  for (const k of ["idle", "walk", "charge", "attack", "hurt", "faint"]) {
    if (a[k]) return { name: k, def: a[k] };
  }
  const first = Object.keys(a)[0];
  return first ? { name: first, def: a[first] } : null;
}

function frameIndex(def, clock, once) {
  const n = Math.max(1, Math.min(def.n ?? 1, def.d?.length ?? def.n ?? 1));
  if (n <= 1) return 0;
  const d = def.d && def.d.length ? def.d : null;
  let total = 0;
  for (let i = 0; i < n; i++) total += d ? (d[i] ?? 4) : 4;
  if (total <= 0) return 0;
  let t = clock % total;
  if (t < 0) t += total;
  if (once) t = Math.min(t, total - 0.0001);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += d ? (d[i] ?? 4) : 4;
    if (t < acc) return i;
  }
  return n - 1;
}

/** Grab a tinted copy of one frame from the scratch canvas. */
function tintedFrame(img, fx, fy, fw, fh, tint) {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width < fw || scratch.height < fh) {
    scratch.width = Math.max(scratch.width, fw);
    scratch.height = Math.max(scratch.height, fh);
  }
  const g = scratch.getContext("2d");
  g.clearRect(0, 0, fw, fh);
  g.globalCompositeOperation = "source-over";
  g.drawImage(img, fx, fy, fw, fh, 0, 0, fw, fh);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = tint;
  g.fillRect(0, 0, fw, fh);
  g.globalCompositeOperation = "source-over";
  return scratch;
}

/**
 * Draw one creature frame.
 *
 * opts: { pxHeight, anim, clock, once, dirX, dirZ, alpha, tint, flip }
 * Returns true when the sheet was ready and something was drawn.
 */
export function drawSprite(ctx, id, sx, sy, opts = {}) {
  if (!META) return false;
  const s = loadSheet(id);
  if (!s || s.kind === "none" || !s.ready) return false;
  if (s.kind !== "files" && !s.img.naturalWidth) return false;

  const alpha = opts.alpha ?? 1;
  if (alpha <= 0.01) return true;
  const pxH = opts.pxHeight ?? 32;

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;

  if (s.kind === "front") {
    const img = s.img;
    const bb = boundsFor(id, "front") || [0, img.naturalHeight - 1];
    const visH = Math.max(1, bb[1] - bb[0] + 1);
    const scale = pxH / visH;
    const pxW = img.naturalWidth * scale;
    const left = sx - pxW / 2;
    const top = sy - (bb[1] + 1) * scale;
    if (opts.tint) {
      const c = tintedFrame(img, 0, 0, img.naturalWidth, img.naturalHeight, opts.tint);
      ctx.drawImage(c, 0, 0, img.naturalWidth, img.naturalHeight, left, top, pxW, img.naturalHeight * scale);
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, left, top, pxW, img.naturalHeight * scale);
    }
    ctx.restore();
    return true;
  }

  const chosen = animFor(s.meta, opts.anim || "idle");
  const source = chosen && animImage(s, chosen);
  if (!source) { ctx.restore(); return false; }
  const anim = chosen.def;

  const fw = anim.fw;
  const fh = anim.fh;
  const frame = frameIndex(anim, opts.clock ?? 0, opts.once);
  const rows = Math.max(1, anim.rows ?? 8);
  const row = Math.min(rows - 1, directionRow(opts.dirX ?? 0, opts.dirZ ?? 1));
  const fx = frame * fw;
  const fy = source.y + row * fh;

  // Anchor the lowest opaque pixel of the animation to the ground point, and
  // scale by the visible height so the transparent padding doesn't inflate it.
  // The scale comes from the standing height (idle, else walk) so every animation keeps the same
  // pixel size: a lying faint or a wide attack used to be blown up or shrunk to the target height.
  const bb = boundsFor(id, chosen.name) || [0, fh - 1];
  const ref = boundsFor(id, "idle") || bb;
  const visH = Math.max(1, ref[1] - ref[0] + 1);
  const scale = pxH / visH;
  const pxW = fw * scale;
  const drawH = fh * scale;
  const left = sx - pxW / 2;
  const top = sy - (bb[1] + 1) * scale;

  ctx.imageSmoothingEnabled = false;
  if (opts.flip) {
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-sx, 0);
  }

  if (opts.tint) {
    const c = tintedFrame(source.img, fx, fy, fw, fh, opts.tint);
    ctx.drawImage(c, 0, 0, fw, fh, left, top, pxW, drawH);
  } else {
    ctx.drawImage(source.img, fx, fy, fw, fh, left, top, pxW, drawH);
  }

  ctx.restore();
  return true;
}

/** Draw the front-facing idle frame centred in a box (menus, HUD portrait). */
export function paintSpritePortrait(ctx, id, cx, cy, box) {
  const s = loadSheet(id);
  if (!s) return false;
  if (s.portrait) {
    if (!s.portrait.ready || !s.portrait.img.naturalWidth) return false;
    const img = s.portrait.img;
    const sc = box / Math.max(img.naturalWidth, img.naturalHeight);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - (img.naturalWidth * sc) / 2, cy - (img.naturalHeight * sc) / 2, img.naturalWidth * sc, img.naturalHeight * sc);
    return true;
  }
  if (s.kind === "none" || s.kind === "files" || !s.ready || !s.img.naturalWidth) return false;
  if (s.kind === "front") {
    const img = s.img;
    const bb = boundsFor(id, "front") || [0, img.naturalHeight - 1];
    const visH = Math.max(1, bb[1] - bb[0] + 1);
    const sc = Math.min(box / img.naturalWidth, box / visH);
    const w = img.naturalWidth * sc;
    const h = img.naturalHeight * sc;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return true;
  }
  const chosen = animFor(s.meta, "idle");
  if (!chosen) return false;
  const anim = chosen.def;
  const fw = anim.fw;
  const fh = anim.fh;
  const bb = boundsFor(id, chosen.name) || [0, fh - 1];
  const visH = Math.max(1, bb[1] - bb[0] + 1);
  const sc = Math.min(box / fw, box / visH);
  const w = fw * sc;
  const h = fh * sc;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, 0, anim.y ?? 0, fw, fh, cx - w / 2, cy - h / 2, w, h);
  return true;
}

/** Height in world units for a species, so big Pokémon read as big. */
export function worldHeightFor(species) {
  const h = species?.height ?? 10;
  return Math.max(1.6, Math.min(2.8, 1.45 + h * 0.06));
}

/** Visible width / height ratio of the idle frame, for shadows and UI anchors. */
export function spriteAspect(id) {
  const meta = META?.[id];
  if (!meta) return 0.85;
  if (meta.anims) {
    const chosen = animFor(meta, "idle") || animFor(meta, "walk");
    if (chosen) {
      const bb = boundsFor(id, chosen.name) || [0, chosen.def.fh - 1];
      const visH = Math.max(1, bb[1] - bb[0] + 1);
      return chosen.def.fw / visH;
    }
  }
  return 0.85;
}

/**
 * CSS background style that crops the front-facing idle frame out of a sheet,
 * for DOM thumbnails (roster cards). Returns null when the sprite is unknown.
 */
export function portraitStyle(id, box = 56) {
  const meta = META?.[id];
  if (!meta) return null;
  if (meta.portrait) {
    return {
      width: `${box}px`,
      height: `${box}px`,
      backgroundImage: `url("${SPRITE_BASE}${meta.portrait}")`,
      backgroundSize: `${box}px ${box}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
    };
  }
  if (meta.anims && Object.keys(meta.anims).length) {
    const chosen = animFor(meta, "idle");
    if (!chosen) return null;
    const anim = chosen.def;
    const fw = anim.fw;
    const fh = anim.fh;
    const bb = boundsFor(id, chosen.name) || [0, fh - 1];
    const visH = Math.max(1, bb[1] - bb[0] + 1);
    const scale = Math.min(box / fw, box / visH);
    return {
      width: `${Math.round(fw * scale)}px`,
      height: `${Math.round(visH * scale)}px`,
      backgroundImage: `url("${SPRITE_BASE}${SHEET_DIR}/${id}.png")`,
      backgroundSize: `${Math.round((meta.w ?? fw) * scale)}px ${Math.round((meta.h ?? fh) * scale)}px`,
      backgroundPosition: `0px ${-Math.round(((anim.y ?? 0) + bb[0]) * scale)}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
    };
  }
  if (meta.fallback) {
    const bb = boundsFor(id, "front");
    const visH = bb ? Math.max(1, bb[1] - bb[0] + 1) : box;
    const scale = box / visH;
    return {
      width: `${Math.round(((meta.w ?? 96) * scale))}px`,
      height: `${Math.round(visH * scale)}px`,
      backgroundImage: `url("${SPRITE_BASE}${meta.fallback}")`,
      backgroundSize: `${Math.round((meta.w ?? 96) * scale)}px ${Math.round((meta.h ?? 96) * scale)}px`,
      backgroundPosition: `0px ${-Math.round((bb ? bb[0] : 0) * scale)}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
    };
  }
  return null;
}
