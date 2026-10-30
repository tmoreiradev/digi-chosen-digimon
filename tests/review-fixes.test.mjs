// Findings of the Codex review of 4c3e468..3826b81 (reviews/codex-2026-10-30-23-20-4c3e468..HEAD.md).
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

installFakeDom();
const { Hud } = await import("../src/ui/hud.js");
const { makeRun, withRandom } = await import("./_helpers.mjs");
const { setLang, getLang } = await import("../src/core/lang.js");

const poisonHit = { type: "poison", cls: "special", status: "poison", statusChance: 1 };

test("statusDamage scales burn and poison: Wormmon's Crest of Kindness gives +20 %", () => {
  const { run } = makeRun({ speciesId: 53 });
  const p = run.player;
  assert.equal(p.abilityKey, "kindness");
  const dps = () => {
    const e = run.spawnEnemy(16, p.x + 3, p.z, "elite");
    e.hp = e.maxHp = 1e6;
    withRandom(0.01, () => run.hitEnemy(e, 10, poisonHit));
    e.alive = false;
    return e.poisonDps;
  };
  const withCrest = dps();
  p.stats.statusDamage = 1;
  const plain = dps();
  assert.ok(plain > 0);
  assert.ok(Math.abs(withCrest / plain - 1.2) < 1e-6, `ratio ${withCrest / plain}`);
});

test("a summoner that is down, frozen or asleep calls no adds", () => {
  const { run } = makeRun();
  run.director.fire("summoner");
  const e = run.boss.enemy;
  const swarm = () => run.enemies.filter((n) => n.tier === "swarm").length;
  e.statuses.freeze = 5;
  run.boss.update(0.016);
  assert.equal(swarm(), 0, "frozen");
  e.statuses.freeze = 0;
  e.captureReady = true;
  run.boss.update(0.016);
  assert.equal(swarm(), 0, "weakened for capture");
  e.captureReady = false;
  run.boss.update(0.016);
  assert.equal(swarm(), 6, "fighting again: it calls");
});

test("the HUD counter labels follow a language switch made after the HUD was built", () => {
  const lang = getLang();
  try {
    setLang("pt-BR");
    const root = document.createElement("div");
    const hud = new Hud(root);
    const { run } = makeRun();
    hud.update(run);
    const labels = () => `${hud.goldLabel.textContent}|${hud.killsLabel.textContent}`;
    assert.equal(labels(), " ouro| abates");
    setLang("en");
    hud.update(run);
    assert.equal(labels(), " gold| kills");
  } finally {
    setLang(lang);
  }
});

test("every partner's passive changes the stats it announces", () => {
  const { run: probe } = makeRun();
  for (const r of probe.data.rules.roster) {
    const { run } = makeRun({ speciesId: r.id });
    const p = run.player;
    const kit = p.ability;
    const withIt = { ...p.stats, typeBoost: { ...p.stats.typeBoost } };
    p.ability = { name: "", desc: "", mods: [] };
    run.recompute(p);
    const without = p.stats;
    for (const m of kit.mods ?? []) {
      const want = m.add ? m.add > 0 : m.mul > 1;
      assert.equal(withIt[m.stat] > without[m.stat], want, `${r.passive}: ${m.stat}`);
    }
    for (const [t, v] of Object.entries(kit.typeBoost ?? {})) {
      assert.ok(Math.abs((withIt.typeBoost[t] ?? 1) - (without.typeBoost[t] ?? 1) - v) < 1e-9, `${r.passive}: +${v} ${t}`);
    }
    assert.ok(kit.mods?.length || kit.typeBoost || kit.lowHp || kit.dmgTaken, `${r.passive} does something`);
  }
});
