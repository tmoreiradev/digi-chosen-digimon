// Verifies dist/digi-chosen.html against the current sources:
//   1. the embedded module script parses (`node --check`);
//   2. the script is exactly what build.mjs would produce from today's modules;
//   3. the embedded data tables and CSS match src/data/*.json and styles.css.
// Usage: node scripts/check-bundle.mjs   (exit code 1 on any mismatch)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { OUT, bundleScript, bundleData, MODULE_ORDER, DATA_FILES } from "../build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error("check-bundle: " + msg);
  process.exit(1);
}

if (!fs.existsSync(OUT)) fail(`${path.relative(ROOT, OUT)} not found. Run: npm run build`);
const html = fs.readFileSync(OUT, "utf8");

const script = html.match(/<script type="module">\n([\s\S]*?)\n<\/script>\n<\/body>/);
if (!script) fail("module script not found in the bundle");

// 1. Syntax of the generated JavaScript.
const tmp = path.join(os.tmpdir(), `digi-chosen-check-${process.pid}.mjs`);
fs.writeFileSync(tmp, script[1]);
const check = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
fs.unlinkSync(tmp);
if (check.status !== 0) fail("the bundled script has a syntax error:\n" + check.stderr);

// 2. Script matches the current sources.
const stale = [];
if (script[1] !== bundleScript()) stale.push("JavaScript (one of " + MODULE_ORDER.length + " modules)");

// 3. Data tables and CSS match.
const dataMatch = html.match(/globalThis\.__POKEBONK_DATA__ = (\{[\s\S]*?\});\n<\/script>/);
if (!dataMatch) fail("data block not found in the bundle");
if (dataMatch[1] !== JSON.stringify(bundleData())) stale.push("data tables (" + DATA_FILES.join(", ") + ")");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
if (!html.includes(css)) stale.push("styles.css");

if (stale.length) fail("bundle is out of date with the sources: " + stale.join("; ") + ". Run: npm run build");

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`check-bundle: OK — ${path.relative(ROOT, OUT)} parses and matches ${MODULE_ORDER.length} modules, ${DATA_FILES.length} tables and styles.css (${mb} MB)`);
