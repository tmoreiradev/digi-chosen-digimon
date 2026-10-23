// Bug A: the first capture of a run must always grant an egg (it used to depend on the 25% roll).
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, fakeProfile, withRandom, spawnAlpha } from "./_helpers.mjs";

test("first capture of the run grants an egg even when the profile already has catches", () => {
  const profile = fakeProfile({ pokedex: { seen: [25], caught: [25] } });
  const { run } = makeRun({ profile });
  assert.equal(run.pokedex.caught.size, 1, "profile catches are loaded into the run");
  assert.equal(run.capturesThisRun, 0);

  const e = spawnAlpha(run, 16);
  withRandom(0.99, () => run.capture.caught(e)); // 0.99 would fail a 25% roll

  assert.equal(run.capturesThisRun, 1);
  assert.equal(profile.data.eggs.active, true, "egg granted on the first capture of the run");
  assert.equal(profile.data.eggs.hatchSpecies, 16);
  assert.equal(profile.data.eggs.needed, 200);
  assert.equal(profile.data.progress, undefined, "eggs live in profile.data.eggs, not profile.data.progress");
});

test("later captures roll 25% and never overwrite an incubating egg", () => {
  const { run, profile } = makeRun();
  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16))); // first: guaranteed
  assert.equal(profile.data.eggs.hatchSpecies, 16);

  withRandom(0.1, () => run.capture.caught(spawnAlpha(run, 19))); // 0.1 < 0.25 but an egg is active
  assert.equal(profile.data.eggs.hatchSpecies, 16, "active egg is kept");
  assert.equal(run.capturesThisRun, 2);

  run.eggs.addSteps(200); // hatch
  assert.equal(profile.data.eggs.active, false);

  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 21))); // fails the 25% roll
  assert.equal(profile.data.eggs.active, false, "third capture without a lucky roll: no egg");

  withRandom(0.1, () => run.capture.caught(spawnAlpha(run, 23))); // passes the roll
  assert.equal(profile.data.eggs.active, true);
  assert.equal(profile.data.eggs.hatchSpecies, 23);
});

test("an egg incubating from a previous run blocks the new run's guaranteed egg", () => {
  const profile = fakeProfile({ eggs: { active: true, steps: 50, needed: 200, hatchSpecies: 4 } });
  const { run } = makeRun({ profile });
  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16)));
  assert.equal(profile.data.eggs.hatchSpecies, 4, "the old egg is not replaced");
  assert.equal(run.eggs.stepsSinceHatch, 50, "its steps are restored from the profile");
});

test("egg steps are persisted in profile.data.eggs and hatching recruits the ally", () => {
  const { run, profile } = makeRun();
  assert.equal(run.eggs.giveEgg(1, 10), true);
  run.eggs.addSteps(4);
  assert.equal(profile.data.eggs.steps, 4);
  assert.ok(profile.saves > 0, "steps are written to the profile");

  run.eggs.addSteps(6);
  assert.equal(profile.data.eggs.active, false, "hatched");
  assert.equal(profile.data.eggs.hatchSpecies, null);
  assert.equal(run.allies.list.length, 1);
  assert.equal(run.allies.list[0].id, 1, "the hatched species joined the team");
  assert.ok(run.pokedex.caught.has(1));
});

test("walking counts steps: 0.6 world units per step", () => {
  const { run, input, profile } = makeRun();
  run.eggs.giveEgg(7, 1000);
  input.right = true;
  for (let i = 0; i < 120; i++) run.update(1 / 60); // 2 s at full speed
  assert.ok(run.eggs.stepsSinceHatch > 5, `expected steps while walking, got ${run.eggs.stepsSinceHatch}`);
  assert.equal(profile.data.eggs.steps, run.eggs.stepsSinceHatch);
});
