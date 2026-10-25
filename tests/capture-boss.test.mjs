// BACKLOG 3: bosses (zone guardian, legendary, tower guardians) are capturable like alphas.
// A weakened boss stops fighting; a landed ball counts as the boss falling (zone cleared, floor
// advanced, victory) without the kill fanfare; a failed throw lets it recover and fight on.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";

const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};

function guardianUp(run) {
  run.player.iframes = 1e9;
  run.callGuardian(); // wake the zone guardian at once (the altar's E)
  frames(run, 2);
  assert.ok(run.boss.alive && run.boss.kind === "guardian", "the zone guardian is up");
  return run.boss.enemy;
}

/** Knock the boss under the weaken threshold with a real hit and step into throw range. */
function weaken(run, e) {
  e.hp = e.maxHp * run.rules.capture.weakenHpPct * 0.5;
  run.hitEnemy(e, 1, null);
  assert.equal(e.captureReady, true, "the boss is flagged capturable");
  assert.equal(run.capture.state, "down");
  run.player.x = e.x;
  run.player.z = e.z;
}

test("a zone guardian under the threshold is weakened and stops attacking", () => {
  const { run, calls } = makeRun();
  const g = guardianUp(run);
  run.boss.moveT = 0.01;
  run.boss.windup = 0;
  run.boss.active = null;
  weaken(run, g);
  assert.ok(calls.banners.some((b) => /está enfraquecido/.test(b)));
  frames(run, 120);
  assert.equal(run.boss.windup, 0, "no telegraph while weakened");
  assert.equal(run.boss.active, null, "no pattern while weakened");
  assert.ok(run.boss.moveT > 0, "the move timer is frozen while weakened");
  assert.equal(g.captureReady, true, "still capturable after 2 s (the window is 8 s)");
  assert.equal(run.boss.alive, true);
});

test("catching the guardian clears the zone: ally recruited, Pokédex updated, no kill fanfare", () => {
  const { run, calls } = makeRun();
  const g = guardianUp(run);
  weaken(run, g);
  assert.equal(withRandom(0, () => run.capture.throw()), "caught");
  assert.ok(calls.banners.some((b) => b.startsWith(`Pegou! ${g.species.name}`)));
  assert.equal(run.stage, 2, "the catch counts as the guardian falling");
  assert.ok(calls.banners.includes("Zona 1 limpa!"));
  assert.ok(!calls.banners.some((b) => /foi derrotado/.test(b)), "no kill banner for a catch");
  assert.equal(run.boss.alive, false);
  assert.ok(run.allies.list.some((a) => a.id === g.species.id && a.bond === 1.5), "a boss recruits with the 1.5 bond");
  assert.ok(calls.caught.includes(g.species.name));
  assert.ok(run.profile.data.pokedex.caught.includes(g.species.id));
  frames(run, 5);
  assert.equal(run.stage, 2, "compacting the corpse does not count a second defeat");
  assert.ok(!calls.banners.some((b) => /foi derrotado/.test(b)));
});

test("catching the legendary wins the run", () => {
  let victories = 0;
  const { run } = makeRun({ opts: { onVictory: () => victories++ } });
  run.player.iframes = 1e9;
  run.enterSanctuary();
  frames(run, 160);
  assert.equal(run.boss.kind, "legendary");
  const l = run.boss.enemy;
  weaken(run, l);
  assert.equal(withRandom(0, () => run.capture.throw()), "caught");
  assert.equal(run.state, "victory");
  assert.equal(victories, 1);
  assert.ok(run.allies.list.some((a) => a.id === l.species.id));
});

test("a failed throw lets the boss break free and fight again", () => {
  const { run } = makeRun();
  const g = guardianUp(run);
  run.boss.moveT = 0.5;
  weaken(run, g);
  assert.equal(withRandom(0.999, () => run.capture.throw()), "escaped");
  assert.equal(g.captureReady, false);
  assert.ok(g.hp >= g.maxHp * 0.3 - 1e-9, "recovers to 30% HP");
  assert.equal(run.boss.alive, true);
  assert.equal(run.stage, 1);
  frames(run, 60);
  assert.ok(run.boss.moveT < 0.5 || run.boss.windup > 0 || run.boss.active !== null, "the boss AI resumed");
});

test("tower: catching the floor guardian advances the floor", () => {
  const { run } = makeRun({ mode: "tower" });
  run.player.iframes = 1e9;
  run.enemies.length = 0;
  const g = run.tower.awakenGuardian();
  assert.ok(g && run.boss.alive, "the guardian is up");
  const floor = run.tower.floor;
  weaken(run, g);
  assert.equal(withRandom(0, () => run.capture.throw()), "caught");
  assert.equal(run.tower.floor, floor + 1);
  assert.equal(run.boss.alive, false);
});

test("elites and normal enemies are still not capturable", () => {
  const { run } = makeRun();
  for (const tier of ["normal", "elite"]) {
    const e = run.spawnEnemy(16, run.player.x + 1, run.player.z, tier);
    e.hp = e.maxHp * 0.01;
    assert.equal(run.capture.weaken(e), false, tier);
    assert.ok(!e.captureReady);
  }
});
