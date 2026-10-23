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

test("an honest bot survives a classic run without breaking any invariant", () => {
  const { run, input, calls, profile } = makeRun();
  const s = playRun({ run, input, calls, seed: 11, maxSeconds: 600, log });
  log(`result: ${s.state} after ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills, zone ${s.stage}, ${s.allies} allies, ${s.gold} gold, shops ${s.shops}, chests ${s.chests}, altars ${s.altars}, throws ${s.throws}, ults ${s.ults}, choices ${JSON.stringify(s.choices)}`);
  assert.deepEqual(s.invariantFailures, []);
  assert.ok(["running", "dead", "victory"].includes(s.state));
  assert.ok(s.level >= 3, `a few minutes of play should level up (got ${s.level})`);
  assert.ok(s.kills > 20, `and kill things (got ${s.kills})`);
  assert.equal(profile.data.pokedex.seen.length > 0, true);
  assert.equal(profile.data.runs, 0, "the run itself never touches the results counters");
});

test("classic mode can be won through play: three guardians, the sanctuary, the legendary", () => {
  const { run, input, calls } = makeRun();
  const s = playRun({ run, input, calls, seed: 23, maxSeconds: 30 * 60, godMode: true, log });
  log(`result: ${s.state} after ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills`);
  assert.deepEqual(s.invariantFailures, []);
  assert.equal(s.state, "victory");
  for (const zone of [1, 2]) assert.ok(calls.banners.includes(`Zone ${zone} cleared!`), `zone ${zone} cleared`);
  assert.ok(calls.banners.some((b) => /sanctuary/i.test(b)));
  assert.ok(calls.banners.some((b) => /the legendary!/.test(b)));
});

test("the tower can be climbed through play: seven floors, waves and guardians", () => {
  const { run, input, calls } = makeRun({ mode: "tower" });
  const s = playRun({ run, input, calls, seed: 42, maxSeconds: 30 * 60, godMode: true, log });
  log(`result: ${s.state} after ${Math.round(s.time)}s, level ${s.level}, ${s.kills} kills, floor ${run.tower.floor}`);
  assert.deepEqual(s.invariantFailures, []);
  assert.equal(s.state, "victory");
  for (let floor = 1; floor <= 7; floor++) assert.ok(calls.banners.some((b) => b.startsWith(`${floor}F`)), `floor ${floor} entered`);
});
