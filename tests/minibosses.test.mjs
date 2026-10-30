// Classic zone mini-bosses (totem, summoner) and the portal that ends a zone.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";

/** Defeat the boss currently up: it reaches 0 HP and Boss.update notices. */
const defeatBoss = (run) => {
  const e = run.boss.enemy;
  run.killEnemy(e, { type: "normal", cls: "physical" });
  run.boss.update(0.016);
};

test("the Classic timeline wakes a summoner in every zone and a totem from zone 2 on", () => {
  const { run } = makeRun();
  const kinds = (d) => d.timeline.filter((e) => e.kind === "totem" || e.kind === "summoner").map((e) => e.kind).sort();
  assert.deepEqual(kinds(run.director), ["summoner"]);
  run.stage = 2;
  run.director.onStage(2);
  assert.deepEqual(kinds(run.director), ["summoner", "totem"]);
  const { run: endless } = makeRun({ mode: "endless" });
  assert.deepEqual(kinds(endless.director), [], "Classic only");
});

test("a totem is a boss fight with a reward that does not end the zone, and the guardian waits for it", () => {
  const { run, calls } = makeRun();
  run.stage = 2;
  run.director.onStage(2);
  run.director.fire("totem");
  assert.equal(run.boss.alive, true);
  assert.equal(run.boss.kind, "totem");
  assert.equal(run.callGuardian(), false, "one boss at a time");
  assert.ok(calls.banners.some((b) => /^Derrote .+ antes de acordar o guardião\.$/.test(b)));
  defeatBoss(run);
  assert.equal(run.stage, 2, "the zone goes on");
  assert.ok(run.pickups.some((k) => k.kind === "candy"), "a reward");
  assert.equal(run.callGuardian(), true, "now the guardian wakes");
});

test("a Classic summoner calls the zone's species around itself; a tower one does not", () => {
  const { run } = makeRun();
  run.director.fire("summoner");
  assert.equal(run.boss.kind, "summoner");
  const before = run.enemies.filter((e) => e.tier === "swarm").length;
  run.boss.update(0.016);
  assert.equal(run.enemies.filter((e) => e.tier === "swarm").length, before + 6);

  const { run: tower } = makeRun({ mode: "tower" });
  tower.boss.spawn(tower.director.cards[0].id, 5, 5, "summoner", { hpMult: 1, dmgMult: 1, effSeconds: 0 });
  const n = tower.enemies.length;
  tower.boss.update(0.016);
  assert.equal(tower.enemies.length, n);
});

test("the zone guardian opens a portal: the next zone starts when the player walks in, the sanctuary after zone 3", () => {
  const { run, calls } = makeRun();
  run.stageTime = 320;
  assert.equal(run.callGuardian(), true);
  defeatBoss(run);
  assert.equal(run.stage, 1, "still zone 1: collect what is left first");
  assert.ok(calls.banners.includes("Zona 1 limpa! Entre no portal."));
  const portal = run.events.events.find((e) => e.kind === "portal");
  assert.ok(portal, "a portal stands");
  run.player.x = portal.x;
  run.player.z = portal.z;
  run.events.interact();
  assert.equal(run.stage, 2);
  run.events.update(0.016);
  assert.ok(!run.events.events.some((e) => e.kind === "portal"), "the portal is spent");

  run.stage = 3;
  run.zoneBossSpawned = false;
  assert.equal(run.callGuardian(), true);
  defeatBoss(run);
  assert.equal(run.sanctuary, false);
  assert.equal(run.enterPortal(), true);
  assert.equal(run.sanctuary, true);
});
