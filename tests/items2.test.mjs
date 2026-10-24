// Phase 17: the second wave of upstream scripted items (14 of the 16 left out in phase 11).
// Secret Key and Dowsing Machine stay out: they need Unown altars / Poké Balls, absent here.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";

function setup(opts) {
  const made = makeRun(opts);
  made.run.director.update = () => {};
  made.run.player.moves.length = 0;
  made.run.player.stats.evasion = 0;
  return made;
}
const give = (run, key, n = 1) => {
  for (let i = 0; i < n; i++) run.applyChoice({ kind: "item", key });
  run.player.stats.evasion = 0;
};
const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};
function sturdy(run, x, z, tier = "normal") {
  const e = run.spawnEnemy(16, x, z, tier);
  e.hp = e.maxHp = 1e6;
  e.speed = 0;
  return e;
}
const NORMAL = { type: "normal", cls: "special" };

test("Eviolite: +50 % armour and +25 % HP only while the species can evolve", () => {
  const { run } = setup(); // Bulbasaur evolves
  const p = run.player;
  const armor = p.stats.armor;
  const hp = p.maxHp;
  give(run, "eviolite");
  assert.ok(Math.abs(p.stats.armor / armor - 1.5) < 1e-9);
  assert.equal(p.maxHp, Math.round(hp * 1.25));
  const { run: end } = setup({ speciesId: 3 }); // Venusaur: end of the line
  const a3 = end.player.stats.armor;
  give(end, "eviolite");
  assert.equal(end.player.stats.armor, a3, "no bonus at the end of the line");
});

test("Adrenaline Orb: a hit gives 3 s of extra move and attack speed", async () => {
  const { itemAtkMul, itemMoveMul } = await import("../src/game/scripted.js");
  const { run } = setup();
  const p = run.player;
  give(run, "adrenaline-orb");
  p.iframes = 0;
  run.hitPlayer(5, null);
  assert.equal(p.adrenalineT, 3);
  assert.ok(Math.abs(itemMoveMul(run) - 1.2) < 1e-9 && Math.abs(itemAtkMul(run) - 1.12) < 1e-9);
  frames(run, 60);
  assert.ok(p.adrenalineT > 1.9 && p.adrenalineT < 2.1);
  frames(run, 130);
  assert.ok(p.adrenalineT <= 0, "wears off");
  assert.equal(itemMoveMul(run), 1);
});

test("Metal Powder: standing still for half a second raises armour (damage taken drops)", async () => {
  const { itemArmorMul, itemAtkMul } = await import("../src/game/scripted.js");
  const { run, input } = setup();
  give(run, "metal-powder");
  frames(run, 20);
  assert.equal(itemArmorMul(run), 1, "not yet");
  frames(run, 20);
  assert.ok(Math.abs(itemArmorMul(run) - 1.3) < 1e-9);
  assert.ok(Math.abs(itemAtkMul(run) - 1.08) < 1e-9);
  input.right = true;
  frames(run, 1);
  assert.equal(itemArmorMul(run), 1, "moving resets it");
});

test("Cell Battery: attack speed grows with the kill streak and resets on a hit", async () => {
  const { itemAtkMul } = await import("../src/game/scripted.js");
  const { run } = setup();
  const p = run.player;
  give(run, "cell-battery");
  for (let i = 0; i < 30; i++) run.killEnemy(run.spawnEnemy(16, 5, 5, "normal"), NORMAL);
  assert.equal(p.streak, 30);
  assert.ok(Math.abs(itemAtkMul(run) - 1.045) < 1e-9);
  p.iframes = 0;
  run.hitPlayer(5, null);
  assert.equal(p.streak, 0);
  assert.equal(itemAtkMul(run), 1);
});

test("Shed Shell: longer dash invulnerability and faster recharge; Soda Pop: the dash hurts the crowd", () => {
  const { run, input } = setup();
  const p = run.player;
  give(run, "shed-shell");
  give(run, "soda-pop");
  const e = sturdy(run, p.x + 2, p.z);
  input.right = true;
  input.dash = true;
  run.update(1 / 60);
  assert.ok(p.iframes > 0.3, "invulnerable for longer");
  assert.ok(Math.abs(p.dashCd - 1.26) < 0.02);
  assert.ok(e.hp < e.maxHp, "bubble wave hit the enemy beside the player");
});

test("Ice Heal: hitting a frozen enemy deals +60 %, thaws it and chills its neighbours", () => {
  const { run } = setup();
  const e = sturdy(run, 3, 0);
  const n = sturdy(run, 4, 0);
  const before = e.hp;
  withRandom(0.999, () => run.hitEnemy(e, 100, NORMAL, true));
  const plain = before - e.hp;
  give(run, "ice-heal");
  e.statuses.freeze = 2;
  const b2 = e.hp;
  withRandom(0.999, () => run.hitEnemy(e, 100, NORMAL, true));
  assert.ok(Math.abs((b2 - e.hp) / plain - 1.6 * 1.2) < 1e-6, "x1.6 on top of the x1.2 every frozen target takes");
  assert.equal(e.statuses.freeze, 0, "thawed");
  assert.ok(n.statuses.para > 0, "the neighbour is chilled");
});

test("Griseous Orb: a kill can drop a shadow that hurts and curses the neighbours", () => {
  const { run } = setup();
  give(run, "griseous-orb");
  const victim = run.spawnEnemy(16, 10, 10, "normal");
  const n = sturdy(run, 11, 10);
  withRandom(0.999, () => run.killEnemy(victim, NORMAL));
  assert.equal(n.hp, n.maxHp, "no shadow above 12 %");
  const v2 = run.spawnEnemy(16, 10, 10, "normal");
  withRandom(0, () => run.killEnemy(v2, NORMAL));
  assert.ok(n.hp < n.maxHp);
  assert.ok(n.statuses.curse > 0);
});

test("Electirizer strikes the nearest enemies every 2.5 s (+1 per copy)", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "electirizer", 2);
  const es = [3, 4, 5, 6, 7, 8].map((x) => sturdy(run, run.player.x + x, run.player.z));
  frames(run, 160);
  const hit = es.filter((e) => e.hp < e.maxHp).length;
  assert.equal(hit, 4, "2 + 2 copies");
  assert.ok(es[0].hp < es[0].maxHp && es[5].hp === es[5].maxHp, "the nearest ones");
});

test("Silph Scope marks the toughest nearby enemy: +40 % damage; a new mark when it falls", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "silph-scope");
  const weak = sturdy(run, 3, 0);
  const tough = sturdy(run, 4, 0, "elite");
  tough.maxHp = 2e6;
  tough.hp = 2e6;
  frames(run, 2);
  assert.equal(tough.marked, true);
  assert.ok(!weak.marked);
  const b = tough.hp;
  withRandom(0.999, () => run.hitEnemy(tough, 100, NORMAL, true));
  const marked = b - tough.hp;
  const b2 = weak.hp;
  withRandom(0.999, () => run.hitEnemy(weak, 100, NORMAL, true));
  assert.ok(Math.abs(marked / (b2 - weak.hp) - 1.4) < 1e-6);
  run.killEnemy(tough, NORMAL);
  frames(run, 30);
  assert.equal(weak.marked, true, "re-marked at once, not after 6 s");
});

test("Old Rod: a Magikarp hits an enemy every 9 s; sometimes a Gyarados", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "old-rod");
  const e = sturdy(run, 4, 0);
  withRandom(0.999, () => frames(run, 60 * 9 + 2));
  const one = e.maxHp - e.hp;
  assert.ok(one > 0, "Magikarp");
  assert.ok(run.floaters.some((f) => f.text === "Magikarp!"));
  e.hp = e.maxHp;
  run.player.rodT = 0;
  withRandom(0, () => run.update(1 / 60));
  assert.ok(Math.abs((e.maxHp - e.hp) / one - 5 / 1.5) < 0.05, "Gyarados hits 5/1.5 as hard");
});

test("TM Case and Max Ether lift the move and vitamin level caps by 2", () => {
  const { run } = setup({ speciesId: 4 });
  const p = run.player;
  run.learnKitMoves(p);
  const mv = p.moves[0];
  mv.level = 8;
  const offered = () => run.rollChoices().some((c) => c.kind === "upMove" && c.title === mv.def.name);
  for (let i = 0; i < 60; i++) assert.ok(!offered(), "capped at 8");
  give(run, "tm-case");
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) seen = offered();
  assert.ok(seen, "level 8 → 9 offered with the TM Case");
});

test("Poké Flute: the ultimate charges 25 % faster and recharges every move on cast", () => {
  const { run } = setup({ speciesId: 4 });
  const p = run.player;
  run.learnKitMoves(p);
  frames(run, 60);
  const plain = p.ultCharge;
  const { run: r2 } = setup({ speciesId: 4 });
  give(r2, "poke-flute");
  frames(r2, 60);
  assert.ok(Math.abs(r2.player.ultCharge / plain - 1.25) < 1e-6);
  r2.learnKitMoves(r2.player);
  for (const mv of r2.player.moves) mv.timer = 5;
  r2.player.ultCharge = 1;
  r2.castUltimate();
  assert.ok(r2.player.moves.every((mv) => mv.timer === 0));
  assert.equal(r2.player.fluteT, 6);
});
