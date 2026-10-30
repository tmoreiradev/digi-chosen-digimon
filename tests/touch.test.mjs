// Touch controls (src/ui/touch.js): the joystick vector and the analog movement it drives.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";
import { stickVector } from "../src/ui/touch.js";

test("joystick: dead zone in the middle, full length at the rim and beyond, direction kept", () => {
  assert.deepEqual(stickVector(5, 0), [0, 0]);
  const [x, z] = stickVector(28, 0);
  assert.ok(Math.abs(x - 0.5) < 1e-9 && z === 0, "half travel, half speed");
  const [fx, fz] = stickVector(300, 400);
  assert.ok(Math.abs(Math.hypot(fx, fz) - 1) < 1e-9, "capped at 1");
  assert.ok(Math.abs(fx / fz - 0.75) < 1e-9);
});

test("the run moves the player along the joystick vector, slower when the stick is half pushed", () => {
  const speedFor = (moveX) => {
    const { run, input } = makeRun();
    run.enemies = [];
    input.moveX = moveX;
    input.moveZ = 0;
    const x0 = run.player.x;
    for (let i = 0; i < 60; i++) run.updatePlayer(1 / 60);
    return run.player.x - x0;
  };
  const full = speedFor(1);
  const half = speedFor(0.5);
  assert.ok(full > 2, `moved ${full.toFixed(2)} u in a second`);
  assert.ok(Math.abs(half / full - 0.5) < 0.05, `half stick: ${(half / full).toFixed(2)} of full speed`);
});

test("styles.css closes every block it opens (a stray brace once dropped the phone HUD rules)", async () => {
  const fs = await import("node:fs");
  const css = fs.readFileSync("styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const [i, line] of css.split("\n").entries()) {
    for (const c of line) {
      if (c === "{") depth++;
      if (c === "}") depth--;
      assert.ok(depth >= 0, `stray "}" on line ${i + 1} of styles.css (comments stripped)`);
    }
  }
  assert.equal(depth, 0);
});
