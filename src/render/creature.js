// Procedural pixel-art creature renderer.
//
// The upstream game uses PMD sprite sheets. This clone has no ripped art, so each
// species gets a deterministic pixel creature derived from its id, types and
// build. Sprites are baked once into an offscreen canvas and then blitted.

import { makeRng } from "../core/rng.js";
import { COLOR_RGB, TYPE_RGB, mixRgb, shade } from "./palette.js";

const SPRITE_PX = 48; // logical pixel grid of one creature sprite
const FEET_Y = SPRITE_PX - 4;

function planFor(rng, species) {
  const h = species.height ?? 10;
  const w = species.weight ?? 100;
  const bst = species.bst ?? 300;
  if (species.types.includes("flying") && w < 600) return "bird";
  if (species.types.includes("bug") && w < 500 && h < 22) return "insect";
  if (w > 900 && h < 24) return "blob";
  if (h > 30) return "serpent";
  if (h < 12 && w < 300) return rng.chance(0.5) ? "blob" : "quadruped";
  if (bst > 520) return "quadruped";
  return rng.chance(0.55) ? "biped" : "quadruped";
}

function paletteFor(species) {
  const typeRgb = TYPE_RGB[species.types[0]] ?? [180, 180, 180];
  const base = COLOR_RGB[species.color] ?? typeRgb;
  const secondary = species.types[1] ? TYPE_RGB[species.types[1]] ?? base : base;
  return {
    body: mixRgb(base, typeRgb, 0.4),
    belly: mixRgb(base, [255, 255, 255], 0.5),
    accent: secondary,
    dark: shade(base, -0.5),
    outline: shade(base, -0.72),
    eye: [26, 22, 36],
  };
}

class PixelCanvas {
  constructor(size) {
    this.size = size;
    this.canvas = document.createElement("canvas");
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
  }
  disc(cx, cy, r, color) {
    this.ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(r * r - y * y));
      this.ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
    }
  }
  ellipse(cx, cy, rx, ry, color) {
    this.ctx.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / (ry * ry);
      if (t <= 0) continue;
      const span = Math.floor(rx * Math.sqrt(t));
      this.ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
    }
  }
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
  tri(points, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i][0], points[i][1]);
    this.ctx.closePath();
    this.ctx.fill();
  }
}

/** Draw an outlined ellipse: a slightly larger dark shape under the fill. */
function oellipse(pc, cx, cy, rx, ry, fill, outline) {
  pc.ellipse(cx, cy, rx + 1, ry + 1, outline);
  pc.ellipse(cx, cy, rx, ry, fill);
}

/** Draw an outlined disc. */
function odisc(pc, cx, cy, r, fill, outline) {
  pc.disc(cx, cy, r + 1, outline);
  pc.disc(cx, cy, r, fill);
}

/**
 * Bake one species into a pixel sprite.
 * Returns { canvas, originX, originY } where originY is the sprite's feet row.
 */
export function bakeCreature(species) {
  const rng = makeRng(hash(species.id) ^ 0x9e3779b9);
  const pal = paletteFor(species);
  const plan = planFor(rng, species);
  const pc = new PixelCanvas(SPRITE_PX);
  const cx = SPRITE_PX / 2;

  const body = `rgb(${pal.body.join(",")})`;
  const belly = `rgb(${pal.belly.join(",")})`;
  const dark = `rgb(${pal.dark.join(",")})`;
  const accent = `rgb(${pal.accent.join(",")})`;
  const outline = `rgb(${pal.outline.join(",")})`;
  const eye = `rgb(${pal.eye.join(",")})`;

  const bulk = clampInt(1 + Math.round((species.bst ?? 300) / 420), 1, 3);
  const bodyW = 7 + bulk * 3 + (species.weight > 600 ? 3 : 0);
  const bodyH = 6 + bulk * 2 + (species.height > 30 ? 3 : 0);

  // --- silhouette -------------------------------------------------------
  let headY = FEET_Y - bodyH;
  let headR = Math.max(4, Math.round(bodyW * 0.62));
  let tailAngle = rng.range(-0.6, 0.6);
  const hasWings = plan === "bird" || (species.types.includes("flying") && rng.chance(0.5));
  const hasTail = plan !== "blob" && rng.chance(0.8);
  const hasHorns = rng.chance(0.35);
  const hasEars = rng.chance(0.5);
  const spots = rng.chance(0.35) ? rng.int(2, 4) : 0;

  if (plan === "serpent") {
    for (let i = 0; i < 8; i++) {
      const wob = Math.round(Math.sin(i * 0.9 + tailAngle) * 3);
      const cy2 = FEET_Y - i * (bodyH / 7);
      const r = Math.round(bodyW * (0.5 - i * 0.03));
      oellipse(pc, cx + wob, cy2, r, Math.max(2, r * 0.8), body, outline);
    }
    headY = FEET_Y - bodyH * 1.5;
    headR = Math.max(4, Math.round(bodyW * 0.6));
    odisc(pc, cx, headY, headR, body, outline);
  } else if (plan === "blob") {
    oellipse(pc, cx, FEET_Y - bodyH * 0.6, bodyW, bodyH * 0.85, body, outline);
    pc.ellipse(cx, FEET_Y - bodyH * 0.28, bodyW * 0.62, bodyH * 0.3, belly);
    headY = FEET_Y - bodyH * 0.85;
    headR = Math.max(3, Math.round(bodyW * 0.4));
  } else if (plan === "bird") {
    oellipse(pc, cx, FEET_Y - bodyH * 0.6, bodyW * 0.78, bodyH * 0.85, body, outline);
    headY = FEET_Y - bodyH * 1.35;
    headR = Math.max(4, Math.round(bodyW * 0.52));
    odisc(pc, cx, headY, headR, body, outline);
    if (hasWings) {
      pc.ellipse(cx - bodyW, FEET_Y - bodyH * 0.85, bodyW * 0.75, bodyH * 0.3, accent);
      pc.ellipse(cx + bodyW, FEET_Y - bodyH * 0.85, bodyW * 0.75, bodyH * 0.3, accent);
    }
  } else if (plan === "insect") {
    oellipse(pc, cx, FEET_Y - bodyH * 0.55, bodyW * 0.68, bodyH * 0.62, body, outline);
    headY = FEET_Y - bodyH * 1.05;
    headR = Math.max(3, Math.round(bodyW * 0.45));
    odisc(pc, cx, headY, headR, body, outline);
    // legs
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        pc.rect(cx + side * (bodyW * 0.5) - 1, FEET_Y - bodyH * 0.6 + i * 3, 2, 2, dark);
      }
    }
  } else {
    // biped / quadruped torso
    oellipse(pc, cx, FEET_Y - bodyH * 0.55, bodyW * 0.8, bodyH * 0.72, body, outline);
    pc.ellipse(cx, FEET_Y - bodyH * 0.3, bodyW * 0.5, bodyH * 0.26, belly);
    headY = FEET_Y - bodyH - 1;
    headR = Math.max(4, Math.round(bodyW * 0.56));
    odisc(pc, cx, headY, headR, body, outline);
    // limbs
    if (plan === "biped") {
      oellipse(pc, cx - bodyW * 0.42, FEET_Y - 2, 3, 3, dark, outline);
      oellipse(pc, cx + bodyW * 0.42, FEET_Y - 2, 3, 3, dark, outline);
    } else {
      for (const side of [-1, 1]) {
        for (const f of [0.3, 0.72]) {
          oellipse(pc, cx + side * bodyW * 0.62, FEET_Y - bodyH * f, 2.6, 2.6, dark, outline);
        }
      }
    }
  }

  if (hasTail && plan !== "serpent") {
    const tx = cx + Math.cos(tailAngle + Math.PI) * bodyW * 0.9;
    const ty = FEET_Y - bodyH * 0.4 + Math.sin(tailAngle) * 3;
    pc.rect(Math.min(cx, tx), Math.min(ty, ty - 2), 3, 3, dark);
  }

  if (hasEars && plan !== "blob") {
    const ey = headY - headR * 0.6;
    pc.tri([[cx - headR * 0.8, ey + 2], [cx - headR * 0.5, ey - 5], [cx - headR * 0.1, ey + 2]], accent);
    pc.tri([[cx + headR * 0.8, ey + 2], [cx + headR * 0.5, ey - 5], [cx + headR * 0.1, ey + 2]], accent);
  }
  if (hasHorns) {
    pc.rect(cx - 3, headY - headR - 3, 2, 4, accent);
    pc.rect(cx + 2, headY - headR - 3, 2, 4, accent);
  }
  if (hasWings && plan !== "bird") {
    pc.ellipse(cx - bodyW * 0.9, FEET_Y - bodyH * 0.7, bodyW * 0.5, bodyH * 0.24, accent);
    pc.ellipse(cx + bodyW * 0.9, FEET_Y - bodyH * 0.7, bodyW * 0.5, bodyH * 0.24, accent);
  }

  // spots
  for (let i = 0; i < spots; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = rng.range(0.2, 0.7);
    pc.disc(cx + Math.cos(a) * bodyW * rr, FEET_Y - bodyH * (0.35 + rng.range(0, 0.3)), 1.6, dark);
  }

  // --- face -------------------------------------------------------------
  const eyeY = headY - 1;
  const eyeGap = Math.max(2, Math.round(headR * 0.48));
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeGap;
    pc.rect(ex - 1, eyeY - 1, 3, 3, "#ffffff");
    pc.rect(ex, eyeY, 1, 2, eye);
    pc.rect(ex - 1, eyeY - 1, 1, 1, "#ffffff");
  }
  // mouth
  pc.rect(cx - 1, headY + headR - 1, 3, 1, dark);

  // type crest
  const crest = TYPE_RGB[species.types[0]];
  if (crest) {
    const c = `rgb(${crest.join(",")})`;
    pc.rect(cx - 1, headY - headR - 2, 3, 2, c);
  }

  return { canvas: pc.canvas, originX: cx, originY: FEET_Y, plan };
}

const cache = new Map();

export function creatureSprite(species) {
  let s = cache.get(species.id);
  if (!s) {
    s = bakeCreature(species);
    cache.set(species.id, s);
  }
  return s;
}

function hash(n) {
  let h = 2166136261 >>> 0;
  h = Math.imul(h ^ n, 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
