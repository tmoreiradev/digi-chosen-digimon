// Generates art with the Codex CLI (image generation) and drops it into assets/ in the layouts the
// engine reads (SpriteCollab folders, 40x40 portraits).
//
//   node scripts/codex-sprites.mjs [--kind walk|portrait|action] [--only id,id] [--redo] [--workers 2] [--limit n]
//
// walk: 4x8 walk sheet (32x40 cells) from Guilmon's NSS sheet (style, grid, direction order) and the
//   Digimon's portrait. action: 6x8 sheet from the Digimon's own walk sheet, cut into Attack (4 frames),
//   Hurt and Faint. portrait: 40x40 face from two NSS portraits and the Digimon's walk sheet.
// Resumable: species that already have the art are skipped unless --redo (the old art stays when a
// redo fails: every result is checked in a temp folder before it reaches assets/).
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
const kind = opt("--kind", "walk");
const redo = args.includes("--redo");

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
const spriteDir = (id) => path.join(ASSETS, "sprites", String(id));
const has = {
  walk: (id) => fs.existsSync(path.join(spriteDir(id), "AnimData.xml")),
  portrait: (id) => fs.existsSync(path.join(ASSETS, "portraits", `${id}.png`)),
  // NSS folders draw their own actions (they have an Idle-Anim.png); generated ones need a walk sheet first.
  action: (id) => fs.existsSync(path.join(spriteDir(id), "Attack-Anim.png")) || !fs.existsSync(path.join(spriteDir(id), "Walk-Anim.png")),
}[kind];
const queue = ids
  .filter((s) => (only ? only.has(s.id) : true))
  .filter((s) => (redo ? true : !has(s.id)))
  .filter((s) => kind !== "action" || !fs.existsSync(path.join(spriteDir(s.id), "Idle-Anim.png")))
  .sort((a, b) => Number(!partnerFamilies.has(rootOf(a.key))) - Number(!partnerFamilies.has(rootOf(b.key))) || a.id - b.id)
  .slice(0, limit);

const WALK_ANIMS = `    <Anim><Name>Walk</Name><Index>0</Index><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>8</Duration><Duration>10</Duration><Duration>8</Duration><Duration>10</Duration></Durations></Anim>
    <Anim><Name>Idle</Name><Index>1</Index><CopyOf>Walk</CopyOf></Anim>
`;
const ACTION_ANIMS = `    <Anim><Name>Attack</Name><Index>2</Index><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>4</Duration><Duration>4</Duration><Duration>6</Duration><Duration>8</Duration></Durations></Anim>
    <Anim><Name>Hurt</Name><Index>3</Index><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>12</Duration></Durations></Anim>
    <Anim><Name>Faint</Name><Index>4</Index><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>30</Duration></Durations></Anim>
`;
const animData = (anims) => `<?xml version="1.0"?>
<AnimData>
  <ShadowSize>1</ShadowSize>
  <Anims>
${anims}  </Anims>
</AnimData>
`;
const DIRECTIONS = "down (facing the viewer), down-right, right (side view), up-right, up (seen from behind, no face visible), up-left, left (side view), down-left";

function promptFor(s, refs) {
  const intro = `You are making fan-game pixel art of the Digimon ${s.name} (${STAGES[s.stage]} level). ${s.flavor}`;
  const save = (file, size) => `Use image generation for the art, save the raw image as raw.png, then produce ${file} at exactly ${size} with transparency using nearest-neighbour resizing (ImageMagick 'magick' is available). No text, grid lines or margins. Reply briefly with what you produced.`;
  if (kind === "portrait") {
    return [
      intro,
      `The first two attached images are 40x40 face portraits from the same fan collection: a close-up of the head and shoulders, bold dark outline, flat pixel shading, a soft pastel gradient background (never plain white).`,
      `The third attached image is ${s.name}'s walk sheet in this game: match its colours and features.`,
      `Draw ${s.name}'s portrait in exactly that style: head and shoulders, facing slightly toward the viewer, neutral expression, recognisably ${s.name} as in the Digimon anime and games.`,
      save("portrait.png", "40x40"),
    ].join("\n\n");
  }
  if (kind === "action") {
    return [
      intro,
      `The attached image is ${s.name}'s walk sheet in this game: 4 frames across and 8 rows, one per facing direction in this order: ${DIRECTIONS}. Each cell is 32x40 pixels.`,
      `Create ${s.name}'s POSE sheet for a cute all-ages game, in exactly the same style, colours and size: 6 columns and the same 8 rows (directions in the same order), cells of 32x40 (192x320 PNG), transparent background. Columns 1-4: ${s.name}'s signature special move, powering up then releasing it toward the row's direction (a dash, a spin or a glowing breath, whatever fits ${s.name}). Column 5: knocked back in surprise, eyes shut. Column 6: resting, lying down on the ground asleep. Keep the whole body inside each cell, feet near the bottom.`,
      save("action.png", "192x320"),
    ].join("\n\n");
  }
  return [
    intro,
    `The first attached image (reference.png) is a Pokémon-Mystery-Dungeon-style walk sheet of Guilmon: 4 frames across, 8 rows, one per facing direction in this order: ${DIRECTIONS}. Each cell is 32x40 pixels, transparent background, dark outline, about 15 colours.`,
    refs.includes("portrait.png") ? `The second attached image is ${s.name}'s face portrait: match its colours and features exactly.` : `Draw ${s.name} as it looks in the Digimon anime and games.`,
    `Create the SAME KIND of sheet for ${s.name}: full body, recognisably ${s.name}, the same pixel style and the same 4x8 grid of 32x40 cells (128x320 PNG), transparent background, a walking cycle in every row with the legs (or wings) clearly moving between frames. Every row must really turn ${s.name} toward its direction, like the reference: front view in row 1, side views in rows 3 and 7, the back (no face) in row 5, three-quarter views in between. Large Digimon are drawn smaller so the whole body fits inside each cell, feet near the bottom of the cell.`,
    save("walk.png", "128x320"),
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

/** Cells (fw x fh) with fewer than 40 opaque pixels. */
function emptyCells({ w, h, px }, fw, fh) {
  let n = 0;
  for (let cy = 0; cy < h; cy += fh) {
    for (let cx = 0; cx < w; cx += fw) {
      let c = 0;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) c += px[((cy + y) * w + cx + x) * 4 + 3] > 0 ? 1 : 0;
      n += c < 40 ? 1 : 0;
    }
  }
  return n;
}

const toPng32 = (src, size, out) =>
  execFileSync("magick", [src, "-filter", "point", "-resize", `${size}!`, "-define", "png:color-type=6", "-depth", "8", `PNG32:${out}`]);

/** Generate one piece of art; true when it reached assets/. */
async function one(s) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `digi-${kind}-${s.id}-`));
  const refs = [];
  const ref = (from, as) => {
    if (!fs.existsSync(from)) return;
    fs.copyFileSync(from, path.join(dir, as));
    refs.push(as);
  };
  const walkSheet = path.join(spriteDir(s.id), "Walk-Anim.png");
  if (kind === "portrait") {
    ref(path.join(ASSETS, "portraits", "1.png"), "style1.png"); // Agumon (NSS)
    ref(path.join(ASSETS, "portraits", "23.png"), "style2.png"); // Guilmon (NSS)
    ref(walkSheet, "sheet.png");
  } else if (kind === "action") {
    ref(walkSheet, "sheet.png");
  } else {
    ref(REFERENCE, "reference.png");
    ref(path.join(ASSETS, "portraits", `${s.id}.png`), "portrait.png");
  }
  const code = await runCodex(dir, promptFor(s, refs), refs);
  const made = path.join(dir, { walk: "walk.png", portrait: "portrait.png", action: "action.png" }[kind]);
  if (!fs.existsSync(made)) {
    log(`FAIL ${kind} ${s.id} ${s.name}: nothing produced (codex exit ${code}; see ${dir})`);
    return false;
  }
  // The engine's PNG reader wants 8-bit RGBA: normalise whatever Codex saved (palette, 16-bit…), check, then copy.
  const size = { walk: "128x320", portrait: "40x40", action: "192x320" }[kind];
  const out = path.join(dir, "out.png");
  toPng32(made, size, out);
  if (kind !== "portrait") recellFile(out);
  const img = readPng(out);
  let opaque = 0;
  for (let i = 3; i < img.px.length; i += 4) opaque += img.px[i] > 0 ? 1 : 0;
  const empty = kind === "portrait" ? 0 : emptyCells(img, 32, 40);
  const area = img.w * img.h;
  if (opaque < area * (kind === "portrait" ? 0.3 : 0.05) || opaque > area * (kind === "portrait" ? 1 : 0.8) || empty > 0) {
    log(`FAIL ${kind} ${s.id} ${s.name}: bad image (${img.w}x${img.h}, ${opaque} opaque px, ${empty} empty cells; see ${dir})`);
    return false;
  }
  if (kind === "portrait") {
    fs.copyFileSync(out, path.join(ASSETS, "portraits", `${s.id}.png`));
  } else if (kind === "action") {
    const crop = (x, w, name) =>
      execFileSync("magick", [out, "-crop", `${w}x320+${x}+0`, "+repage", "-define", "png:color-type=6", `PNG32:${path.join(spriteDir(s.id), name)}`]);
    crop(0, 128, "Attack-Anim.png");
    crop(128, 32, "Hurt-Anim.png");
    crop(160, 32, "Faint-Anim.png");
    fs.writeFileSync(path.join(spriteDir(s.id), "AnimData.xml"), animData(WALK_ANIMS + ACTION_ANIMS));
  } else {
    fs.mkdirSync(spriteDir(s.id), { recursive: true });
    fs.copyFileSync(out, walkSheet);
    const actions = fs.existsSync(path.join(spriteDir(s.id), "Attack-Anim.png"));
    fs.writeFileSync(path.join(spriteDir(s.id), "AnimData.xml"), animData(WALK_ANIMS + (actions ? ACTION_ANIMS : "")));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  log(`OK ${kind} ${s.id} ${s.name}`);
  return true;
}

// A failed regeneration (the generator being edited meanwhile) must not stop a long batch.
const regenerate = () => {
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "make-digimon-data.mjs")], { stdio: "inherit" });
  } catch (e) {
    log(`WARN data not regenerated: ${e.message.split("\n")[0]}`);
  }
};

log(`start ${kind}: ${queue.length} Digimon, ${workers} at a time`);
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
log(`end ${kind}: ${ok} of ${queue.length} made`);
