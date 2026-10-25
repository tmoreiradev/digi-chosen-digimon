// Content pack (src/content/pack.js): the engine reads its franchise constants from there, the
// pack agrees with the data tables, and none of its ids creep back into engine code.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PACK } from "../src/content/pack.js";
import { TYPE_COLORS } from "../src/game/rules.js";
import { TYPE_RGB } from "../src/render/palette.js";
import { typeName } from "../src/core/i18n.js";
import { tr, setLang, getLang, LANG_KEY } from "../src/core/lang.js";
import { loadData } from "./_helpers.mjs";

test("the pack's types are the type chart's types, and the engine's type tables come from them", () => {
  const data = loadData();
  assert.deepEqual(Object.keys(PACK.types).sort(), [...data.types.order].sort(), "types.json and the pack list the same types");
  for (const [k, t] of Object.entries(PACK.types)) {
    assert.equal(TYPE_COLORS[k], t.color);
    assert.deepEqual(TYPE_RGB[k], [(t.color >> 16) & 255, (t.color >> 8) & 255, t.color & 255]);
    assert.equal(typeName(k), t.pt);
  }
});

test("the pack's species exist: starters are the roster's starters, the fallback legendary and the Old Rod catches", () => {
  const data = loadData();
  const rosterStarters = data.rules.roster.filter((r) => r.start).map((r) => r.id).sort((a, b) => a - b);
  assert.deepEqual([...PACK.starters].sort((a, b) => a - b), rosterStarters);
  for (const id of [PACK.fallbackLegendary, PACK.oldRod.common, PACK.oldRod.rare]) assert.ok(data.get(id), `species ${id}`);
  for (const dir of PACK.spriteDirs) assert.ok(fs.existsSync(path.join("assets", dir)), `assets/${dir}`);
  assert.ok(LANG_KEY.startsWith(PACK.storagePrefix + "."), "storage keys use the pack's prefix");
});

test("a pack's word swaps apply to every on-screen text, after translation", () => {
  const lang = getLang();
  const saved = PACK.terms;
  try {
    // Each swap names a word of the TRANSLATED sentence ("Catch", "Captura"), which the pt-BR key
    // does not contain: it can only match after translation.
    PACK.terms = {
      "pt-BR": { Pokémon: "Digimon" },
      en: { Catch: "Scan", Pokémon: "Digimon" },
      es: { Captura: "Escanea", Pokémon: "Digimon" },
    };
    const line = "Capture seu primeiro Pokémon.";
    setLang("pt-BR");
    assert.equal(tr(line), "Capture seu primeiro Digimon.");
    setLang("en");
    assert.equal(tr(line), "Scan your first Digimon.");
    setLang("es");
    assert.equal(tr(line), "Escanea tu primer Digimon.");
  } finally {
    PACK.terms = saved;
    setLang(lang);
  }
  assert.equal(tr("Pokédex"), "Pokédex", "the Pokémon pack swaps nothing");
});

test("engine code does not hard-code the pack's ids again", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (file.endsWith(".js") && !file.includes(`${path.sep}content${path.sep}`)) {
        const src = fs.readFileSync(file, "utf8");
        if (/\[1, 4, 7\]|pick\(candidates\) : \d+|"Magikarp!"|"Gyarados!"|"pokebonk-clone\.|"pmd\/|`pmd\//.test(src)) offenders.push(file);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});
