// Interface fixes from the playtest of 30/10 (docs/PLAYTEST_2026-10-30.md).
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";
import { tr, setLang, getLang } from "../src/core/lang.js";

test("results count every card taken, not only the item cards, and remember who landed the last hit", () => {
  const { run } = makeRun();
  run.player.level = 5;
  for (let i = 0; i < 6; i++) {
    const choices = run.rollChoices();
    run.applyChoice(choices[0]);
  }
  assert.equal(run.stats.picks, 6);
  const foe = run.spawnEnemy(16, run.player.x + 1, run.player.z, "elite");
  run.player.hp = 1;
  run.player.iframes = 0;
  withRandom(0.99, () => run.hitPlayer(9999, foe));
  assert.equal(run.state, "dead");
  assert.equal(run.stats.killedBy, foe.species.name);
});

test("a type plug-in is offered only for a type the partner is or attacks with", () => {
  const { run } = makeRun({ speciesId: 1 }); // Agumon: Fire, and a Fire/Neutral kit
  const p = run.player;
  const kit = run.data.rosterFor(1).kit.map((k) => run.data.getMoveByKey(k).type);
  const useful = new Set([...p.types, ...kit]);
  p.level = 8;
  const offered = new Set();
  for (let i = 0; i < 400; i++) {
    for (const c of run.rollChoices()) {
      if (c.kind !== "item") continue;
      const up = run.rules.upgrades.find((u) => u.key === c.key);
      for (const t of up.tags ?? []) if (t.startsWith("type:")) offered.add(t.slice(5));
    }
  }
  assert.ok(offered.size > 0, "some type plug-in still shows up");
  for (const t of offered) assert.ok(useful.has(t), `offered a ${t} plug-in to Agumon`);
});

test("the guardian altar says when waking it is advised, in every language", () => {
  const { run } = makeRun();
  const altar = run.events.guardianAltar;
  run.stageTime = 60;
  assert.equal(run.events.hintFor(altar), "Acordar o guardião — E (recomendado em 4:00)");
  run.stageTime = 320;
  assert.equal(run.events.hintFor(altar), "Acordar o guardião — E");
  const lang = getLang();
  try {
    setLang("en");
    assert.equal(tr("Acordar o guardião — E (recomendado em 4:00)"), "Wake the guardian — E (best in 4:00)");
    setLang("es");
    assert.equal(tr("Acordar o guardião — E (recomendado em 4:00)"), "Despertar al guardián — E (mejor en 4:00)");
  } finally {
    setLang(lang);
  }
});
