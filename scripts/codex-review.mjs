// Submits a commit range to an independent review by the Codex CLI.
//
//   npm run review:codex                       reviews HEAD~1..HEAD
//   npm run review:codex -- 94acc78..HEAD      reviews a range
//   npm run review:codex -- HEAD~3..HEAD --sandbox workspace-write
//
// What it does, and why:
//   - Checks the range's tip out into a throwaway git worktree, so Codex reads a clean
//     tree instead of whatever is half-edited here, and tells Codex to work there (-C).
//   - Runs `npm test` and the bundle check HERE first and pastes their output into the
//     prompt: the Codex sandbox on Windows cannot spawn node (`spawn EPERM`), so the
//     review would otherwise run without that evidence.
//   - Sends the prompt on stdin with `-` as the prompt argument. Codex waits for stdin
//     whenever it is a pipe; feeding it the prompt (then EOF) avoids the hang.
//   - Passes `-c windows.sandbox=unelevated` on Windows (the elevated sandbox fails here)
//     and `-s read-only` by default.
//   - Writes the final message to reviews/codex-<timestamp>.md and prints it.
// Exit code 1 when the verdict says "Reprovado", so it can gate a script.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let sandbox = "read-only";
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--sandbox") sandbox = args[++i];
  else positional.push(args[i]);
}
const range = positional[0] ?? "HEAD~1..HEAD";

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" });
  return `$ ${cmd} ${cmdArgs.join(" ")}\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trim();
};
const tail = (text, lines = 40) => text.split("\n").slice(-lines).join("\n");

const tip = range.includes("..") ? range.split("..")[1] || "HEAD" : "HEAD";
const tipSha = git("rev-parse", tip);
const log = git("log", "--oneline", range);
if (!log) {
  console.error(`codex-review: the range ${range} has no commits`);
  process.exit(2);
}

console.log(`codex-review: ${range} (${log.split("\n").length} commits, tip ${tipSha.slice(0, 7)})`);
console.log("codex-review: running npm test and the bundle check here (the Codex sandbox cannot spawn node)");
const tests = tail(run("npm", ["test"]), 30);
const bundle = tail(run("node", ["scripts/check-bundle.mjs"]), 10);

const template = fs.readFileSync(path.join(ROOT, "scripts", "codex-review-prompt.md"), "utf8");
const prompt = template
  .replaceAll("{{RANGE}}", range)
  .replaceAll("{{LOG}}", log)
  .replaceAll("{{TESTS}}", tests)
  .replaceAll("{{BUNDLE}}", bundle);

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const outDir = path.join(ROOT, "reviews");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `codex-${stamp}.md`);
const logFile = path.join(outDir, `codex-${stamp}.log`);

const wt = path.join(os.tmpdir(), `digi-chosen-review-${tipSha.slice(0, 7)}`);
spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT });
git("worktree", "add", "-f", wt, tipSha);

const codexArgs = ["exec", "-s", sandbox, "-C", wt, "-o", outFile, "--color", "never"];
if (process.platform === "win32") codexArgs.splice(1, 0, "-c", "windows.sandbox=unelevated");
codexArgs.push("-"); // prompt comes on stdin
console.log(`codex-review: codex ${codexArgs.join(" ")}`);

let result;
try {
  result = spawnSync("codex", codexArgs, {
    cwd: wt,
    input: prompt,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.writeFileSync(logFile, (result.stdout ?? "") + (result.stderr ?? ""));
} finally {
  spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT });
  spawnSync("git", ["worktree", "prune"], { cwd: ROOT });
}

if (result.status !== 0 || !fs.existsSync(outFile)) {
  console.error(`codex-review: codex exited with ${result.status}; see ${path.relative(ROOT, logFile)}`);
  process.exit(result.status || 1);
}
const review = fs.readFileSync(outFile, "utf8");
console.log(`\n${review}\n\ncodex-review: saved to ${path.relative(ROOT, outFile)}`);
process.exit(/\*\*Reprovado\*\*|^Reprovado/mi.test(review) ? 1 : 0);
