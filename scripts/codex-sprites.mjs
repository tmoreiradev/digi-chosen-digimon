// Generates overworld walk sheets with the Codex CLI (image generation) for every Digimon that has
// no sheet yet, and drops them into assets/sprites/<id>/ in the SpriteCollab layout the engine reads.
//
//   node scripts/codex-sprites.mjs [--only id,id] [--workers 2] [--limit n]
//
// Reference: Guilmon's NSS walk sheet (style, 4x8 grid of 32x40 cells, direction order) plus the
// Digimon's own portrait when it has one. Resumable: species with an AnimData.xml are skipped.
// Every 5 sheets (and at the end) it regenerates src/data, so the game picks them up as they land.
// Needs `codex` and ImageMagick's `magick` on PATH (dev-time only; the game stays dependency-free).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SPECIES, ROSTER } from "./digimon-species.mjs";
import { readPng } from "./nss.mjs";
import { recellFile } from "./recell.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");
const LOG = path.join(ROOT, "assets", "codex-sprites.log"); // outside sprites/, which ships in dist/
const REFERENCE = path.join(ASSETS, "sprites", "23", "Walk-Anim.png"); // Guilmon (NSS)
const STAGES = ["Rookie", "Champion", "Ultimate", "Mega"];

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const only = opt("--only", "") ? new Set(opt("--only").split(",").map(Number)) : null;
const workers = Number(opt("--workers", 2));
const limit = Number(opt("--limit", Infinity));

const log = (line) => {
  fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
  console.log(line);
};

// Partner lines first (the player sees them most), then the rest in roster order.
const ids = SPECIES.map((s, i) => ({ id: i + 1, key: s[0], name: s[1], stage: s[2], flavor: s[8] }));
const partnerFamilies = new Set(ROSTER.map((r) => r.key));
const rootOf = (key) => {
  let k = key;
  for (let row = SPECIES.find((s) => s[0] === k); row?.[7]; row = SPECIES.find((s) => s[0] === k)) k = row[7];
  return k;
};
const queue = ids
  .filter((s) => (only ? only.has(s.id) : true))
  .filter((s) => !fs.existsSync(path.join(ASSETS, "sprites", String(s.id), "AnimData.xml")))
  .sort((a, b) => Number(!partnerFamilies.has(rootOf(a.key))) - Number(!partnerFamilies.has(rootOf(b.key))) || a.id - b.id)
  .slice(0, limit);

const ANIMDATA = `<?xml version="1.0"?>
<AnimData>
  <ShadowSize>1</ShadowSize>
  <Anims>
    <Anim><Name>Walk</Name><Index>0</Index><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>8</Duration><Duration>10</Duration><Duration>8</Duration><Duration>10</Duration></Durations></Anim>
    <Anim><Name>Idle</Name><Index>1</Index><CopyOf>Walk</CopyOf></Anim>
  </Anims>
</AnimData>
`;

function promptFor(s, hasPortrait) {
  return [
    `You are making a fan-game sprite of the Digimon ${s.name} (${STAGES[s.stage]} level). ${s.flavor}`,
    `The first attached image (reference.png) is a Pokémon-Mystery-Dungeon-style walk sheet of Guilmon: 4 frames across, 8 rows, one per facing direction in this order: down, down-right, right, up-right, up, up-left, left, down-left. Each cell is 32x40 pixels, transparent background, dark outline, about 15 colours.`,
    hasPortrait ? `The second attached image is ${s.name}'s face portrait: match its colours and features exactly.` : `Draw ${s.name} as it looks in the Digimon anime and games.`,
    `Create the SAME KIND of sheet for ${s.name}: full body, recognisably ${s.name}, the same pixel style and the same 4x8 grid of 32x40 cells (128x320 PNG), transparent background, a walking cycle in every row facing that row's direction, with the legs (or wings) clearly moving between frames. Large Digimon are drawn smaller so the whole body fits inside each cell, feet near the bottom of the cell.`,
    `Use image generation for the art, save the raw image as raw.png, then produce walk.png at exactly 128x320 with transparency using nearest-neighbour resizing (ImageMagick 'magick' is available). No text, grid lines or margins. Reply briefly with what you produced.`,
  ].join("\n\n");
}

function runCodex(dir, prompt, images) {
  return new Promise((resolve) => {
    // The prompt goes through stdin (codex reads it there without a positional prompt): on Windows the
    // shell needed to find codex.cmd would mangle its quotes and line breaks as an argument.
    const argv = ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", dir];
    for (const img of images) argv.push("-i", img);
    const child = spawn("codex", argv, { cwd: dir, stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
    child.stdin.end(prompt);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      fs.writeFileSync(path.join(dir, "codex.log"), out);
      resolve(code);
    });
  });
}

/** Generate one sheet; true when assets/sprites/<id>/ got a valid one. */
async function one(s) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `digi-${s.id}-`));
  fs.copyFileSync(REFERENCE, path.join(dir, "reference.png"));
  const images = ["reference.png"];
  const portrait = path.join(ASSETS, "portraits", `${s.id}.png`);
  if (fs.existsSync(portrait)) {
    fs.copyFileSync(portrait, path.join(dir, "portrait.png"));
    images.push("portrait.png");
  }
  const code = await runCodex(dir, promptFor(s, images.length > 1), images);
  const walk = path.join(dir, "walk.png");
  if (!fs.existsSync(walk)) {
    log(`FAIL ${s.id} ${s.name}: no walk.png (codex exit ${code}; see ${dir})`);
    return false;
  }
  // The engine's PNG reader wants 8-bit RGBA: normalise whatever Codex saved (palette, 16-bit…).
  const dest = path.join(ASSETS, "sprites", String(s.id));
  fs.mkdirSync(dest, { recursive: true });
  const out = path.join(dest, "Walk-Anim.png");
  execFileSync("magick", [walk, "-filter", "point", "-resize", "128x320!", "-define", "png:color-type=6", "-depth", "8", `PNG32:${out}`]);
  recellFile(out);
  const img = readPng(out);
  let opaque = 0;
  let emptyCells = 0;
  for (let i = 3; i < img.px.length; i += 4) opaque += img.px[i] > 0 ? 1 : 0;
  for (let cell = 0; cell < 32; cell++) {
    let n = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) n += img.px[((Math.floor(cell / 4) * 40 + y) * 128 + (cell % 4) * 32 + x) * 4 + 3] > 0 ? 1 : 0;
    emptyCells += n < 40 ? 1 : 0;
  }
  if (img.w !== 128 || img.h !== 320 || opaque < 2000 || opaque > 128 * 320 * 0.8 || emptyCells > 0) {
    fs.rmSync(dest, { recursive: true, force: true });
    log(`FAIL ${s.id} ${s.name}: bad sheet (${img.w}x${img.h}, ${opaque} opaque px, ${emptyCells} empty cells; see ${dir})`);
    return false;
  }
  fs.writeFileSync(path.join(dest, "AnimData.xml"), ANIMDATA);
  fs.rmSync(dir, { recursive: true, force: true });
  log(`OK ${s.id} ${s.name}`);
  return true;
}

const regenerate = () => execFileSync(process.execPath, [path.join(ROOT, "scripts", "make-digimon-data.mjs")], { stdio: "inherit" });

log(`start: ${queue.length} Digimon to draw, ${workers} at a time`);
let done = 0;
let ok = 0;
const pending = [...queue];
await Promise.all(
  Array.from({ length: Math.max(1, workers) }, async () => {
    while (pending.length) {
      const s = pending.shift();
      if (await one(s)) ok++;
      if (++done % 5 === 0) regenerate();
    }
  })
);
regenerate();
log(`end: ${ok} of ${queue.length} sheets made`);
