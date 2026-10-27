// Canvas world renderer: terrain, creatures, projectiles, effects.

import { TAU, clamp, lerp } from "../core/math.js";
import { tr } from "../core/lang.js";
import { makeRng } from "../core/rng.js";
import { creatureSprite } from "./creature.js";
import { drawSprite, hasAnim, spriteAspect, worldHeightFor } from "./sprites.js";
import { BIOME_PALETTES, TYPE_RGB, hex, mixRgb, shade } from "./palette.js";
import { MAP_KINDS } from "../game/events.js";

const ZOOM = 26; // world units -> pixels at zoom 1
const DEPTH = 0.62; // vertical squash to fake a 3/4 camera
const TILE_WORLD = 22; // world units covered by one terrain tile
const CREATURE_SCALE = 0.046; // sprite pixels -> screen pixels per world unit

// Prop density and variety per biome. countMul scales with biome.size; `size` is the
// per-prop scale range. Keeps every biome visually distinct without extra assets.
const PROP_CONFIG = {
  forest: { kinds: ["tree", "bush", "rock", "flower", "mushroom", "stump", "vine"], countMul: 1.8, size: [0.7, 1.6] },
  desert: { kinds: ["rock", "bone", "skull", "cactus", "stump"], countMul: 1.2, size: [0.8, 1.5] },
  coast: { kinds: ["rock", "shell", "coral", "driftwood", "bush"], countMul: 1.4, size: [0.7, 1.4] },
  glacier: { kinds: ["rock", "pine", "crystal", "icicle", "iceberg"], countMul: 1.3, size: [0.8, 1.6] },
  graveyard: { kinds: ["tomb", "tree", "rock", "bone"], countMul: 1.5, size: [0.9, 1.7] },
  volcano: { kinds: ["rock", "vent", "geyser", "bone"], countMul: 1.1, size: [0.8, 1.5] },
};

/**
 * How a creature without a drawn animation moves (pivot at the feet): a hop when walking,
 * breathing when idle, a lunge on attack, a shake when hurt and a fall when fainting.
 */
export function creatureMotion(opts, pxHeight) {
  const t = (opts.clock ?? 0) * 0.25;
  const facing = (opts.dirX ?? 0) < 0 ? -1 : 1;
  let dx = 0;
  let dy = 0;
  let sxk = 1;
  let syk = 1;
  let rot = 0;
  if (opts.anim === "walk") {
    dy = -Math.abs(Math.sin(t)) * pxHeight * 0.08;
    sxk = 1 + Math.sin(t * 2) * 0.04;
    syk = 1 - Math.sin(t * 2) * 0.04;
  } else if (opts.anim === "attack") {
    // One lunge over the attack (callers run its clock from 0 to 120), toward where it faces.
    const k = Math.sin(Math.min(1, Math.max(0, (opts.clock ?? 0) / 120)) * Math.PI);
    dx = (opts.dirX ?? 0) * k * pxHeight * 0.18;
    dy = (opts.dirZ ?? 0) * k * pxHeight * 0.1;
    sxk = 1 + k * 0.12;
    syk = 1 - k * 0.08;
  } else if (opts.anim === "hurt") {
    dx = Math.sin(t * 8) * pxHeight * 0.05;
  } else if (opts.anim === "faint") {
    rot = facing * Math.min(1, (opts.clock ?? 0) / 40) * (Math.PI / 2);
    dy = -Math.abs(Math.sin(rot)) * pxHeight * 0.25; // lying down, the body rests on the ground, not half under it
  } else {
    syk = 1 + Math.sin(t * 0.5) * 0.03;
  }
  return { dx, dy, sxk, syk, rot, facing };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.camX = 0;
    this.camZ = 0;
    this.zoom = ZOOM;
    this.shake = 0;
    this.tiles = new Map();
    this.props = new Map();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = 960;
    this.h = 600;
    this.resize();
    // The canvas is hidden while the menus are up, so track its real size.
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || this.w));
    const h = Math.max(240, Math.round(rect.height || this.h));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Scale so the play field reads the same on small and large screens.
    this.zoom = clamp(Math.min(w, h) / 26, 16, 34);
  }

  worldToScreen(x, z, y = 0) {
    return {
      x: (x - this.camX) * this.zoom + this.w / 2,
      y: (z - this.camZ) * this.zoom * DEPTH + this.h / 2 - (y ?? 0) * this.zoom * 0.55,
    };
  }

  /* ------------------------------------------------------------ terrain */

  tileFor(biomeId) {
    let t = this.tiles.get(biomeId);
    if (!t) {
      t = this.makeTile(biomeId);
      this.tiles.set(biomeId, t);
    }
    return t;
  }

  makeTile(biomeId) {
    const pal = BIOME_PALETTES[biomeId] ?? BIOME_PALETTES.forest;
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    const rng = makeRng(0xbeef ^ biomeId.length * 977);

    g.fillStyle = hex(pal.ground);
    g.fillRect(0, 0, size, size);

    // Blotches
    for (let i = 0; i < 220; i++) {
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      const r = rng.range(4, 22);
      g.fillStyle = hex(mixRgb(pal.ground, pal.groundAlt, rng.range(0.2, 1)), 0.55);
      g.beginPath();
      g.ellipse(x, y, r, r * rng.range(0.5, 1), rng.range(0, Math.PI), 0, Math.PI * 2);
      g.fill();
    }
    // Grass tufts / pebbles
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(rng.range(0, size));
      const y = Math.floor(rng.range(0, size));
      const col = rng.chance(0.5) ? shade(pal.ground, 0.22) : shade(pal.ground, -0.26);
      g.fillStyle = hex(col, 0.9);
      g.fillRect(x, y, 1, 1);
      if (rng.chance(0.25)) g.fillRect(x + 1, y, 1, 1);
      if (rng.chance(0.12)) g.fillRect(x, y + 1, 1, 1);
    }
    const pattern = this.ctx.createPattern(c, "repeat");
    // One tile covers TILE_WORLD world units.
    const k = TILE_WORLD / size;
    if (pattern.setTransform) pattern.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
    return { canvas: c, pattern };
  }

  propsFor(biome) {
    let p = this.props.get(biome.id);
    if (p) return p;
    const rng = makeRng(0x1234 ^ biome.id.length * 7919);
    const half = biome.size / 2;
    const list = [];
    const cfg = PROP_CONFIG[biome.id] ?? PROP_CONFIG.forest;
    const count = Math.round(biome.size * cfg.countMul);
    for (let i = 0; i < count; i++) {
      list.push({
        x: rng.range(-half + 4, half - 4),
        z: rng.range(-half + 4, half - 4),
        kind: rng.pick(cfg.kinds),
        s: rng.range(cfg.size[0], cfg.size[1]),
        flip: rng.chance(0.5),
      });
    }
    p = list;
    this.props.set(biome.id, p);
    return p;
  }

  drawTerrain(run) {
    const biome = run.biome;
    const pal = BIOME_PALETTES[biome.id] ?? BIOME_PALETTES.forest;
    const ctx = this.ctx;

    // Sky / base
    ctx.fillStyle = hex(pal.sky);
    ctx.fillRect(0, 0, this.w, this.h);

    const tile = this.tileFor(biome.id);
    const origin = this.worldToScreen(-biome.size / 2, -biome.size / 2);
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.scale(this.zoom, this.zoom * DEPTH);
    ctx.fillStyle = tile.pattern;
    ctx.fillRect(0, 0, biome.size, biome.size);
    ctx.restore();

    // Arena border
    const half = biome.size / 2;
    const a = this.worldToScreen(-half, -half);
    const b = this.worldToScreen(half, half);
    ctx.strokeStyle = hex(pal.cliff, 0.9);
    ctx.lineWidth = 6;
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

    // Props
    for (const pr of this.propsFor(biome)) {
      const s = this.worldToScreen(pr.x, pr.z);
      if (s.x < -60 || s.x > this.w + 60 || s.y < -60 || s.y > this.h + 60) continue;
      this.drawProp(s, pr, pal);
    }
  }

  drawProp(s, pr, pal) {
    const ctx = this.ctx;
    const px = s.x;
    const py = s.y;
    const u = this.zoom * 0.85 * pr.s;
    ctx.save();
    ctx.translate(px, py);
    switch (pr.kind) {
      case "tree":
      case "pine": {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(0, 2, u * 0.95, u * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(pal.ground, -0.55));
        ctx.fillRect(-u * 0.13, -u * 0.75, u * 0.26, u * 0.8);
        const leaf = pr.kind === "pine" ? hex(shade(pal.ground, -0.42)) : hex(mixRgb(pal.ground, [28, 92, 42], 0.85));
        ctx.fillStyle = hex(shade(pal.ground, -0.7));
        ctx.beginPath();
        ctx.ellipse(0, -u * 1.05, u * 0.88, u * 0.98, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = leaf;
        ctx.beginPath();
        ctx.ellipse(0, -u * 1.1, u * 0.78, u * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(leaf, 0.22), 0.7);
        ctx.beginPath();
        ctx.ellipse(-u * 0.24, -u * 1.3, u * 0.34, u * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "bush": {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(0, 1, u * 0.62, u * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(mixRgb(pal.ground, [26, 86, 38], 0.8), -0.45));
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.35, u * 0.62, u * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(mixRgb(pal.ground, [26, 86, 38], 0.8));
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.42, u * 0.55, u * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "rock": {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 1, u * 0.55, u * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(pal.cliff);
        ctx.beginPath();
        ctx.moveTo(-u * 0.5, 0);
        ctx.lineTo(-u * 0.3, -u * 0.6);
        ctx.lineTo(u * 0.2, -u * 0.7);
        ctx.lineTo(u * 0.55, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "flower": {
        ctx.fillStyle = hex([240, 220, 90]);
        ctx.fillRect(-1, -u * 0.5, 2, 2);
        ctx.fillStyle = hex([255, 150, 180]);
        ctx.fillRect(-2, -u * 0.5 - 1, 4, 1);
        break;
      }
      case "cactus": {
        ctx.fillStyle = hex(shade(pal.ground, -0.2));
        ctx.fillRect(-u * 0.14, -u * 0.9, u * 0.28, u * 0.95);
        ctx.fillRect(-u * 0.42, -u * 0.7, u * 0.28, u * 0.16);
        ctx.fillRect(u * 0.14, -u * 0.5, u * 0.28, u * 0.16);
        break;
      }
      case "tomb": {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(0, 1, u * 0.5, u * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex([150, 146, 160]);
        ctx.fillRect(-u * 0.35, -u * 0.85, u * 0.7, u * 0.9);
        ctx.beginPath();
        ctx.arc(0, -u * 0.85, u * 0.35, Math.PI, 0);
        ctx.fill();
        break;
      }
      case "vent": {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 0, u * 0.45, u * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex([255, 110, 40], 0.75);
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.1, u * 0.3, u * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "crystal": {
        ctx.fillStyle = hex([150, 220, 255], 0.85);
        ctx.beginPath();
        ctx.moveTo(0, -u);
        ctx.lineTo(u * 0.28, 0);
        ctx.lineTo(-u * 0.28, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "skull": {
        ctx.fillStyle = hex([225, 220, 200]);
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.2, u * 0.35, u * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "mushroom": {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 1, u * 0.55, u * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(pal.ground, -0.3));
        ctx.fillRect(-u * 0.09, -u * 0.62, u * 0.18, u * 0.62);
        ctx.fillStyle = hex([210, 60, 90]);
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.68, u * 0.6, u * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.ellipse(-u * 0.18, -u * 0.72, u * 0.14, u * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(u * 0.22, -u * 0.62, u * 0.12, u * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "stump": {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 1, u * 0.5, u * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(pal.cliff, -0.25));
        ctx.beginPath();
        ctx.ellipse(0, 0, u * 0.5, u * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(pal.cliff, 0.25));
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.04, u * 0.34, u * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade(pal.cliff, 0.55));
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.09, u * 0.2, u * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "bone": {
        ctx.fillStyle = hex([228, 222, 205]);
        const rot = pr.flip ? 0.5 : -0.5;
        ctx.save();
        ctx.translate(0, -u * 0.15);
        ctx.rotate(rot);
        ctx.fillRect(-u * 0.38, -u * 0.14, u * 0.76, u * 0.28);
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(-u * 0.36, -u * 0.15, u * 0.16, u * 0.14, 0, 0, Math.PI * 2);
        ctx.ellipse(u * 0.36, -u * 0.15, u * 0.16, u * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "shell": {
        ctx.fillStyle = hex([238, 226, 198]);
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.18, u * 0.5, u * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(shade([238, 226, 198], -0.25));
        ctx.beginPath();
        ctx.arc(u * 0.12, -u * 0.22, u * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-u * 0.18, -u * 0.08, u * 0.11, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "coral": {
        ctx.fillStyle = hex([255, 120, 90]);
        ctx.lineWidth = u * 0.16;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-u * 0.2, -u * 0.4);
        ctx.lineTo(-u * 0.35, -u * 0.7);
        ctx.moveTo(0, 0);
        ctx.lineTo(u * 0.22, -u * 0.45);
        ctx.lineTo(u * 0.4, -u * 0.75);
        ctx.moveTo(-u * 0.2, -u * 0.4);
        ctx.lineTo(-u * 0.1, -u * 0.65);
        ctx.stroke();
        break;
      }
      case "driftwood": {
        const rot = pr.flip ? 0.3 : -0.3;
        ctx.fillStyle = hex(shade(pal.cliff, 0.35));
        ctx.save();
        ctx.translate(0, -u * 0.1);
        ctx.rotate(rot);
        ctx.fillRect(-u * 0.45, -u * 0.14, u * 0.9, u * 0.28);
        ctx.restore();
        ctx.fillStyle = hex(shade(pal.cliff, 0.55));
        ctx.fillRect(-u * 0.4, -u * 0.12, u * 0.14, u * 0.2);
        break;
      }
      case "icicle": {
        ctx.fillStyle = hex([230, 242, 252]);
        ctx.beginPath();
        ctx.moveTo(-u * 0.22, 0);
        ctx.lineTo(0, -u * 1.05);
        ctx.lineTo(u * 0.22, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(-u * 0.1, -u * 0.3);
        ctx.lineTo(0, -u * 0.95);
        ctx.lineTo(u * 0.1, -u * 0.3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "iceberg": {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 1, u * 0.45, u * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex([225, 238, 250]);
        ctx.beginPath();
        ctx.moveTo(-u * 0.35, 0);
        ctx.lineTo(-u * 0.15, -u * 0.85);
        ctx.lineTo(u * 0.05, -u * 0.6);
        ctx.lineTo(u * 0.3, -u * 0.95);
        ctx.lineTo(u * 0.35, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hex([170, 205, 235], 0.5);
        ctx.beginPath();
        ctx.moveTo(-u * 0.25, -u * 0.5);
        ctx.lineTo(u * 0.1, -u * 0.7);
        ctx.lineTo(u * 0.15, -u * 0.4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "geyser": {
        ctx.fillStyle = "rgba(170,170,170,0.45)";
        for (let k = 0; k < 4; k++) {
          const yy = -u * (0.5 + k * 0.55);
          const rr = u * (0.35 - k * 0.07);
          ctx.beginPath();
          ctx.ellipse(0, yy, rr, rr * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = hex([255, 110, 40], 0.5);
        ctx.beginPath();
        ctx.ellipse(0, -u * 0.35, u * 0.25, u * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- entities */

  drawCreature(species, sx, sy, scale, opts = {}) {
    const pxHeight = worldHeightFor(species) * this.zoom * scale;
    const ctx = this.ctx;
    const m = creatureMotion(opts, pxHeight);

    // Preferred path: the sheet, animated and directional. A walk-only sheet (the generated ones)
    // borrows the procedural lunge, shake and fall for the animations it doesn't draw.
    if (opts.anim) {
      const borrow = ["attack", "hurt", "faint"].includes(opts.anim) && !hasAnim(species.id, opts.anim);
      ctx.save();
      if (borrow) {
        ctx.translate(sx + m.dx, sy + m.dy);
        ctx.rotate(m.rot);
        ctx.scale(m.sxk, m.syk);
        ctx.translate(-sx, -sy);
      }
      const drew = drawSprite(ctx, species.id, sx, sy, {
        pxHeight,
        anim: opts.anim,
        clock: opts.clock ?? 0,
        once: opts.once,
        dirX: opts.dirX ?? 0,
        dirZ: opts.dirZ ?? 1,
        alpha: opts.alpha ?? 1,
        tint: opts.tint ?? null,
      });
      ctx.restore();
      if (drew) return;
    }

    // Fallback while the sheet is still loading: the procedural sprite, sized so
    // its feet land on the same ground point.
    const sprite = creatureSprite(species);
    const size = pxHeight * (sprite.canvas.height / sprite.originY);
    const top = sy - pxHeight;
    const left = sx - size / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(sx + m.dx, sy + m.dy);
    ctx.rotate(m.rot);
    ctx.scale(m.sxk * (m.facing < 0 !== !!opts.flip ? -1 : 1), m.syk);
    ctx.translate(-sx, -sy);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.tint) {
      ctx.drawImage(sprite.canvas, left, top, size, size);
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = opts.tint;
      ctx.fillRect(left, top, size, size);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.drawImage(sprite.canvas, left, top, size, size);
    }
    ctx.restore();
  }

  drawEnemy(run, e) {
    const ctx = this.ctx;
    const s = this.worldToScreen(e.x, e.z);
    if (s.x < -120 || s.x > this.w + 120 || s.y < -120 || s.y > this.h + 120) return;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, this.zoom * 0.45 * e.scale, this.zoom * 0.16 * e.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(e.animT * 7) * 1.6 * (e.tier === "boss" || e.tier === "alpha" ? 0.5 : 1);
    const moving = Math.hypot(e.vx, e.vz) > 0.35;

    // Animation state: faint > hurt > walk / idle.
    let anim = "idle";
    let clock = e.animT * 20;
    let once = false;
    let alpha = 1;
    if (e.dying > 0) {
      anim = "faint";
      clock = (0.35 - Math.max(0, e.dying)) * 60;
      once = true;
      alpha = clamp(e.dying / 0.16, 0, 1);
    } else if (e.flash > 0) {
      anim = "hurt";
      clock = (1 - e.flash) * 60;
      once = true;
    } else if (moving) {
      anim = "walk";
      clock = e.animT * 26;
    }
    if (e.captureReady && e.dying <= 0) {
      anim = "hurt";
      clock = 4;
      once = true;
    }

    const vlen = Math.hypot(e.vx, e.vz) || 1;
    const dirX = e.vx / vlen;
    const dirZ = e.vz / vlen;

    this.drawCreature(e.species, s.x, s.y + bob, e.scale, {
      anim,
      clock,
      once,
      dirX,
      dirZ,
      alpha,
      tint: e.flash > 0 ? `rgba(255,255,255,${e.flash * 0.75})` : e.shiny ? "rgba(255,215,0,0.22)" : null,
    });

    // Capture prompt: a pulsing ring around a weakened target.
    if (e.captureReady && run.capture?.down === e.id) {
      const t = (Math.sin(run.time * 6) + 1) / 2;
      ctx.strokeStyle = `rgba(255,209,102,${0.45 + t * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, this.zoom * 0.7 * e.scale, this.zoom * 0.26 * e.scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(20,16,40,0.85)";
      ctx.font = "800 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      const labelY = s.y - this.zoom * 2.1 * e.scale;
      ctx.fillText("E", s.x, labelY);
      ctx.fillStyle = "#ffd166";
      ctx.fillText("E", s.x, labelY);
    }

    // Tier badge
    if (e.tier !== "normal" && e.tier !== "swarm") {
      const col = e.tier === "elite" ? 0x60a5fa : e.tier === "alpha" ? 0xff5a4a : 0xffd166;
      ctx.fillStyle = `#${col.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.arc(s.x, s.y - this.zoom * 1.25 * e.scale, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health bar
    if (e.hp < e.maxHp) {
      const w = this.zoom * 0.9 * e.scale;
      const pct = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(s.x - w / 2, s.y - this.zoom * 1.05 * e.scale, w, 3.5);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(s.x - w / 2, s.y - this.zoom * 1.05 * e.scale, w * pct, 3.5);
    }
  }

  drawAlly(run, a) {
    const ctx = this.ctx;
    const s = this.worldToScreen(a.x, a.z, a.y);
    if (s.x < -120 || s.x > this.w + 120 || s.y < -120 || s.y > this.h + 120) return;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, this.zoom * 0.32, this.zoom * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const hopping = a.hop > 0;
    this.drawCreature(a.species, s.x, s.y, 0.78, {
      anim: hopping ? "attack" : "walk",
      clock: hopping ? (1 - Math.max(0, a.hop) / 0.32) * 120 : a.anim * 26,
      once: hopping,
      dirX: a.fx,
      dirZ: a.fz,
      tint: a.flash > 0 ? `rgba(255,255,255,${a.flash * 0.6})` : a.shiny ? "rgba(255,240,150,0.12)" : null,
    });
  }

  drawPlayer(run) {
    const p = run.player;
    const ctx = this.ctx;
    const s = this.worldToScreen(p.x, p.z, p.y);
    const bob = Math.sin(p.animT * 9) * 1.8 * clamp(p.moveSpeedNow, 0, 1.4);
    const squash = p.attackT > 0 ? 1 + p.attackT * 0.5 : 1;

    // Ground ring
    const pal = BIOME_PALETTES[run.biome.id] ?? BIOME_PALETTES.forest;
    ctx.strokeStyle = "rgba(120,220,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, this.zoom * 0.55, this.zoom * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, this.zoom * 0.5, this.zoom * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const blink = p.iframes > 0 && Math.floor(p.iframes * 18) % 2 === 0;

    // Animation state, mirroring the enemy rules.
    let anim = "idle";
    let clock = p.animT * 20;
    let once = false;
    let alpha = blink ? 0.45 : 1;
    if (p.dead) {
      anim = "faint";
      clock = p.animT * 60;
      once = true;
      alpha = 1;
    } else if (p.attackT > 0) {
      anim = "attack";
      clock = (1 - p.attackT / 0.22) * 120;
      once = true;
    } else if (Math.hypot(p.vx, p.vz) > 0.5) {
      anim = "walk";
      clock = p.animT * 42;
    }

    this.drawCreature(p.species, s.x, s.y + bob, squash, {
      anim,
      clock,
      once,
      dirX: p.facingX || 0,
      dirZ: p.facingZ || 1,
      alpha,
      tint: p.flash > 0 ? `rgba(255,90,90,${p.flash * 0.7})` : p.shiny ? "rgba(255,215,0,0.22)" : null,
    });

    // Ultimate ready halo
    if (p.ultCharge >= 1) {
      ctx.strokeStyle = "rgba(255,210,80,0.8)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, this.zoom * 0.68, this.zoom * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawPickups(run) {
    const ctx = this.ctx;
    for (const pk of run.pickups) {
      const s = this.worldToScreen(pk.x, pk.z, 0.4 + Math.sin(pk.t * 4) * 0.12);
      if (s.x < -30 || s.x > this.w + 30 || s.y < -30 || s.y > this.h + 30) continue;
      const r = this.zoom * 0.16;
      let color = 0x60a5fa;
      if (pk.kind === "xp") color = 0x60a5fa;
      if (pk.kind === "coin") color = 0xffd166;
      if (pk.kind === "heal") color = 0x5cd6a0;
      if (pk.kind === "magnet") color = 0xc084fc;
      if (pk.kind === "candy") color = 0xff7ad9;
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(s.x - r * 0.3, s.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEvents(run) {
    if (!run.events) return;
    run.events.draw(this.ctx, this.zoom, this.camX, this.camZ, this.w, this.h);
  }

  drawEggs(run) {
    if (!run.eggs || !run.eggs.egg.active) return;
    const p = run.player;
    const s = this.worldToScreen(p.x, p.z, p.y + 1.4);
    run.eggs.draw(this.ctx, this.zoom, s.x, s.y);
  }

  drawProjectiles(run) {
    const ctx = this.ctx;
    for (const pr of run.projectiles) {
      const s = this.worldToScreen(pr.x, pr.z, pr.y);
      const color = pr.def ? TYPE_RGB[pr.def.type] ?? [220, 220, 220] : [220, 220, 220];
      const r = this.zoom * pr.radius * 0.5;
      ctx.fillStyle = `rgba(${color.join(",")},0.95)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(s.x - r * 0.3, s.y - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEffects(run) {
    const ctx = this.ctx;
    for (const e of run.effects) {
      const k = e.t / e.life;
      const s = this.worldToScreen(e.x, e.z, e.y);
      const color = `#${e.color.toString(16).padStart(6, "0")}`;
      if (e.kind === "ring") {
        const r = e.r * this.zoom * (0.25 + k * 0.85);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r, r * DEPTH, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === "beam") {
        const len = e.len * this.zoom;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(e.angle) * len, s.y + Math.sin(e.angle) * len * DEPTH);
        ctx.stroke();
      } else if (e.kind === "cone") {
        const len = e.len * this.zoom;
        ctx.fillStyle = color;
        ctx.globalAlpha = (1 - k) * 0.4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        const spread = 0.5;
        ctx.lineTo(s.x + Math.cos(e.angle - spread) * len, s.y + Math.sin(e.angle - spread) * len * DEPTH);
        ctx.lineTo(s.x + Math.cos(e.angle + spread) * len, s.y + Math.sin(e.angle + spread) * len * DEPTH);
        ctx.closePath();
        ctx.fill();
      } else if (e.kind === "particle") {
        const px = s.x + e.vx * e.t * this.zoom * 0.35;
        const py = s.y + (e.vy * e.t - 4 * e.t * e.t) * this.zoom * 0.3;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = color;
        const r = Math.max(1, e.size * this.zoom * (1 - k * 0.4));
        ctx.fillRect(px - r / 2, py - r / 2, r, r);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(run) {
    const ctx = this.ctx;
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const f of run.floaters) {
      const s = this.worldToScreen(f.x, f.z, f.y);
      ctx.globalAlpha = 1 - f.t / f.life;
      ctx.fillStyle = f.color;
      ctx.fillText(tr(String(f.text)), s.x, s.y);
    }
    ctx.globalAlpha = 1;
  }

  drawWeather(run) {
    if (run.weather === "none") return;
    const ctx = this.ctx;
    const t = run.time;
    ctx.save();
    if (run.weather === "rain") {
      ctx.strokeStyle = "rgba(180,220,255,0.35)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 140; i++) {
        const x = (i * 137 + t * 300) % (this.w + 80) - 40;
        const y = (i * 71 + t * 900) % (this.h + 80) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 14);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,90,140,0.16)";
      ctx.fillRect(0, 0, this.w, this.h);
    } else if (run.weather === "sun") {
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, 20, this.w / 2, this.h / 2, this.w * 0.7);
      g.addColorStop(0, "rgba(255,210,120,0.18)");
      g.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    } else {
      ctx.fillStyle = "rgba(200,160,90,0.2)";
      ctx.fillRect(0, 0, this.w, this.h);
      for (let i = 0; i < 90; i++) {
        const x = (i * 97 + t * 420) % (this.w + 60) - 30;
        const y = (i * 53 + t * 200) % (this.h + 60) - 30;
        ctx.fillStyle = "rgba(220,190,120,0.35)";
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- ambient */

  // Biome-specific ambient particles drawn as a subtle screen overlay. No assets:
  // positions are deterministic per biome and animated with time only.
  drawAmbient(run) {
    const ctx = this.ctx;
    const t = run.time;
    const id = run.biome.id;
    const pal = BIOME_PALETTES[id] ?? BIOME_PALETTES.forest;
    const w = this.w;
    const h = this.h;
    ctx.save();
    // Deterministic pseudo-random generator seeded per biome.
    let seed = 0x9e3779 ^ id.length * 26544;
    const frand = () => {
      seed = (seed * 16807 + 12345) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const parts = [];
    const make = (n) => {
      for (let i = 0; i < n; i++) parts.push({ x: frand() * w, y: frand() * h, ph: frand() });
    };

    if (id === "forest") {
      // Floating green leaves.
      make(40);
      ctx.fillStyle = hex(mixRgb(pal.ground, [34, 90, 45], 0.7));
      for (const p of parts) {
        const phase = (t + p.ph * 6) / 3;
        const yy = ((p.y + phase * 22) % (h + 60)) - 30;
        const xx = p.x + Math.sin(phase * 4) * 12;
        ctx.fillRect(xx, yy, 2.5, 2.5);
      }
    } else if (id === "desert") {
      // Dust motes.
      make(45);
      ctx.fillStyle = "rgba(210,175,110,0.5)";
      for (const p of parts) {
        const phase = (t + p.ph * 5) / 2.5;
        const yy = ((p.y + phase * 14) % (h + 60)) - 30;
        const xx = (p.x + phase * 16) % (w + 60) - 30;
        ctx.fillRect(xx, yy, 1.5, 1.5);
      }
    } else if (id === "coast") {
      // Sea spray / mist.
      make(35);
      ctx.fillStyle = "rgba(210,235,245,0.45)";
      for (const p of parts) {
        const phase = (t + p.ph * 4) / 4;
        const yy = ((p.y + phase * 8) % (h + 60)) - 30;
        const xx = p.x + Math.sin(phase * 3) * 10;
        ctx.fillRect(xx, yy, 1.5, 1.5);
      }
    } else if (id === "glacier") {
      // Snowflakes.
      make(50);
      ctx.fillStyle = "rgba(225,240,250,0.7)";
      for (const p of parts) {
        const phase = (t + p.ph * 7) / 2;
        const yy = ((p.y + phase * 16) % (h + 60)) - 30;
        const xx = p.x + Math.sin(phase * 2) * 6;
        ctx.fillRect(xx, yy, 2, 2);
      }
    } else if (id === "graveyard") {
      // Pale drifting motes.
      make(30);
      ctx.fillStyle = "rgba(200,195,215,0.5)";
      for (const p of parts) {
        const phase = (t + p.ph * 3) / 4;
        const yy = ((p.y + phase * 10) % (h + 60)) - 30;
        const xx = p.x + Math.sin(phase * 5) * 14;
        ctx.fillRect(xx, yy, 2, 2);
      }
    } else if (id === "volcano") {
      // Falling ash.
      make(45);
      ctx.fillStyle = "rgba(180,90,60,0.6)";
      for (const p of parts) {
        const phase = (t + p.ph * 8) / 1.8;
        const yy = ((p.y + phase * 20) % (h + 60)) - 30;
        const xx = (p.x + phase * 10) % (w + 60) - 30;
        ctx.fillRect(xx, yy, 2, 1.5);
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- frame */

  render(run) {
    const ctx = this.ctx;
    const p = run.player;

    // Camera
    const targetX = p.x;
    const targetZ = p.z - 1.5;
    this.camX = lerp(this.camX, targetX, 0.12);
    this.camZ = lerp(this.camZ, targetZ, 0.12);

    this.shake = Math.max(0, this.shake - 0.02);
    const sh = run.shakeAmount ?? 0;
    if (sh > 0) run.shakeAmount = Math.max(0, sh - 0.02);
    const sx = (Math.random() - 0.5) * this.shake * 18;
    const sy = (Math.random() - 0.5) * this.shake * 18;

    ctx.save();
    ctx.translate(sx, sy);

    this.drawTerrain(run);
    this.drawPickups(run);
    this.drawEvents(run);
    this.drawEggs(run);

    // Entities sorted by depth.
    const drawables = [];
    for (const e of run.enemies) if (e.alive) drawables.push({ z: e.z, fn: () => this.drawEnemy(run, e) });
    if (run.allies?.list) {
      for (const a of run.allies.list) drawables.push({ z: a.z, fn: () => this.drawAlly(run, a) });
    }
    drawables.push({ z: p.z, fn: () => this.drawPlayer(run) });
    drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) d.fn();

    this.drawProjectiles(run);
    this.drawEffects(run);
    this.drawFloaters(run);
    ctx.restore();

    this.drawWeather(run);
    this.drawAmbient(run);
    this.drawNightTint(run);
    this.drawVignette();
    this.drawCompass(run);
  }

  /**
   * Compass for the event the zone map follows: over it while on screen, pinned to the
   * screen edge in its direction otherwise, with the distance in metres (world units).
   */
  drawCompass(run) {
    const events = run.events;
    const ev = events?.followId != null ? events.events.find((x) => x.id === events.followId) : null;
    const kind = ev && MAP_KINDS[ev.kind];
    if (!kind) return;
    const ctx = this.ctx;
    const s = this.worldToScreen(ev.x, ev.z);
    const m = 46;
    let x = s.x;
    let y = s.y - this.zoom * 2.6;
    const inside = x > m && x < this.w - m && y > m && y < this.h - m;
    const d = Math.round(Math.hypot(ev.x - run.player.x, ev.z - run.player.z));
    if (inside && d < 4) return; // arrived: the event's own hint takes over
    let ang = null;
    if (!inside) {
      const dx = x - this.w / 2;
      const dy = y - this.h / 2;
      const t = Math.min((this.w / 2 - m) / Math.abs(dx || 1e-6), (this.h / 2 - m) / Math.abs(dy || 1e-6));
      x = this.w / 2 + dx * t;
      y = this.h / 2 + dy * t;
      ang = Math.atan2(dy, dx);
    }
    ctx.save();
    if (ang != null) {
      ctx.fillStyle = "#ffd23a";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * 24, y + Math.sin(ang) * 24);
      ctx.lineTo(x + Math.cos(ang + 0.45) * 15, y + Math.sin(ang + 0.45) * 15);
      ctx.lineTo(x + Math.cos(ang - 0.45) * 15, y + Math.sin(ang - 0.45) * 15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(20,16,40,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kind.color;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kind.glyph, x, y + 0.5);
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(20,16,40,0.85)";
    ctx.fillRect(x - 20, y + 17, 40, 15);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${d} m`, x, y + 25);
    ctx.restore();
  }

  /** Subtle edge darkening to focus the play field. */
  drawVignette() {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      Math.min(this.w, this.h) * 0.34,
      this.w / 2,
      this.h / 2,
      Math.max(this.w, this.h) * 0.78
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(6,4,18,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  /** Day/night cycle: the world clock advances one in-game minute per second. */
  drawNightTint(run) {
    const hour = (8 + run.time / 60) % 24;
    let darkness = 0;
    if (hour < 6) darkness = 0.55;
    else if (hour < 8) darkness = 0.55 * ((8 - hour) / 2);
    else if (hour > 20) darkness = 0.55 * ((hour - 20) / 4);
    else if (hour > 18) darkness = 0.55 * ((hour - 18) / 2);
    if (darkness <= 0.01) return;
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.15,
      this.w / 2,
      this.h / 2,
      this.h * 0.95
    );
    g.addColorStop(0, `rgba(20,24,70,${darkness * 0.35})`);
    g.addColorStop(1, `rgba(10,12,48,${darkness})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
