// Evolution: the plan (target + level) is decided once per species, not re-rolled on every check.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";

test("an Eevee keeps one evolution target and threshold across checks, then evolves into exactly that", () => {
  const { run, calls } = makeRun({ speciesId: 133 });
  const p = run.player;
  const plan = p.evoPlan;
  assert.ok(plan, "a plan exists for Eevee");
  assert.equal(run.data.get(plan.to.id).evoFrom, 133);
  const seen = new Set();
  for (let level = 1; level < plan.level; level++) {
    p.level = level;
    assert.equal(run.tryEvolve(), false, `no evolution at level ${level}`);
    seen.add(`${p.evoPlan.to.id}@${p.evoPlan.level}`);
  }
  assert.equal(seen.size, 1, `the plan never changed (${[...seen].join(", ")})`);
  p.level = plan.level;
  assert.equal(run.tryEvolve(), true);
  assert.equal(p.speciesId, plan.to.id, "evolved into the planned target");
  assert.equal(p.evoPlan, null, "an Eeveelution has nowhere further to go");
  assert.ok(calls.banners.includes(`Evolved into ${plan.to.name}!`));
});

test("a three-stage line plans the next stage after each evolution", () => {
  const { run } = makeRun({ speciesId: 1 });
  const p = run.player;
  assert.equal(p.evoPlan.to.id, 2, "Bulbasaur plans Ivysaur");
  p.level = p.evoPlan.level;
  assert.equal(run.tryEvolve(), true);
  assert.equal(p.speciesId, 2);
  assert.equal(p.evoPlan.to.id, 3, "Ivysaur plans Venusaur");
  p.level = p.evoPlan.level;
  assert.equal(run.tryEvolve(), true);
  assert.equal(p.speciesId, 3);
  assert.equal(p.evoPlan, null);
  assert.equal(run.tryEvolve(), false);
});

test("two runs with the same seed plan the same evolution", () => {
  const a = makeRun({ speciesId: 133 }).run.player.evoPlan;
  const b = makeRun({ speciesId: 133 }).run.player.evoPlan;
  assert.equal(a.to.id, b.to.id);
  assert.equal(a.level, b.level);
});
