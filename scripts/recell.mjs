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
    for (const p of blob) {
      sx += p % w;
      sy += Math.floor(p / w);
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
  return out;
}

/** Re-cut a sheet file in place (written back as 8-bit RGBA through ImageMagick). */
export function recellFile(file) {
  const img = readPng(file);
  const raw = `${file}.rgba`;
  fs.writeFileSync(raw, recellPixels(img));
  execFileSync("magick", ["-size", `${img.w}x${img.h}`, "-depth", "8", `rgba:${raw}`, "-define", "png:color-type=6", `PNG32:${file}`]);
  fs.rmSync(raw);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const id of process.argv.slice(2)) recellFile(path.join(ROOT, "assets", "sprites", id, "Walk-Anim.png"));
}
