// The Digimon content pack: the tables hold together, and the engine plays them as Digimon.
// (The engine's own tests live in the engine repository; this fork checks its content.)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PACK } from "../src/content/pack.js";
import { tr, setLang, getLang } from "../src/core/lang.js";
import { loadData, makeRun, withRandom } from "./_helpers.mjs";

const data = loadData();

test("pack and tables agree: types, starters, legendary, Old Rod, sprite folder, save prefix", () => {
  assert.equal(PACK.id, "digimon");
  assert.deepEqual(Object.keys(PACK.types).sort(), [...data.types.order].sort());
  const starters = data.rules.roster.filter((r) => r.start).map((r) => r.id).sort((a, b) => a - b);
  assert.deepEqual([...PACK.starters].sort((a, b) => a - b), starters);
  for (const id of [PACK.fallbackLegendary, PACK.oldRod.common, PACK.oldRod.rare, PACK.goldenRunner]) assert.ok(data.get(id), `species ${id}`);
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
    const weak = "Bakemon está enfraquecido! Aperte E para lançar a bola";
    assert.equal(tr(weak), "Bakemon está enfraquecido! Aperte E para usar o Digivice");
    setLang("en");
    assert.equal(tr(weak), "Bakemon is weakened! Press E to use the Digivice");
    assert.match(tr("Roguelite survivor · Kanto · offline"), /File Island/);
    setLang("es");
    assert.equal(tr("Pokédex"), "DigiDex");
    assert.equal(tr(weak), "¡Bakemon está debilitado! Pulsa E para usar el Digivice");
  } finally {
    setLang(lang);
  }
});

test("NSS art: the portraits NSS has (130+); every starter has one; Guilmon, Gatomon and Gigimon walk, idle, attack, get hurt and faint", async () => {
  const { readPng } = await import("../scripts/nss.mjs");
  const withFace = data.pokemon.filter((p) => data.sprites[p.id]?.portrait);
  assert.ok(withFace.length >= 130, `${withFace.length} of ${data.pokemon.length} Digimon have an NSS portrait`);
  for (const p of withFace) {
    assert.equal(data.sprites[p.id].portrait, `portraits/${p.id}.png`);
    const face = readPng(path.join("assets", "portraits", `${p.id}.png`));
    assert.deepEqual([face.w, face.h], [40, 40]);
  }
  for (const id of [1, 5, 9, 23, 27]) assert.ok(data.sprites[id]?.portrait, `starter ${id} has a portrait`);
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

test("ids 1–31 never move (saves and the DigiDex store ids); Adventure, 02 and Tamers are all in", () => {
  const fixed = ["Agumon", "Greymon", "MetalGreymon", "WarGreymon", "Gabumon", "Garurumon", "WereGarurumon", "MetalGarurumon", "Patamon", "Angemon", "MagnaAngemon", "Seraphimon", "Tentomon", "Kabuterimon", "Palmon", "Togemon", "Gomamon", "Ikkakumon", "Kunemon", "Goblimon", "Leomon", "Devimon", "Guilmon", "Growlmon", "WarGrowlmon", "Gallantmon", "Salamon", "Gatomon", "Angewomon", "Magnadramon", "Gigimon"];
  fixed.forEach((name, i) => assert.equal(data.get(i + 1).name, name, `id ${i + 1}`));
  for (const name of ["Biyomon", "Phoenixmon", "Veemon", "Imperialdramon", "Hawkmon", "Armadillomon", "Wormmon", "Terriermon", "Renamon", "Sakuyamon", "Impmon", "Beelzemon", "Myotismon", "Piedmon", "Apocalymon", "Daemon"]) {
    assert.ok(data.pokemon.some((p) => p.name === name), name);
  }
  assert.ok(data.rules.roster.length >= 15, "partners from all three seasons");
});

test("NSS index: a name's main form wins over alternate forms in any order (Black Agumon, Tailmon's forms)", async () => {
  const os = await import("node:os");
  const { nssFolders } = await import("../scripts/nss.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nss-"));
  try {
    fs.writeFileSync(path.join(dir, "index.csv"), [
      `"Digimon","Forma","NssId","Pasta"`,
      `"Agumon","Agumon","160","0160"`,
      `"Agumon","Black","160","0160/0001"`,
      `"Tailmon","Alternate","417","0417/0002"`,
      `"Tailmon","Tailmon","417","0417"`,
      `"Unimon","Shima","327","0327/0001"`,
    ].join("\r\n"));
    const folders = nssFolders(dir);
    assert.equal(folders[1], "0160", "Agumon, not Black Agumon");
    assert.equal(folders[28], "0417", "Gatomon = Tailmon's main form, listed last");
    const unimon = data.pokemon.find((p) => p.name === "Unimon").id;
    assert.equal(folders[unimon], "0327/0001", "no main row: the first one");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("recell: a drawing drifted into the cell below goes back to its own cell, feet down, alpha hard", async () => {
  const { recellPixels } = await import("../scripts/recell.mjs");
  const w = 64, h = 80; // 2x2 cells of 32x40
  const px = Buffer.alloc(w * h * 4);
  const put = (x, y, a = 250) => px.set([200, 50, 50, a], (y * w + x) * 4);
  // A 6x20 body in cell (0,0) drifted 25 px down: rows 25..44, its last 5 rows inside cell (0,1).
  for (let y = 25; y < 45; y++) for (let x = 3; x < 9; x++) put(x, y);
  put(50, 10, 8); // haze far away: not a drawing
  const out = recellPixels({ w, h, px });
  const alpha = (x, y) => out[(y * w + x) * 4 + 3];
  assert.equal(alpha(13, 38), 255, "feet on row 38 of cell (0,0), centred");
  assert.equal(alpha(13, 19), 255, "top of the body");
  assert.equal(alpha(13, 18), 0);
  for (let y = 40; y < 80; y++) for (let x = 0; x < 32; x++) assert.equal(alpha(x, y), 0, "nothing left in cell (0,1)");
  assert.equal(alpha(50, 10), 0, "haze dropped");
});

test("every Digimon walks, stands, attacks, gets hurt and faints on the map: 8 directions with every cell drawn", async () => {
  const { readPng } = await import("../scripts/nss.mjs");
  const sprites = JSON.parse(fs.readFileSync("src/data/sprites.json", "utf8"));
  for (const p of data.pokemon) {
    for (const kind of ["walk", "idle", "attack", "hurt", "faint"]) {
      const a = sprites[p.id]?.anims?.[kind];
      assert.ok(a, `${p.name} has a ${kind} sheet`);
      assert.equal(a.rows, 8, `${p.name}: 8 directions`);
      const { w, px } = readPng(path.join("assets", "sprites", String(p.id), a.file));
      for (let r = 0; r < a.rows; r++) {
        for (let c = 0; c < a.n; c++) {
          let n = 0;
          for (let y = 0; y < a.fh; y++) for (let x = 0; x < a.fw; x++) n += px[((r * a.fh + y) * w + c * a.fw + x) * 4 + 3] ? 1 : 0;
          assert.ok(n >= 40, `${p.name} (${p.id}): ${kind} row ${r}, frame ${c} is empty`);
        }
      }
    }
  }
});

test("recell: drawings touching across rows are cut on the grid, and an empty direction borrows its mirror", async () => {
  const { recellPixels } = await import("../scripts/recell.mjs");
  const w = 32, h = 320; // one column, 8 rows of 32x40
  const px = Buffer.alloc(w * h * 4);
  const put = (x, y) => px.set([90, 90, 200, 255], (y * w + x) * 4);
  // Rows 0 and 1: two bodies touching at the line (y 5 to 75), one 6-wide blob.
  for (let y = 5; y <= 75; y++) for (let x = 10; x < 16; x++) put(x, y);
  // Rows 2..6 drawn (a 10x10 block each, left-leaning in row 2 so the mirror is visible); row 7 empty.
  for (let r = 2; r < 7; r++) for (let y = 20; y < 30; y++) for (let x = 4; x < 14; x++) put(x, r * 40 + y);
  const out = recellPixels({ w, h, px });
  const cell = (r) => { let n = 0; for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) n += out[((r * 40 + y) * w + x) * 4 + 3] ? 1 : 0; return n; };
  for (let r = 0; r < 8; r++) assert.ok(cell(r) >= 40, `row ${r} drawn`);
});

test("borrowed motion: one lunge per attack toward the facing, and a fainted body lies on the ground", async () => {
  const { creatureMotion } = await import("../src/render/renderer.js");
  const at = (clock, dirX, dirZ) => creatureMotion({ anim: "attack", clock, dirX, dirZ }, 100);
  assert.equal(Math.round(at(0, 1, 0).dx), 0);
  assert.equal(Math.round(at(120, 1, 0).dx), 0);
  assert.ok(at(60, 1, 0).dx > 15, "peak in the middle");
  assert.ok(at(30, 1, 0).dx > 10, "no return to rest a quarter of the way (it used to restart every 30)");
  assert.ok(at(60, 0, 1).dy > 5 && Math.abs(at(60, 0, 1).dx) < 1e-9, "facing down lunges down");
  const lying = creatureMotion({ anim: "faint", clock: 60, dirX: 1 }, 100);
  assert.ok(Math.abs(lying.rot) > 1.5 && lying.dy < -20, "rotated and lifted");
});

test("items read as Digimon: cards, vitamins, held items, the shop and the item banners carry no Pokémon item name", async () => {
  const { HELD_ITEMS } = await import("../src/game/scripted.js");
  const { itemDesc } = await import("../src/core/i18n.js");
  const plain = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  // The Pokémon item names are the keys spelled out ("quick-claw" → "Quick Claw", "kings-rock" → "King’s Rock").
  const pokemonName = (key, name) => plain(name) === plain(key);
  for (const u of [...data.rules.upgrades, ...data.rules.vitamins]) {
    assert.ok(u.name && !pokemonName(u.key, u.name), `${u.key}: "${u.name}"`);
  }
  for (const key of HELD_ITEMS) assert.ok(!pokemonName(key, data.items[key].name), `held ${key}: "${data.items[key].name}"`);
  assert.equal(data.rules.upgrades.find((u) => u.key === "charcoal").name, "Fire Plug-in");

  // The level-up card shows that name, not the key.
  const { run } = makeRun();
  const seen = new Set();
  for (let i = 0; i < 200; i++) for (const c of run.rollChoices()) if (c.kind === "item") seen.add(c.title);
  assert.ok(seen.size > 5, "item cards rolled");
  for (const title of seen) assert.ok(data.rules.upgrades.some((u) => u.name === title), `card "${title}"`);

  const lang = getLang();
  try {
    for (const [code, candy] of [["pt-BR", "Doce Raro"], ["en", "Doce Raro"], ["es", "Doce Raro"]]) {
      setLang(code);
      assert.equal(tr(candy), "XP Chip", code);
      assert.match(tr("Focus Sash! Sobreviveu com 1 HP"), /^¡?Last Stand Chip!/, code);
      assert.match(tr("Focus Band! Sobreviveu com 1 HP"), /^¡?Guts Band!/, code);
      assert.match(tr(itemDesc("old-rod", {})), /Gomamon.*Ikkakumon/, `${code}: the Fishing Pole catches Digimon`);
    }
  } finally {
    setLang(lang);
  }
});

test("tower: wave elites drop a candy only sometimes (a sure one each put the player at the level cap by floor 3)", () => {
  const { run } = makeRun({ mode: "tower" });
  run.tower.spawnWave(run);
  const elites = run.enemies.filter((e) => e.tier === "elite");
  assert.ok(elites.length >= 3, `a wave has elites (got ${elites.length})`);
  for (const e of elites) assert.equal(e.freeElite, true);
});

test("tower floors are named for Digimon in every language", async () => {
  const { towerFloorName } = await import("../src/core/i18n.js");
  const lang = getLang();
  try {
    for (const code of ["pt-BR", "en", "es"]) {
      setLang(code);
      for (const f of data.rules.tower.floors) assert.doesNotMatch(tr(towerFloorName(f.name)), /Marowak|Silph|Pokémon/, `${code}: ${f.name}`);
    }
    setLang("pt-BR");
    assert.equal(towerFloorName("Wizardmon's Memory"), "Memória de Wizardmon");
  } finally {
    setLang(lang);
  }
});

test("Vaccine beats Virus, Virus beats Data, Data beats Vaccine — both ways, Free neutral", async () => {
  const { attributeMult } = await import("../src/game/rules.js");
  const r = data.rules;
  assert.equal(attributeMult(r, "vaccine", "virus"), 1.1);
  assert.equal(attributeMult(r, "virus", "data"), 1.1);
  assert.equal(attributeMult(r, "data", "vaccine"), 1.1);
  assert.equal(attributeMult(r, "virus", "vaccine"), 1 / 1.1);
  assert.equal(attributeMult(r, "free", "virus"), 1);
  assert.equal(attributeMult({}, "vaccine", "virus"), 1, "a pack without the table is neutral");
  for (const p of data.pokemon) assert.ok(["vaccine", "data", "virus", "free"].includes(p.attribute), p.name);

  // In play: Agumon (Vaccine) hits a Virus harder than a Data, and a Virus hits Agumon softer.
  const { run } = makeRun();
  const byAttr = (a) => data.pokemon.find((p) => p.attribute === a && !p.legendary && p.types.join() === "fire").id;
  const hit = (attr) => {
    const e = run.spawnEnemy(byAttr(attr), 30, 30);
    e.hp = e.maxHp = 1e9;
    withRandom(0.99, () => run.hitEnemy(e, 100, { cls: "physical", type: "normal" }, true)); // no crit roll
    return 1e9 - e.hp;
  };
  const vsVirus = hit("virus");
  const vsData = hit("data");
  assert.ok(Math.abs(vsVirus / vsData - 1.21) < 0.03, `Vaccine vs Virus / vs Data = ${(vsVirus / vsData).toFixed(3)}`);
  const hurt = (attr) => {
    const p = run.player;
    p.hp = p.maxHp = 1e6;
    p.iframes = 0;
    const src = run.spawnEnemy(byAttr(attr), 40, 40);
    withRandom(0.99, () => run.hitPlayer(100, src)); // no dodge roll
    return 1e6 - p.hp;
  };
  assert.ok(hurt("virus") < hurt("data"), "a Virus hurts a Vaccine less than a Data does");
});

test("six regions of the Digital World: every Mega villain rules exactly one, cast and text in place", async () => {
  const { biomeName, biomeDesc } = await import("../src/core/i18n.js");
  const biomes = data.rules.biomes;
  assert.deepEqual(biomes.map((b) => b.id), ["forest", "desert", "coast", "glacier", "graveyard", "volcano"]);
  const rulers = biomes.flatMap((b) => b.legendaries);
  const villains = data.pokemon.filter((p) => p.legendary).map((p) => p.id);
  assert.deepEqual([...rulers].sort((a, b) => a - b), [...villains].sort((a, b) => a - b), "each legendary in one region");
  for (const b of biomes) {
    for (const id of b.residents) assert.equal(data.get(id).evoStage, 0, `${b.id}: resident ${data.get(id).name} is a Rookie family`);
    for (const zone of b.guardians) for (const id of zone) assert.ok(data.get(id).evoStage >= 1 && !data.get(id).legendary, `${b.id}: guardian ${id}`);
    assert.equal(b.guardians.length, 3);
  }
  const lang = getLang();
  try {
    for (const code of ["pt-BR", "en", "es"]) {
      setLang(code);
      const names = biomes.map((b) => biomeName(b));
      assert.equal(new Set(names).size, 6, `${code}: six names`);
      for (const b of biomes) assert.doesNotMatch(biomeName(b) + biomeDesc(b), /Lavand|Lavender|Pokémon|Torre Lav/, `${code}: ${b.id}`);
    }
    setLang("pt-BR");
    assert.equal(biomeName(biomes[1]), "Continente Server");
  } finally {
    setLang(lang);
  }
});

test("recell: an empty frame borrows its nearest neighbour, left first (an attack frame, not the faint column)", async () => {
  const { recellPixels } = await import("../scripts/recell.mjs");
  const w = 192, h = 40; // one row of an action sheet: 4 attack frames, hurt, faint
  const px = Buffer.alloc(w * h * 4);
  const block = (c, colour) => { for (let y = 20; y < 30; y++) for (let x = 10; x < 20; x++) px.set([...colour, 255], (y * w + c * 32 + x) * 4); };
  block(0, [200, 0, 0]);
  block(1, [210, 0, 0]);
  block(4, [0, 0, 200]); // hurt
  block(5, [0, 200, 0]); // faint
  const out = recellPixels({ w, h, px });
  const red = (c) => { for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) { const i = (y * w + c * 32 + x) * 4; if (out[i + 3]) return out[i] > 150; } return false; };
  assert.ok(red(2) && red(3), "frames 3 and 4 copy the attack frame before them");
});

test("idle from raw art: each drawing keeps its shape and stands as tall as the walk, feet on the same row", async () => {
  const { cutRaw } = await import("../scripts/recell.mjs");
  // The walk: one row of 4 frames 10 px wide, 30 px tall, feet on row 38.
  const walk = { w: 128, h: 40, px: Buffer.alloc(128 * 40 * 4) };
  for (let c = 0; c < 4; c++) for (let y = 9; y <= 38; y++) for (let x = 11; x < 21; x++) walk.px.set([200, 100, 0, 255], (y * 128 + c * 32 + x) * 4);
  // The raw art: 2 wide cells of 400x250, each drawing 60 x 180 (1:3), the second 6 px taller (breathing in).
  const raw = { w: 800, h: 250, px: Buffer.alloc(800 * 250 * 4) };
  for (let c = 0; c < 2; c++) for (let y = 40 - c * 6; y < 220; y++) for (let x = 170; x < 230; x++) raw.px.set([0, 90, 200, 255], (y * 800 + c * 400 + x) * 4);
  const { px, reached } = cutRaw(raw, walk, 2, 1);
  assert.equal(reached, 1);
  const extent = (c) => {
    const xs = [], ys = [];
    for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) if (px[(y * 64 + c * 32 + x) * 4 + 3]) { xs.push(x); ys.push(y); }
    return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1, feet: Math.max(...ys) };
  };
  const rest = extent(0);
  const breath = extent(1);
  assert.equal(rest.h, 30, "as tall as the walk");
  assert.equal(rest.w, 10, "1:3 kept (squeezing the raw art into 64 px would make it 5 wide)");
  assert.equal(rest.feet, 38);
  assert.equal(breath.feet, 38);
  assert.equal(breath.h, 31, "the breath keeps its extra height, at the same scale");
});
