// Re-cuts a generated walk sheet whose drawings drifted off the 32x40 grid (a row's feet poking into
// the cell below, a sprite split across two cells). Every 8-connected blob of opaque pixels goes to the
// cell holding its centroid; each cell is then re-placed centred, feet one pixel above the bottom.
// Alpha is made hard (pixel art): the generated art comes with a faint haze that would glue every
// drawing into one blob, and a 240-254 alpha that would let the map show through.
//
//   node scripts/recell.mjs <id> [<id>…]     fix assets/sprites/<id>/Walk-Anim.png in place
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readPng } from "./nss.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** RGBA pixels of a w x h sheet of fw x fh cells, re-cut as described above. */
export function recellPixels({ w, h, px }, fw = 32, fh = 40) {
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] >= 128 ? 255 : 0;
  const cols = Math.floor(w / fw);
  const rows = Math.floor(h / fh);
  const seen = new Uint8Array(w * h);
  const cells = Array.from({ length: cols * rows }, () => []);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || px[start * 4 + 3] === 0) continue;
    const blob = [start];
    seen[start] = 1;
    for (let i = 0; i < blob.length; i++) {
      const x = blob[i] % w;
      const y = (blob[i] - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (seen[n] || px[n * 4 + 3] === 0) continue;
          seen[n] = 1;
          blob.push(n);
        }
      }
    }
    let sx = 0;
    let sy = 0;
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (const p of blob) {
      const x = p % w;
      const y = Math.floor(p / w);
      sx += x;
      sy += y;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    // Drawings that touch across a cell line form one blob bigger than a cell: cut it on the grid
    // (moving it whole would leave the neighbour's cell empty).
    if (x1 - x0 >= fw * 1.25 || y1 - y0 >= fh * 1.25) {
      for (const p of blob) cells[Math.min(rows - 1, Math.floor(Math.floor(p / w) / fh)) * cols + Math.min(cols - 1, Math.floor((p % w) / fw))].push(p);
      continue;
    }
    const c = Math.min(cols - 1, Math.floor(sx / blob.length / fw));
    const r = Math.min(rows - 1, Math.floor(sy / blob.length / fh));
    cells[r * cols + c].push(...blob);
  }
  const out = Buffer.alloc(px.length);
  cells.forEach((pixels, i) => {
    if (!pixels.length) return;
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (const p of pixels) {
      const x = p % w;
      const y = Math.floor(p / w);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const cx = (i % cols) * fw;
    const cy = Math.floor(i / cols) * fh;
    const dx = cx + Math.floor((fw - (x1 - x0 + 1)) / 2) - x0;
    const dy = cy + fh - 2 - y1; // feet on the cell's second-to-last row; a too-tall drawing loses its top
    for (const p of pixels) {
      const x = (p % w) + dx;
      const y = Math.floor(p / w) + dy;
      if (x < cx || x >= cx + fw || y < cy || y >= cy + fh) continue;
      px.copy(out, (y * w + x) * 4, p * 4, p * 4 + 4);
    }
  });
  fillEmptyCells(out, w, cols, rows, fw, fh);
  return out;
}

/** Cells left with (almost) nothing borrow a frame: another frame of the row, else the mirrored row. */
function fillEmptyCells(px, w, cols, rows, fw, fh) {
  const count = (c, r) => {
    let n = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) n += px[((r * fh + y) * w + c * fw + x) * 4 + 3] ? 1 : 0;
    return n;
  };
  const copy = (fc, fr, tc, tr, mirror) => {
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const from = ((fr * fh + y) * w + fc * fw + (mirror ? fw - 1 - x : x)) * 4;
        px.copy(px, ((tr * fh + y) * w + tc * fw + x) * 4, from, from + 4);
      }
    }
  };
  const drawn = (c, r) => count(c, r) >= 40;
  // PMD rows: down, down-right, right, up-right, up, up-left, left, down-left; 8 - r mirrors r.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (drawn(c, r)) continue;
      // The nearest frame, left first: an action sheet's empty attack frame takes the attack before it,
      // never the hurt or faint columns further right.
      const other = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5].map((k) => c + k).find((k) => k >= 0 && k < cols && drawn(k, r));
      const mr = rows === 8 ? (8 - r) % 8 : -1;
      if (other != null) copy(other, r, c, r, false);
      else if (mr >= 0 && drawn(c, mr)) copy(c, mr, c, r, mr !== r);
    }
  }
}

/** Drawn height of a cell (bottom-most opaque row minus top-most, +1); 0 when empty. */
function cellHeight({ w, px }, c, r, fw, fh) {
  let y0 = fh, y1 = -1;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (!px[((r * fh + y) * w + c * fw + x) * 4 + 3]) continue;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return y1 < 0 ? 0 : y1 - y0 + 1;
}

/**
 * Cuts the image model's raw art (any size, `cols` x `rows` drawings on an even grid) into fw x fh cells:
 * each drawing is scaled whole, nearest neighbour, so the row's first frame stands as tall as the median
 * frame of the same row in `ref` (the walk sheet), feet one pixel above the cell bottom, centred. Squeezing
 * the raw art into the sheet's size instead flattens it (the model draws wide cells, never 1:5 sheets),
 * and an idle drawn at another height would make the Digimon grow each time it starts walking.
 * Returns the pixels and the lowest share of the wanted height reached (below 1 when a wide drawing
 * had to be shrunk to fit the cell's width).
 */
export function cutRaw(raw, ref, cols, rows, fw = 32, fh = 40) {
  const w = cols * fw;
  const out = Buffer.alloc(w * rows * fh * 4);
  // 8-connected blobs, each to the cell of the raw grid holding its centroid (drawings cross the lines).
  const label = new Int32Array(raw.w * raw.h).fill(-1);
  const blobs = [];
  for (let start = 0; start < raw.w * raw.h; start++) {
    if (label[start] >= 0 || raw.px[start * 4 + 3] < 128) continue;
    const id = blobs.length;
    const stack = [start];
    label[start] = id;
    let n = 0, sx = 0, sy = 0, x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % raw.w;
      const y = (p - x) / raw.w;
      n++; sx += x; sy += y;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= raw.w || ny >= raw.h) continue;
          const q = ny * raw.w + nx;
          if (label[q] >= 0 || raw.px[q * 4 + 3] < 128) continue;
          label[q] = id;
          stack.push(q);
        }
      }
    }
    const cell = Math.min(rows - 1, Math.floor(sy / n / (raw.h / rows))) * cols + Math.min(cols - 1, Math.floor(sx / n / (raw.w / cols)));
    blobs.push({ n, cell, x0, x1, y0, y1 });
  }
  // A cell keeps its drawing: blobs of at least 3% of its biggest (specks of glow and stray pixels go).
  const keep = new Uint8Array(blobs.length);
  const boxes = Array.from({ length: cols * rows }, () => null);
  for (let cell = 0; cell < cols * rows; cell++) {
    const mine = blobs.map((bl, i) => [bl, i]).filter(([bl]) => bl.cell === cell);
    const big = Math.max(0, ...mine.map(([bl]) => bl.n));
    for (const [bl, i] of mine) {
      if (bl.n < big * 0.03) continue;
      keep[i] = 1;
      const b = boxes[cell] ?? { x0: Infinity, x1: -1, y0: Infinity, y1: -1 };
      boxes[cell] = { x0: Math.min(b.x0, bl.x0), x1: Math.max(b.x1, bl.x1), y0: Math.min(b.y0, bl.y0), y1: Math.max(b.y1, bl.y1) };
    }
  }
  let reached = 1;
  for (let r = 0; r < rows; r++) {
    const row = boxes.slice(r * cols, (r + 1) * cols).map((b) => b && { ...b, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 });
    if (!row[0]) continue;
    const want = Array.from({ length: Math.floor(ref.w / fw) }, (_, c) => cellHeight(ref, c, r, fw, fh)).sort((a, b) => a - b);
    const target = Math.min(fh - 2, want[Math.floor(want.length / 2)] || fh - 2);
    // One scale per row, so the frames keep their difference (the breath).
    let k = target / row[0].h;
    for (const b of row) if (b) k = Math.min(k, (fw - 2) / b.w, (fh - 2) / b.h);
    reached = Math.min(reached, (row[0].h * k) / target);
    row.forEach((b, c) => {
      if (!b) return;
      const cell = r * cols + c;
      const dw = Math.max(1, Math.round(b.w * k));
      const dh = Math.max(1, Math.round(b.h * k));
      const ox = c * fw + Math.floor((fw - dw) / 2);
      const oy = r * fh + fh - 1 - dh;
      for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
          const sx = b.x0 + Math.min(b.w - 1, Math.floor((x + 0.5) / k));
          const sy = b.y0 + Math.min(b.h - 1, Math.floor((y + 0.5) / k));
          const l = label[sy * raw.w + sx];
          if (l < 0 || !keep[l] || blobs[l].cell !== cell) continue; // hard alpha; the neighbours' pixels stay out
          const i = (sy * raw.w + sx) * 4;
          const o = ((oy + y) * w + ox + x) * 4;
          raw.px.copy(out, o, i, i + 3);
          out[o + 3] = 255;
        }
      }
    });
  }
  return { px: out, reached };
}

/**
 * A 2-frame idle drawn from the walk sheet, for species the image model keeps drawing too wide:
 * per direction, the walk's first frame, then the same drawing one pixel taller (the breath), feet fixed.
 */
export function idleFromWalk(walk, fw = 32, fh = 40) {
  const w = fw * 2;
  const out = new Uint8Array(w * fh * 8 * 4);
  const at = (x, y) => (y * walk.w + x) * 4;
  const put = (x, y, src) => out.set(walk.px.subarray(src, src + 4), (y * w + x) * 4);
  for (let r = 0; r < 8; r++) {
    let top = fh;
    let bottom = -1;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (walk.px[at(x, r * fh + y) + 3] < 128) continue;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (bottom < 0) continue;
    const h = bottom - top + 1;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        put(x, r * fh + y, at(x, r * fh + y));
        if (y < top - 1 || y > bottom || top === 0) continue; // a drawing already at the top edge breathes in place
        put(fw + x, r * fh + y, at(x, r * fh + bottom - Math.round(((bottom - y) * h) / (h + 1))));
      }
    }
    if (top === 0) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) put(fw + x, r * fh + y, at(x, r * fh + y));
  }
  return out;
}

/** Write w x h RGBA pixels as an 8-bit RGBA PNG (through ImageMagick). */
export function writeRgba(file, w, h, px) {
  const raw = `${file}.rgba`;
  fs.writeFileSync(raw, px);
  execFileSync("magick", ["-size", `${w}x${h}`, "-depth", "8", `rgba:${raw}`, "-define", "png:color-type=6", `PNG32:${file}`]);
  fs.rmSync(raw);
}

/** Re-cut a sheet file in place. */
export function recellFile(file) {
  const img = readPng(file);
  writeRgba(file, img.w, img.h, recellPixels(img));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const id of process.argv.slice(2)) recellFile(path.join(ROOT, "assets", "sprites", id, "Walk-Anim.png"));
}
