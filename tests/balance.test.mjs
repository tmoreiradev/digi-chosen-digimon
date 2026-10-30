// Balance floors from the playtest of 30/10 (docs/PLAYTEST_2026-10-30.md), played by the test bot.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

installFakeDom().register("ui");
const { makeRun } = await import("./_helpers.mjs");
const { playRun } = await import("./_bot.mjs");

test("ranged starters keep up: Terriermon (bolt) and Renamon (Diamond Storm) reach level 9 by three minutes", () => {
  // Before: level 7 at 3 min against 11-12 for the rest (a single-target bolt; a 4-shot barrage).
  for (const [id, name] of [[56, "Terriermon"], [60, "Renamon"]]) {
    const levels = [1, 2, 3].map((seed) => {
      const { run, input, calls } = makeRun({ speciesId: id });
      playRun({ run, input, calls, seed, maxSeconds: 180 });
      return run.player.level;
    });
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    assert.ok(mean >= 9, `${name}: level ${levels.join("/")} at 3 min`);
  }
});

test("tower floor 5 is not a wall: Hawkmon gets past it", () => {
  // Before: Myotismon as a full boss on floor 5 killed Hawkmon on every seed (10 of 51 bot runs died there).
  const { run, input, calls } = makeRun({ speciesId: 46, mode: "tower" });
  playRun({ run, input, calls, seed: 1, maxSeconds: 900 });
  assert.ok(run.tower.floor >= 6 || run.state === "victory", `stopped on floor ${run.tower.floor} (${run.state})`);
});
