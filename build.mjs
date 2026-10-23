// Bundles the build into a single self-contained HTML file that runs from file://.
//
// The ES modules are concatenated in dependency order (all top-level names are
// unique across the project), import/export statements are stripped, and the
// data tables are embedded as a global so no fetch is needed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "dist", "digi-chosen.html");

const MODULE_ORDER = [
  "src/core/math.js",
  "src/core/rng.js",
  "src/ui/dom.js",
  "src/render/palette.js",
  "src/render/sprites.js",
  "src/render/creature.js",
  "src/game/rules.js",
  "src/data/game-data.js",
  "src/game/director.js",
  "src/game/boss.js",
  "src/game/capture.js",
  "src/game/tower.js",
  "src/game/events.js",
  "src/game/achievements.js",
  "src/game/fusion.js",
  "src/game/vitamins.js",
  "src/game/run.js",
  "src/render/renderer.js",
  "src/ui/hud.js",
  "src/ui/pokedex.js",
  "src/ui/levelup.js",
  "src/ui/account.js",
  "src/ui/screens.js",
  "src/audio/sfx.js",
  "src/audio/music.js",
  "src/main.js",
];

const DATA_FILES = ["pokemon", "moves", "learnsets", "abilities", "types", "items", "rules", "sprites", "sprite-bounds"];

function stripModuleSyntax(code) {
  // Drop import statements (single or multi line).
  let out = code.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
  out = out.replace(/^import\s+["'][^"']+["'];?\s*$/gm, "");
  // Turn `export const/let/function/class/async function` into plain declarations.
  out = out.replace(/^export\s+(async\s+function|function|class|const|let|var)\b/gm, "$1");
  // Drop `export { ... };` blocks.
  out = out.replace(/^export\s*\{[^}]*\};?\s*$/gm, "");
  return out;
}

const parts = [];
for (const rel of MODULE_ORDER) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  parts.push(`// ---- ${rel} ${"-".repeat(Math.max(0, 60 - rel.length))}\n${stripModuleSyntax(code).trim()}`);
}

const data = {};
for (const name of DATA_FILES) {
  data[name] = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", `${name}.json`), "utf8"));
}

const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#1a1630" />
<title>Digi Chosen</title>
<style>
${css}
</style>
</head>
<body>
<canvas id="game"></canvas>
<div id="ui"></div>
<div id="hud" class="hud"></div>
<div id="levelup" class="levelup"></div>
<div id="screens" class="screens"></div>
<script>
globalThis.__POKEBONK_DATA__ = ${JSON.stringify(data)};
</script>
<script type="module">
${parts.join("\n\n")}
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

// Ship the sprite sheets next to the bundle so it keeps working from file://.
for (const dir of ["pmd", "front"]) {
  const src = path.join(ROOT, "assets", dir);
  const dest = path.join(ROOT, "dist", dir);
  if (fs.existsSync(src)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
  }
}

const sheetCount = fs.existsSync(path.join(ROOT, "dist", "pmd"))
  ? fs.readdirSync(path.join(ROOT, "dist", "pmd")).length
  : 0;
console.log(`Built ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB, ${sheetCount} sprites)`);
