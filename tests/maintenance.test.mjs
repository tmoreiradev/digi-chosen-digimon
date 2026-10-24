// BACKLOG 17, 18: the dev server survives malformed URLs and stays inside its root; captures are not
// counted as upgrades and the per-enemy attempt bonus is forgotten once that enemy is gone.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { handle } from "../server.mjs";
import { makeRun, withRandom, spawnAlpha } from "./_helpers.mjs";

async function get(path) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address();
  try {
    return await new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }).on("error", reject);
    });
  } finally {
    srv.close();
  }
}

test("dev server: malformed %-escape is a 400, not a crash; the root still serves", async () => {
  assert.equal(await get("/%E0%A4%A"), 400);
  assert.equal(await get("/"), 200, "still alive after the bad request");
  assert.equal(await get("/package.json"), 200);
});

test("dev server: no escape to a sibling folder or a parent", async () => {
  const sibling = await get("/..%2F" + encodeURIComponent("Projeto Padrão") + "2/x.txt");
  assert.ok(sibling === 403 || sibling === 404, `sibling: ${sibling}`);
  assert.notEqual(await get("/..%2F..%2Fwindows%2Fwin.ini"), 200);
});

test("capturing through E does not count as an upgrade in the results", () => {
  const { run, input } = makeRun();
  run.director.update = () => {};
  run.player.iframes = 1e9;
  const e = spawnAlpha(run, 16);
  e.hp = e.maxHp * 0.05;
  run.hitEnemy(e, 1, null);
  assert.equal(e.captureReady, true);
  const items = run.stats.items;
  input.capturePressed = true;
  withRandom(0, () => run.update(1 / 60));
  assert.ok(run.profile.data.pokedex.caught.includes(16), "caught");
  assert.equal(run.stats.items, items);
});

test("the attempt bonus is dropped when the enemy is caught or killed while down", () => {
  const { run } = makeRun();
  run.director.update = () => {};
  run.player.iframes = 1e9;
  const a = spawnAlpha(run, 16);
  a.hp = a.maxHp * 0.05;
  run.hitEnemy(a, 1, null);
  run.player.x = a.x;
  run.player.z = a.z;
  withRandom(0.999, () => run.capture.throw()); // escapes: bonus recorded
  assert.equal(run.capture.attempts.get(a.id), 1);
  a.hp = a.maxHp * 0.05;
  run.hitEnemy(a, 1, null);
  withRandom(0, () => run.capture.throw());
  assert.equal(run.capture.attempts.has(a.id), false, "forgotten after the catch");

  const b = spawnAlpha(run, 16);
  b.hp = b.maxHp * 0.05;
  run.hitEnemy(b, 1, null);
  run.player.x = b.x;
  run.player.z = b.z;
  withRandom(0.999, () => run.capture.throw());
  b.hp = b.maxHp * 0.05;
  run.hitEnemy(b, 1, null);
  run.killEnemy(b, null);
  run.update(1 / 60);
  assert.equal(run.capture.attempts.has(b.id), false, "forgotten when it dies while down");
});
