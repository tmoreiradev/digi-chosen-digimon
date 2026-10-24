// Playtests: a bot plays whole runs through the real input/level-up/panel surfaces and the
// invariants in tests/_bot.mjs are checked every half second of game time. A 20-minute
// run takes well under a second here, so all three scenarios are part of `npm test`.
// PLAYTEST=quiet hides the progress lines.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

const dom = installFakeDom();
dom.register("ui");
const { makeRun } = await import("./_helpers.mjs");
const { playRun } = await import("./_bot.mjs");

const log = process.env.PLAYTEST === "quiet" ? () => {} : (line) => process.stdout.write(`    ${line}\n`);

test("an honest bot plays ten classic runs: no invariant breaks, never dies early, often survives the first guardian", () => {
  // The bot is an average player: it clears the first minutes every time and beats the
  // zone-1 guardian (t = 300 s) in roughly half of the seeds. Those two bars are the
  // baseline; a balance change that moves them shows up here.
  const results = [];
  for (let seed = 11; seed <= 20; seed++) {
    const { run, input, calls, profile } = makeRun();
    const s = playRun({ run, input, calls, seed, maxSeconds: 600 });
    results.push(s);
    log(`seed ${seed}: ${s.state} at ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills, zone ${s.stage}, ${s.allies} allies, ${s.gold} gold, shops ${s.shops}, chests ${s.chests}, throws ${s.throws}, ults ${s.ults}`);
    assert.deepEqual(s.invariantFailures, [], `seed ${seed}`);
    assert.ok(s.time > 240, `seed ${seed}: never dies in the first four minutes (died at ${Math.round(s.time)}s)`);
    assert.ok(s.level >= 10, `seed ${seed}: levels up a lot (got ${s.level})`);
    assert.ok(s.kills > 200, `seed ${seed}: kills plenty (got ${s.kills})`);
    assert.equal(profile.data.pokedex.seen.length > 0, true);
    assert.equal(profile.data.runs, 0, "the run itself never touches the results counters");
  }
  const survived = results.filter((s) => s.state !== "dead").length;
  log(`survived the whole 600 s: ${survived} / ${results.length}`);
  assert.ok(survived >= 3, `at least 3 of 10 seeds should survive 600 s (got ${survived})`);
  assert.ok(results.filter((s) => s.state !== "dead").every((s) => s.stage >= 2), "every survivor got past the first guardian");
});

test("classic mode can be won through play: three guardians, the sanctuary, the legendary", () => {
  const { run, input, calls } = makeRun();
  const s = playRun({ run, input, calls, seed: 23, maxSeconds: 30 * 60, godMode: true, log });
  log(`result: ${s.state} after ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills`);
  assert.deepEqual(s.invariantFailures, []);
  assert.equal(s.state, "victory");
  for (const zone of [1, 2]) assert.ok(calls.banners.includes(`Zona ${zone} limpa!`), `zone ${zone} cleared`);
  assert.ok(calls.banners.some((b) => /santuário/i.test(b)));
  assert.ok(calls.banners.some((b) => /o lendário!/.test(b)));
});

test("an honest bot plays five tower runs: no invariant breaks, never dies in the first two minutes", () => {
  const results = [];
  for (let seed = 31; seed <= 35; seed++) {
    const { run, input, calls } = makeRun({ mode: "tower" });
    const s = playRun({ run, input, calls, seed, maxSeconds: 600 });
    results.push(s);
    log(`tower seed ${seed}: ${s.state} at ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills, floor ${run.tower.floor}, ${s.allies} allies`);
    assert.deepEqual(s.invariantFailures, [], `seed ${seed}`);
    assert.ok(s.time > 120, `seed ${seed}: survives the first two minutes (died at ${Math.round(s.time)}s)`);
    assert.ok(run.tower.floor >= 4, `seed ${seed}: clears the first three floors on its own (reached floor ${run.tower.floor})`);
  }
  log(`tower survivors (600 s or victory): ${results.filter((s) => s.state !== "dead").length} / ${results.length}`);
});

test("the tower can be climbed through play: seven floors, waves and guardians", () => {
  const { run, input, calls } = makeRun({ mode: "tower" });
  const s = playRun({ run, input, calls, seed: 42, maxSeconds: 30 * 60, godMode: true, log });
  log(`result: ${s.state} after ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills, floor ${run.tower.floor}`);
  assert.deepEqual(s.invariantFailures, []);
  assert.equal(s.state, "victory");
  for (let floor = 1; floor <= 7; floor++) assert.ok(calls.banners.some((b) => b.startsWith(`${floor}F`)), `floor ${floor} entered`);
});
