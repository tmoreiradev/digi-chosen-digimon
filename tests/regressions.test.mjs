// Regressions for behaviours that already worked plus the code-review fixes.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, fakeProfile, withRandom, spawnAlpha } from "./_helpers.mjs";

test("capture recruits the species as an ally and keeps its shiny flag", () => {
  const { run, calls } = makeRun();
  const e = spawnAlpha(run, 16);
  e.shiny = true;
  withRandom(0.99, () => run.capture.caught(e));
  assert.equal(run.allies.list.length, 1);
  assert.equal(run.allies.list[0].id, 16);
  assert.equal(run.allies.list[0].shiny, true);
  assert.equal(e.alive, false);
  assert.ok(run.pokedex.caught.has(16));
  assert.deepEqual(calls.caught, ["Pidgey"]);
});

test("full team: the oldest recruit leaves and formation slots stay contiguous", () => {
  const { run } = makeRun();
  assert.equal(run.allies.cap, 3);
  for (const id of [16, 19, 21, 23]) run.allies.recruit(run.data.get(id), 1, false);
  assert.deepEqual(run.allies.list.map((a) => a.id), [19, 21, 23]);
  assert.deepEqual(run.allies.list.map((a) => a.slot), [0, 1, 2]);
});

test("first capture unlocks the achievement and the banner goes through the run", () => {
  const { run, profile, calls } = makeRun();
  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16)));
  assert.ok(profile.data.achievements.unlocked.includes("first_catch"));
  assert.ok(calls.banners.some((b) => b.startsWith("Conquista: Primeiro Passo")));
  assert.deepEqual(profile.data.pokedex.caught, [16]);
});

test("nickname and held item persist into a new run", () => {
  const profile = fakeProfile({ nickname: "Bulba", heldItem: "leftovers" });
  const { run } = makeRun({ profile });
  assert.equal(run.player.nickname, "Bulba");
  assert.equal(run.player.heldItem, "leftovers");
});

test("move-upgrade cards apply the stat ups they display", () => {
  const { run } = makeRun();
  const p = run.player;
  let choice = null;
  for (let i = 0; i < 60 && !choice; i++) choice = run.rollChoices().find((c) => c.kind === "upMove");
  assert.ok(choice, "an upMove card is offered");
  assert.ok(choice.ups.length >= 2, "the card carries its ups");
  const mv = p.moves[choice.slot];
  const before = { ...mv.mods };
  run.applyChoice(choice);
  assert.equal(mv.level, 2);
  for (const u of choice.ups) {
    const key = u.key in before ? u.key : "status";
    assert.notEqual(mv.mods[key], before[key], `${u.key} was applied`);
  }
});

test("enemyById never falls back to another enemy; a defeated boss forgets its id", () => {
  const { run } = makeRun();
  const p = run.player;
  run.spawnEnemy(16, p.x + 5, p.z, "normal");
  assert.equal(run.enemyById(999999), null);

  const e = run.boss.spawn(93, p.x + 10, p.z, "guardian");
  assert.equal(run.boss.index, e.id);
  assert.ok(run.boss.alive);
  e.hp = 0;
  run.boss.update(1 / 60);
  assert.equal(run.boss.dead, true);
  assert.equal(run.boss.index, -1);
  assert.equal(run.boss.enemy, null);
});

test("idle frames do not write to the profile (eggs used to save every frame)", () => {
  const { run, profile } = makeRun();
  run.director.update = () => {}; // no spawns, so no new species either
  const before = profile.saves;
  for (let i = 0; i < 120; i++) run.update(1 / 60);
  assert.equal(profile.saves, before);
});

test("seeing a species saves once; repeated spawns of it do not", () => {
  const { run, profile } = makeRun();
  const p = run.player;
  const before = profile.saves;
  run.spawnEnemy(16, p.x + 5, p.z, "normal");
  assert.equal(profile.saves, before + 1);
  run.spawnEnemy(16, p.x + 6, p.z, "normal");
  run.spawnEnemy(16, p.x + 7, p.z, "normal");
  assert.equal(profile.saves, before + 1);
  assert.deepEqual(profile.data.pokedex.seen, [16]);
});

test("special allies fire a projectile carrying their power and type", () => {
  const { run } = makeRun();
  const abra = run.data.get(63);
  run.allies.recruit(abra, 1, false);
  const a = run.allies.list[0];
  assert.equal(a.physical, false);
  a.x = run.player.x;
  a.z = run.player.z;
  a.timer = 0;
  run.spawnEnemy(16, a.x + 5, a.z, "normal");
  run.allies.update(1 / 60);
  const pr = run.projectiles.find((q) => q.hostile === false && q.def?.slot === -1);
  assert.ok(pr, "ally projectile spawned");
  assert.equal(pr.dmg, run.allies.power(a), "damage is the ally's power (it used to be a fixed 10)");
  assert.equal(pr.speed, 16);
  assert.equal(pr.def.type, abra.types[0]);
});

test("a weakened (capturable) enemy stops dealing contact damage", () => {
  const { run } = makeRun();
  const p = run.player;
  p.stats.evasion = 0;
  p.iframes = 0;
  const e = run.spawnEnemy(16, p.x + 0.5, p.z, "alpha");
  e.captureReady = true;
  e.atkCd = 0;
  const hp = p.hp;
  run.updateEnemies(0.05);
  assert.equal(p.hp, hp, "no damage while weakened");
  e.captureReady = false;
  e.x = p.x + 0.5;
  e.z = p.z;
  run.updateEnemies(0.05);
  assert.ok(p.hp < hp, "damage resumes once it recovers");
});

test("music sequencer runs at the tempo in milliseconds", async () => {
  const { Music } = await import("../src/audio/music.js");
  const m = new Music();
  m.ctx = {};
  const orig = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  let captured = null;
  globalThis.setInterval = (fn, ms) => {
    captured = ms;
    return 1;
  };
  globalThis.clearInterval = () => {};
  try {
    m.start();
    m.stop();
  } finally {
    Object.assign(globalThis, orig);
  }
  assert.ok(captured > 200 && captured < 400, `forest at 110 bpm is ~273 ms per 8th, got ${captured}`);
});
