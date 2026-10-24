// Every damaging archetype must actually damage a target in front of the player. Measuring each one
// found three that did not: lob (exploded in place), orbit (sampled its ring once per cast) and
// random/Metronome (no power of its own). Trail needs movement; buff and weather deal no damage.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";
import { buildMoveDef } from "../src/game/rules.js";

const NO_DAMAGE = new Set(["buff", "weather", "trail", "fusion"]);

test("each damaging archetype hurts a stationary target 3 units away within 10 s", () => {
  const { run: probe } = makeRun();
  const byArch = new Map();
  for (const mv of probe.data.moves) {
    const def = buildMoveDef(mv, probe.rules);
    if (def && !NO_DAMAGE.has(def.arch) && !byArch.has(def.arch)) byArch.set(def.arch, mv);
  }
  assert.ok(byArch.size >= 20, `archetypes covered: ${byArch.size}`);
  const silent = [];
  for (const [arch, mv] of byArch) {
    const { run } = makeRun();
    run.director.update = () => {};
    const p = run.player;
    p.iframes = 1e9;
    p.moves = [{ def: buildMoveDef(mv, run.rules), level: 1, timer: 0.1, mods: { dmg: 1, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 } }];
    const e = run.spawnEnemy(16, p.x + 3, p.z, "normal");
    e.hp = e.maxHp = 1e9;
    e.speed = 0;
    e.types = [];
    for (let i = 0; i < 600; i++) run.update(1 / 60);
    if (e.hp >= e.maxHp) silent.push(`${arch} (${mv.name})`);
  }
  assert.deepEqual(silent, []);
});
