// Achievement rewards (BACKLOG 5) and the single capture list (BACKLOG 6).
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, fakeProfile, withRandom, spawnAlpha } from "./_helpers.mjs";
import { ACHIEVEMENTS, DEX_TASKS } from "../src/game/achievements.js";
import { normalizeProgress } from "../src/ui/account.js";

const gold = (key) => ACHIEVEMENTS.find((a) => a.key === key).gold;

test("first catch pays its gold to the running run and the banner says so", () => {
  const { run, profile, calls } = makeRun();
  run.stats.gold = 10;
  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16)));
  assert.equal(run.stats.gold, 10 + gold("first_catch"));
  assert.ok(calls.banners.includes(`Conquista: Primeiro Passo · +${gold("first_catch")}G`));
  assert.ok(profile.data.achievements.unlocked.includes("first_catch"));
  assert.equal(profile.data.pendingGold ?? 0, 0, "nothing banked while the run is running");
});

test("gold earned after the run ended is banked and paid when the next run starts", () => {
  const { run, profile } = makeRun();
  // Quit from the pause menu leaves run.state === "running"; recordRun still means the run is over.
  run.achievements.recordRun(true, 0);
  assert.equal(profile.data.wins, 1);
  assert.ok(profile.data.achievements.unlocked.includes("champion"));
  assert.equal(profile.data.pendingGold, gold("champion"));
  assert.equal(run.stats.gold, 0, "a finished run gets nothing");

  const next = makeRun({ profile });
  assert.equal(next.run.stats.gold, gold("champion"));
  assert.equal(profile.data.pendingGold, 0);
  assert.ok(next.calls.banners.includes(`Recompensas pendentes: +${gold("champion")}G`));
});

test("completing a species task pays and announces it", () => {
  const { run, profile, calls } = makeRun();
  const task = DEX_TASKS.find((t) => t.key === "catch_grass");
  const grass = run.data.pokemon.filter((s) => s.types.includes("grass") && !s.legendary && !s.mythical).slice(0, task.need);
  run.stats.gold = 0;
  for (const s of grass) withRandom(0.99, () => run.capture.caught(spawnAlpha(run, s.id)));
  assert.equal(profile.data.dexTasks.catch_grass, task.need);
  assert.ok(profile.data.achievements.unlocked.includes("task_catch_grass"));
  assert.ok(calls.banners.includes(`Tarefa concluída: Tipo Grama · +${task.gold}G`));
  assert.equal(run.stats.gold, gold("first_catch") + task.gold);
});

test("need predicates drive the other unlocks from the profile's own numbers", () => {
  const profile = fakeProfile({ runs: 5, pokedex: { seen: Array.from({ length: 50 }, (_, i) => i + 1), caught: [] } });
  const { run } = makeRun({ profile }); // the constructor's first check() sees runs and seen
  const u = profile.data.achievements.unlocked;
  assert.ok(u.includes("dex_50"));
  assert.ok(u.includes("veteran"));
  assert.equal(run.stats.gold, gold("dex_50") + gold("veteran"), "paid to the fresh run");
  assert.equal(profile.data.pendingGold ?? 0, 0);

  run.achievements.ach.shinyCaught = 2;
  withRandom(0.99, () => {
    const e = spawnAlpha(run, 16);
    e.shiny = true;
    run.capture.caught(e);
  });
  assert.ok(u.includes("shiny_hunter"));
  run.achievements.recordRun(false, 3);
  assert.ok(u.includes("tower_climber"));
  assert.equal(profile.data.achievements.towerFloors, 3);
});

test("captures live only in profile.data.pokedex.caught; hatching counts for the collector", () => {
  const { run, profile } = makeRun();
  assert.equal(run.eggs.giveEgg(1, 1), true); // before the capture, which would otherwise grant the run's first egg
  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16)));
  assert.equal(profile.data.caught, undefined, "no second list");
  assert.deepEqual(profile.data.pokedex.caught, [16]);
  run.eggs.addSteps(1);
  assert.deepEqual(profile.data.pokedex.caught, [16, 1]);
});

test("old saves: the second capture list folds into the Pokédex as seen partners", () => {
  const p = { unlocked: [1], caught: [1, 16], pokedex: { seen: [16], caught: [16] }, runs: 2 };
  normalizeProgress(p);
  assert.equal(p.caught, undefined);
  assert.deepEqual(p.pokedex.caught, [16], "captures were already there; the played partner is not a capture");
  assert.deepEqual(p.pokedex.seen, [16, 1]);
  assert.deepEqual(normalizeProgress({}).pokedex, { seen: [], caught: [] });
});

test("old saves: runs/wins counted inside achievements move to the profile counters", () => {
  const profile = fakeProfile({ runs: 1, wins: 0, achievements: { unlocked: [], progress: {}, runsCompleted: 4, wins: 1 } });
  makeRun({ profile });
  assert.equal(profile.data.runs, 4);
  assert.equal(profile.data.wins, 1);
  assert.ok(profile.data.achievements.unlocked.includes("champion"), "wins >= 1 unlocks on load");
});
