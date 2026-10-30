// Zone events (src/game/zoneevents.js): one per zone from the director's timeline.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";
import { PACK } from "../src/content/pack.js";
import { tr, setLang, getLang } from "../src/core/lang.js";
import { ZONE_EVENTS } from "../src/game/zoneevents.js";

/** Advance the zone event only (no spawns, no enemy AI), in small steps. */
const tick = (run, secs, dt = 0.05) => {
  for (let t = 0; t < secs; t += dt) {
    run.time += dt;
    run.zoneEvent.update(dt);
  }
};

test("one zone event per zone, mid-zone: 240–420 s in Classic, 120–220 s in Endless; firing it starts one", () => {
  for (const [mode, lo, hi] of [["classic", 240, 420], ["endless", 120, 220]]) {
    const { run } = makeRun({ mode });
    const evs = run.director.timeline.filter((e) => e.kind === "zoneEvent");
    assert.equal(evs.length, 1, mode);
    assert.ok(evs[0].t >= lo && evs[0].t <= hi, `${mode}: ${evs[0].t}`);
    run.director.onStage(2);
    assert.equal(run.director.timeline.filter((e) => e.kind === "zoneEvent").length, 1, `${mode}: zone 2 gets its own`);
    run.director.fire("zoneEvent");
    assert.ok(ZONE_EVENTS[run.zoneEvent.active?.kind], `${mode}: an event is running`);
  }
});

test("mist: wind/ghost enemies arrive, XP orbs count double while it lasts, then it ends", () => {
  const { run, calls } = makeRun();
  const before = run.enemies.length;
  run.zoneEvent.start("mist");
  const kin = run.enemies.slice(before);
  assert.equal(kin.length, 3 + run.stage);
  for (const e of kin) assert.ok(e.types.some((t) => t === "flying" || t === "ghost"), e.species.name);
  assert.ok(calls.banners.some((b) => b.startsWith("Névoa espectral")));
  const xp0 = run.player.xp;
  run.collect({ kind: "xp", value: 1 });
  const doubled = run.player.xp - xp0;
  tick(run, 46);
  assert.equal(run.zoneEvent.active, null, "45 s and it is over");
  const xp1 = run.player.xp;
  run.collect({ kind: "xp", value: 1 });
  assert.ok(Math.abs(doubled - 2 * (run.player.xp - xp1)) < 1e-9, "x2 during the mist");
});

test("storm: the bolt hurts the player standing on its mark, not one who walked away", () => {
  const { run } = makeRun();
  const p = run.player;
  run.zoneEvent.start("storm");
  const ev = run.zoneEvent.active;
  ev.strikeCd = 99; // marks placed by hand
  ev.marks.push({ x: p.x, z: p.z, t: 0 });
  const hp = p.hp;
  withRandom(0.99, () => tick(run, 1.3)); // no dodge roll
  assert.ok(p.hp < hp, "hit on the mark");
  assert.equal(ev.marks.length, 0, "the mark is spent");
  p.iframes = 0;
  ev.marks.push({ x: p.x + 5, z: p.z, t: 0 });
  const hp2 = p.hp;
  withRandom(0.99, () => tick(run, 1.3));
  assert.equal(p.hp, hp2, "five units away is safe");
});

test("eclipse: the creatures of the night come out, one of them shiny", () => {
  const { run } = makeRun();
  const before = run.enemies.length;
  withRandom(0.99, () => run.zoneEvent.start("eclipse")); // no natural shiny
  const kin = run.enemies.slice(before);
  assert.equal(kin.length, 3 + run.stage);
  for (const e of kin) assert.ok(e.types.some((t) => t === "dark" || t === "ghost"), e.species.name);
  assert.equal(kin.filter((e) => e.shiny).length, 1);
});

test("golden runner: the pack's species flees, drops a coin per hit, a shower when it falls, and escapes after 25 s", () => {
  const { run, calls } = makeRun();
  run.zoneEvent.start("golden");
  const g = run.zoneEvent.active.golden;
  assert.equal(g.species.id, PACK.goldenRunner);
  const p = run.player;
  const d0 = Math.hypot(g.x - p.x, g.z - p.z);
  for (let i = 0; i < 20; i++) run.updateEnemies(0.05);
  assert.ok(Math.hypot(g.x - p.x, g.z - p.z) > d0, "runs away");

  const coins = () => run.pickups.filter((k) => k.kind === "coin").length;
  run.time = 100;
  run.hitEnemy(g, 1, { type: "normal", cls: "physical" });
  assert.equal(coins(), 1);
  run.hitEnemy(g, 1, { type: "normal", cls: "physical" });
  assert.equal(coins(), 1, "same instant: no second coin");
  run.time += 0.2;
  run.hitEnemy(g, 1, { type: "normal", cls: "physical" });
  assert.equal(coins(), 2);
  run.hitEnemy(g, g.hp * 1e3, { type: "normal", cls: "physical" });
  assert.ok(coins() >= 14, "a shower of 12");
  assert.ok(calls.banners.includes("Pokémon dourado derrotado! Chuva de moedas!"));

  const { run: run2, calls: calls2 } = makeRun();
  run2.zoneEvent.start("golden");
  const g2 = run2.zoneEvent.active.golden;
  tick(run2, 26);
  assert.equal(g2.alive, false);
  assert.ok(calls2.banners.includes("O Pokémon dourado escapou!"));
});

test("zone event text reads in English and Spanish, with the pack's words", () => {
  const lang = getLang();
  try {
    for (const l of ["en", "es"]) {
      setLang(l);
      for (const def of Object.values(ZONE_EVENTS)) {
        assert.notEqual(tr(def.banner), def.banner.replace("Pokémon", "Digimon"), `${l}: ${def.banner}`);
        for (const s of [def.name, def.banner]) assert.ok(!tr(s).includes("Pokémon"), `${l}: ${tr(s)}`);
      }
    }
  } finally {
    setLang(lang);
  }
});
