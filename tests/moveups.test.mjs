// Move-upgrade cards must change what the attacks do, not only what mv.mods stores:
// pierce goes through more enemies, bounce ricochets, crit and status chances rise.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, loadData, withRandom } from "./_helpers.mjs";
import { buildMoveDef } from "../src/game/rules.js";

const data = loadData();
// A starter whose first kit move is a plain projectile ("bolt"), so shots fly straight.
const bolter = data.rules.roster.find((r) => {
  const m = data.getMoveByKey(r.kit[0]);
  return m && buildMoveDef(m, data.rules)?.arch === "bolt";
});
assert.ok(bolter, "the roster has a starter with a bolt as first move");

function shooter() {
  const { run } = makeRun({ speciesId: bolter.id });
  const p = run.player;
  p.x = 0;
  p.z = 0;
  const mv = p.moves[0];
  assert.equal(mv.def.arch, "bolt");
  return { run, mv };
}
const fly = (run, frames = 90) => {
  for (let i = 0; i < frames; i++) run.updateProjectiles(1 / 60);
};
const damaged = (e) => e.maxHp - e.hp;

test("+1 pierce: the bolt goes on to a second enemy in line (it used to stop at the first)", () => {
  for (const pierce of [0, 1]) {
    const { run, mv } = shooter();
    const a = run.spawnEnemy(16, 3, 0, "normal");
    const b = run.spawnEnemy(16, 6, 0, "normal");
    mv.mods.pierce = pierce;
    assert.equal(run.effectiveDef(mv).pierce, pierce);
    run.fireMove(mv);
    fly(run);
    assert.ok(damaged(a) > 0, "the first enemy is hit");
    assert.equal(damaged(b) > 0, pierce > 0, `second enemy hit only with pierce (pierce=${pierce})`);
  }
});

test("+1 bounce: the bolt ricochets to an enemy that was not in its path", () => {
  for (const bounce of [0, 1]) {
    const { run, mv } = shooter();
    const a = run.spawnEnemy(16, 3, 0, "normal");
    const b = run.spawnEnemy(16, 3, 5, "normal"); // off the line of fire
    mv.mods.bounce = bounce;
    run.fireMove(mv);
    fly(run);
    assert.ok(damaged(a) > 0);
    assert.equal(damaged(b) > 0, bounce > 0, `off-line enemy hit only with a bounce (bounce=${bounce})`);
  }
});

test("+crit raises the crit chance of every hit", () => {
  const { run, mv } = shooter();
  const p = run.player;
  const e = run.spawnEnemy(16, 3, 0, "normal");
  const hit = (crit) => {
    mv.mods.crit = crit;
    const before = e.hp;
    withRandom(0.99, () => run.hitEnemy(e, 10, run.effectiveDef(mv))); // 0.99 never crits naturally
    return before - e.hp;
  };
  const plain = hit(0);
  const critted = hit(1); // chance >= 1 after the upgrade
  assert.ok(Math.abs(critted / plain - p.stats.critDamage) < 1e-6, `crit multiplies by critDamage (${critted / plain} vs ${p.stats.critDamage})`);
});

test("+count on a melee strike means extra swings (the archetype used to ignore it)", () => {
  const { run } = makeRun({ speciesId: 1 }); // Bulbasaur: Vine Whip is a strike
  const p = run.player;
  p.x = 0;
  p.z = 0;
  const mv = p.moves[0];
  assert.equal(mv.def.arch, "strike");
  const swing = (count) => {
    const e = run.spawnEnemy(16, 1.5, 0, "normal");
    mv.mods.count = count;
    withRandom(0.99, () => run.fireMove(mv)); // no crits
    e.alive = false;
    return damaged(e);
  };
  const one = swing(0);
  const two = swing(1);
  assert.ok(one > 0);
  assert.ok(Math.abs(two / one - 2) < 1e-6, `two swings deal double (${two / one})`);
});

function withMove(run, arch) {
  const move = data.moves.find((m) => buildMoveDef(m, data.rules)?.arch === arch);
  assert.ok(move, `a ${arch} move exists in the tables`);
  const def = buildMoveDef(move, data.rules);
  if (!def.status) def.status = "burn";
  const mv = { def, level: 1, timer: 0, mods: { dmg: 1, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 } };
  run.player.moves.push(mv);
  return mv;
}

test("+dur stretches the life of trail and trap zones", () => {
  for (const arch of ["trail", "trap"]) {
    const { run } = makeRun();
    const mv = withMove(run, arch);
    const base = arch === "trail" ? 3 : 6;
    run.fireMove(mv);
    assert.ok(Math.abs(run.zones.at(-1).life - base) < 1e-9, `${arch}: base life ${base}`);
    mv.mods.dur = 1.5;
    run.fireMove(mv);
    assert.ok(Math.abs(run.zones.at(-1).life - base * 1.5) < 1e-9, `${arch}: +50% duration`);
  }
});

test("+status scales the per-tick status chance of a trail zone", () => {
  const { run } = makeRun();
  const mv = withMove(run, "trail");
  const status = mv.def.status;
  const e = run.spawnEnemy(16, run.player.x, run.player.z, "normal");
  const tick = (statusMod) => {
    run.zones.length = 0;
    mv.mods.status = statusMod;
    run.fireMove(mv);
    run.zones[0].tick = 0;
    e.statuses[status] = 0;
    withRandom(0.5, () => run.updateProjectiles(1 / 60)); // the zone ticks once; 0.5 beats the 25 % base
    return (e.statuses[status] ?? 0) > 0;
  };
  assert.equal(tick(1), false, "base chance 25 %: no status at roll 0.5");
  assert.equal(tick(3), true, "x3 -> 75 %: status applied");
});

test("+status raises the chance that a hit applies the move's status", () => {
  const { run, mv } = shooter();
  const e = run.spawnEnemy(16, 3, 0, "normal");
  if (!mv.def.status) mv.def = { ...mv.def, status: "burn", statusChance: 0.12 };
  const status = mv.def.status;
  mv.mods.status = 1;
  withRandom(0.5, () => run.hitEnemy(e, 1, run.effectiveDef(mv))); // 0.5 >= base 0.12-0.3: no status
  assert.equal(e.statuses[status] ?? 0, 0);
  mv.mods.status = 10; // x10 chance: certain
  withRandom(0.5, () => run.hitEnemy(e, 1, run.effectiveDef(mv)));
  assert.ok((e.statuses[status] ?? 0) > 0, `${status} applied once the chance is upgraded`);
});
