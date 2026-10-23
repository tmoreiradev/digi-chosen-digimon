// Submits a commit range to an independent review by the Codex CLI.
//
//   npm run review:codex                       reviews HEAD~1..HEAD
//   npm run review:codex -- 94acc78..HEAD      reviews a range
//   npm run review:codex -- HEAD~3..HEAD --sandbox workspace-write
//
// What it does, and why:
//   - Checks the range's tip out into a throwaway git worktree, so Codex reads a clean
//     tree instead of whatever is half-edited here, and tells Codex to work there (-C).
//   - Runs `npm test`, the build and the bundle check INSIDE that worktree first and
//     pastes their output into the prompt: the Codex sandbox on Windows cannot spawn
//     node (`spawn EPERM`), so the review would otherwise run without that evidence,
//     and running them here would describe the working tree, not the reviewed commit.
//   - Sends the prompt on stdin and passes no prompt argument (codex then reads stdin).
//     Codex waits for stdin whenever it is a pipe; feeding it the prompt (then EOF)
//     avoids the hang seen when the prompt is an argument and stdin stays open.
//   - Passes `-c windows.sandbox=unelevated` on Windows (the elevated sandbox fails here)
//     and `-s read-only` by default.
//   - Saves the final message to reviews/codex-<timestamp>-<range>.md and prints it.
//     (`-o` is passed too, but codex 0.164 did not write it; stdout holds the message.)
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
const shell = process.platform === "win32";

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const runIn = (cwd, cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: "utf8", shell, maxBuffer: 16 * 1024 * 1024 });
  return `$ ${cmd} ${cmdArgs.join(" ")}\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trim();
};
const tail = (text, lines) => text.split("\n").slice(-lines).join("\n");

const tip = range.includes("..") ? range.split("..")[1] || "HEAD" : "HEAD";
const tipSha = git("rev-parse", tip);
const log = git("log", "--oneline", range);
if (!log) {
  console.error(`codex-review: the range ${range} has no commits`);
  process.exit(2);
}
console.log(`codex-review: ${range} (${log.split("\n").length} commits, tip ${tipSha.slice(0, 7)})`);

const wt = path.join(os.tmpdir(), `digi-chosen-review-${tipSha.slice(0, 7)}`);
spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT });
git("worktree", "add", "-f", wt, tipSha);

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const outDir = path.join(ROOT, "reviews");
fs.mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, `codex-${stamp}-${range.replace(/[^\w.~^-]+/g, "_")}`);
const outFile = `${base}.md`;

let result;
let review = "";
try {
  console.log("codex-review: running npm test, build and the bundle check in the worktree (the Codex sandbox cannot spawn node)");
  const tests = tail(runIn(wt, "npm", ["test"]), 30);
  const bundle = tail(runIn(wt, "node", ["build.mjs"]) + "\n" + runIn(wt, "node", ["scripts/check-bundle.mjs"]), 12);

  const template = fs.readFileSync(path.join(ROOT, "scripts", "codex-review-prompt.md"), "utf8");
  const prompt = template
    .replaceAll("{{RANGE}}", range)
    .replaceAll("{{LOG}}", log)
    .replaceAll("{{TESTS}}", tests)
    .replaceAll("{{BUNDLE}}", bundle);

  // No prompt argument: codex exec then reads the instructions from stdin (a literal "-" is rejected).
  const codexArgs = ["exec", "-s", sandbox, "-C", wt, "-o", outFile, "--color", "never"];
  if (shell) codexArgs.splice(1, 0, "-c", "windows.sandbox=unelevated");
  console.log(`codex-review: codex ${codexArgs.join(" ")}`);
  result = spawnSync("codex", codexArgs, { cwd: wt, input: prompt, encoding: "utf8", shell, maxBuffer: 64 * 1024 * 1024 });

  review = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : (result.stdout ?? "").trim();
  if (result.status !== 0 || !review) {
    fs.writeFileSync(`${base}.log`, (result.stdout ?? "") + (result.stderr ?? ""));
    console.error(`codex-review: codex exited with ${result.status}; see ${path.relative(ROOT, base)}.log`);
    process.exit(result.status || 1);
  }
  fs.writeFileSync(outFile, review.endsWith("\n") ? review : review + "\n");
} finally {
  spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT });
  spawnSync("git", ["worktree", "prune"], { cwd: ROOT });
}

console.log(`\n${review}\n\ncodex-review: saved to ${path.relative(ROOT, outFile)}`);
process.exit(/\*\*Reprovado\*\*|^Reprovado/mi.test(review) ? 1 : 0);
