// BACKLOG 10: player stats the cards promised but the engine never read — shieldMax (Zinc), thorns
// (Rocky Helmet, Protector, Sticky Barb), bounces (Smooth Rock), flinch (King's Rock), powerup (Poké
// Radar), eliteSpawn (Super Lure) and enemyAmount (White Flute, Repel). Each one now has an effect.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";
import { basePlayerStats } from "../src/game/rules.js";

const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};

/** A run whose director never spawns, so nothing interferes with the player. */
function quietRun(opts) {
  const made = makeRun(opts);
  made.run.director.update = () => {};
  return made;
}

test("shieldMax: the shield fills after 2.5 s without hits, absorbs damage first and refills", () => {
  const { run } = quietRun();
  const p = run.player;
  p.stats.shieldMax = 20;
  p.stats.evasion = 0;
  frames(run, 60 * 7);
  assert.ok(p.shield >= 19.9 && p.shield <= 20, `full shield after 7 s (got ${p.shield})`);
  const hp = p.hp;
  run.hitPlayer(10 / (1 - p.stats.armor / (p.stats.armor + 45)), null); // 10 after the armour curve
  assert.equal(p.hp, hp, "the shield took the hit");
  assert.ok(Math.abs(p.shield - 10) < 1e-6, `shield down to 10 (got ${p.shield})`);
  frames(run, 60);
  assert.ok(Math.abs(p.shield - 10) < 1e-6, "no regen within 2.5 s of a hit");
  frames(run, 60 * 3);
  assert.ok(p.shield > 10, "refilling again once the hit is 2.5 s old");
});

test("thorns: a landed hit damages the attacker by the flat amount and can kill it", () => {
  const { run } = quietRun();
  const p = run.player;
  p.stats.thorns = 25;
  p.stats.evasion = 0;
  const e = run.spawnEnemy(16, p.x + 1, p.z, "normal");
  e.hp = e.maxHp = 100;
  run.hitPlayer(1, e);
  assert.equal(e.hp, 75);
  p.iframes = 0;
  e.hp = 10;
  const kills = run.stats.kills;
  run.hitPlayer(1, e);
  assert.ok(e.hp <= 0 && e.dying > 0, "thorns finished it (killEnemy starts the death animation)");
  assert.equal(run.stats.kills, kills + 1);
});

test("thorns: an evaded hit reflects nothing", () => {
  const { run } = quietRun();
  const p = run.player;
  p.stats.thorns = 25;
  p.stats.evasion = 1;
  const e = run.spawnEnemy(16, p.x + 1, p.z, "normal");
  e.hp = 100;
  run.hitPlayer(1, e);
  assert.equal(e.hp, 100);
});

test("bounces: the player's bounces add to every move's ricochets", () => {
  const { run } = makeRun();
  const mv = run.player.moves[0];
  assert.equal(run.effectiveDef(mv).bounces ?? 0, 0);
  run.player.stats.bounces = 1;
  assert.equal(run.effectiveDef(mv).bounces, 1);
  mv.mods.bounce = 1;
  assert.equal(run.effectiveDef(mv).bounces, 2, "card bounce and stat bounce stack");
});

test("flinch: a hit can stop a normal enemy for half a second; bosses are immune", () => {
  const { run } = quietRun();
  const p = run.player;
  p.iframes = 1e9;
  p.stats.flinch = 0.5;
  p.moves.length = 0; // the auto-attack would re-flinch the target at 50% and kill a Pidgey
  const e = run.spawnEnemy(16, p.x + 4, p.z, "normal");
  frames(run, 6);
  withRandom(0.999, () => run.hitEnemy(e, 1, null));
  assert.equal(e.statuses.flinch, 0, "roll above the chance: no flinch");
  withRandom(0.1, () => run.hitEnemy(e, 1, null));
  assert.equal(e.statuses.flinch, 0.5);
  const x0 = e.x;
  frames(run, 12);
  assert.ok(Math.abs(e.x - x0) < 0.05, `stopped while flinching (moved ${Math.abs(e.x - x0)})`);
  frames(run, 40);
  assert.ok(e.x < x0 - 0.3, "chasing again after the flinch");

  const b = run.spawnEnemy(16, p.x + 6, p.z, "boss");
  withRandom(0, () => run.hitEnemy(b, 1, null));
  assert.equal(b.statuses.flinch, 0, "a boss does not flinch");
});

test("powerup: Poké Radar widens the drop brackets", () => {
  for (const [powerup, expectHeal] of [[1, false], [3, true]]) {
    const { run } = quietRun();
    run.player.stats.powerup = powerup;
    const e = run.spawnEnemy(16, 5, 5, "normal");
    const before = run.pickups.length;
    withRandom(0.15, () => run.killEnemy(e, { type: "normal", cls: "physical" }));
    const dropped = run.pickups.slice(before).map((k) => k.kind);
    assert.equal(dropped.includes("heal"), expectHeal, `powerup=${powerup}: ${dropped.join(",")}`);
    assert.ok(dropped.includes("xp"));
  }
});

test("eliteSpawn: Super Lure makes the elite waves bigger", () => {
  const count = (eliteSpawn) => {
    const { run } = quietRun();
    run.player.stats.eliteSpawn = eliteSpawn;
    run.director.addCard();
    run.enemies.length = 0;
    run.director.fire("elitewave");
    return run.enemies.filter((e) => e.tier === "elite").length;
  };
  const base = count(1);
  assert.ok(base >= 5, `a stage-1 wave spawns about 6 elites (got ${base})`);
  assert.ok(count(2) > base + 3, "double eliteSpawn, about double the wave");
});

test("enemyAmount: White Flute / Repel scale the director's population cap", () => {
  const { run } = makeRun();
  assert.equal(run.director.popCap(0), 10);
  run.player.stats.enemyAmount = 1.12;
  assert.equal(run.director.popCap(0), 11);
  run.player.stats.enemyAmount = 0.92;
  assert.equal(run.director.popCap(0), 9);
});

test("the stat block carries no stat without a source: knockback and slam are gone", () => {
  const { run } = makeRun();
  const stats = basePlayerStats(run.player.species, 1);
  assert.equal("knockback" in stats, false);
  assert.equal("slam" in stats, false);
});
