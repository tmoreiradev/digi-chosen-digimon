// The Digimon content pack: the tables hold together, and the engine plays them as Digimon.
// (The engine's own tests live in the engine repository; this fork checks its content.)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PACK } from "../src/content/pack.js";
import { tr, setLang, getLang } from "../src/core/lang.js";
import { loadData, makeRun } from "./_helpers.mjs";

const data = loadData();

test("pack and tables agree: types, starters, legendary, Old Rod, sprite folder, save prefix", () => {
  assert.equal(PACK.id, "digimon");
  assert.deepEqual(Object.keys(PACK.types).sort(), [...data.types.order].sort());
  const starters = data.rules.roster.filter((r) => r.start).map((r) => r.id).sort((a, b) => a - b);
  assert.deepEqual([...PACK.starters].sort((a, b) => a - b), starters);
  for (const id of [PACK.fallbackLegendary, PACK.oldRod.common, PACK.oldRod.rare]) assert.ok(data.get(id), `species ${id}`);
  for (const dir of PACK.spriteDirs) assert.ok(fs.existsSync(path.join("assets", dir)));
  assert.notEqual(PACK.storagePrefix, "pokebonk-clone", "saves apart from the Pokémon game");
});

test("every species, attack, partner, region and tower floor points at data that exists", () => {
  const types = new Set(data.types.order);
  for (const p of data.pokemon) {
    for (const t of p.types) assert.ok(types.has(t), `${p.name}: type ${t}`);
    if (p.evoFrom != null) {
      const from = data.get(p.evoFrom);
      assert.ok(from, `${p.name}: evoFrom ${p.evoFrom}`);
      assert.equal(p.evoStage, from.evoStage + 1, `${p.name} is one stage after ${from.name}`);
    }
    assert.ok(data.get(p.family), `${p.name}: family ${p.family}`);
  }
  for (const m of data.moves) {
    assert.ok(types.has(m.type), `${m.key}: type ${m.type}`);
    assert.ok(data.rules.archetypes[data.rules.moveOverrides[m.key]], `${m.key}: archetype ${data.rules.moveOverrides[m.key]}`);
  }
  for (const r of data.rules.roster) {
    assert.ok(data.get(r.id), `partner ${r.id}`);
    assert.ok(data.rules.abilityKits[r.passive], `partner ${r.id}: passive ${r.passive}`);
    for (const k of r.kit) assert.ok(data.getMoveByKey(k), `partner ${r.id}: attack ${k}`);
  }
  for (const b of data.rules.biomes) {
    for (const id of [...b.guardians.flat(), ...b.bosses, ...b.legendaries]) assert.ok(data.get(id), `${b.id}: species ${id}`);
    for (const t of [...b.types, ...b.late]) assert.ok(types.has(t), `${b.id}: type ${t}`);
  }
  for (const f of data.rules.tower.floors) {
    for (const id of [...f.pool, f.guardian.id]) assert.ok(data.get(id), `tower ${f.name}: species ${id}`);
  }
});

test("Agumon digivolves Greymon at 12, MetalGreymon at 26, WarGreymon at 40, and the ultimate follows", () => {
  const { run } = makeRun({ speciesId: 1 });
  const p = run.player;
  assert.equal(run.ultimateName(), "Baby Burner");
  const line = [];
  while (p.level < 45) {
    run.addXp(p.xpNext - p.xp);
    if (run.tryEvolve()) line.push(`${p.species.name}@${p.level}`);
  }
  assert.deepEqual(line, ["Greymon@12", "MetalGreymon@26", "WarGreymon@40"]);
  assert.equal(run.ultimateName(), "Gaia Force");
});

test("the franchise words read Digimon in every language", () => {
  const lang = getLang();
  try {
    setLang("pt-BR");
    assert.equal(tr("Capture seu primeiro Pokémon."), "Capture seu primeiro Digimon.");
    assert.equal(tr("Pokédex"), "DigiDex");
    setLang("en");
    assert.match(tr("Roguelite survivor · Kanto · offline"), /File Island/);
    setLang("es");
    assert.equal(tr("Pokédex"), "DigiDex");
  } finally {
    setLang(lang);
  }
});

test("NSS art: every Digimon has a portrait; Guilmon, Gatomon and Gigimon walk, idle, attack, get hurt and faint", async () => {
  const { readPng, NSS_IDS } = await import("../scripts/nss.mjs");
  for (const p of data.pokemon) {
    assert.ok(NSS_IDS[p.id], `${p.name} has an NSS id`);
    assert.equal(data.sprites[p.id]?.portrait, `portraits/${p.id}.png`, `${p.name} portrait`);
    const face = readPng(path.join("assets", "portraits", `${p.id}.png`));
    assert.deepEqual([face.w, face.h], [40, 40]);
  }
  for (const id of [23, 28, 31]) {
    const anims = data.sprites[id].anims;
    for (const name of ["walk", "idle", "attack", "hurt", "faint"]) {
      const a = anims[name];
      assert.ok(a, `${id}: ${name}`);
      const img = readPng(path.join("assets", "sprites", String(id), a.file));
      assert.equal(img.w, a.n * a.fw, `${id} ${name}: frames fill the width`);
      assert.equal(img.h, a.rows * a.fh, `${id} ${name}: rows fill the height`);
      assert.equal(a.d.length, a.n, `${id} ${name}: one duration per frame`);
      const [top, bottom] = data.spriteBounds[id][name];
      assert.ok(top >= 0 && bottom < a.fh && top < bottom, `${id} ${name}: bounds ${top}-${bottom} inside the frame`);
    }
  }
});
