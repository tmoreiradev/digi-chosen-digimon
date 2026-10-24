// BACKLOG 17, 18: the dev server survives malformed URLs and stays inside its root; captures are not
// counted as upgrades and the per-enemy attempt bonus is forgotten once that enemy is gone.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { makeHandler } from "../server.mjs";
import { makeRun, withRandom, spawnAlpha } from "./_helpers.mjs";

/** One server instance for every request of a test, so "still alive" really means the same process. */
async function serverAt(root) {
  const srv = http.createServer(makeHandler(root));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address();
  const get = (p) =>
    new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: p }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }).on("error", reject);
    });
  return { get, close: () => srv.close() };
}

/** tmp/<base>/site (served root), tmp/<base>/site2/secret.txt (sibling), tmp/<base>/outside.txt (parent). */
function sandbox() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "digi-srv-"));
  const site = path.join(base, "site");
  fs.mkdirSync(site);
  fs.writeFileSync(path.join(site, "index.html"), "ok");
  fs.mkdirSync(path.join(base, "site2"));
  fs.writeFileSync(path.join(base, "site2", "secret.txt"), "sibling");
  fs.writeFileSync(path.join(base, "outside.txt"), "parent");
  return { base, site };
}

test("dev server: bad escapes and bad URLs are a 400 and the same instance keeps serving", async () => {
  const { base, site } = sandbox();
  const srv = await serverAt(site);
  try {
    assert.equal(await srv.get("/"), 200);
    assert.equal(await srv.get("/%E0%A4%A"), 400);
    assert.equal(await srv.get("//["), 400, "new URL used to throw outside the try");
    assert.equal(await srv.get("/"), 200, "same server still alive");
  } finally {
    srv.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("dev server: existing files in a sibling folder and in the parent are forbidden", async () => {
  const { base, site } = sandbox();
  const srv = await serverAt(site);
  try {
    assert.equal(await srv.get("/..%2Fsite2%2Fsecret.txt"), 403, "sibling <root>2 (startsWith let it through)");
    assert.equal(await srv.get("/..%2Foutside.txt"), 403, "parent");
  } finally {
    srv.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
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

test("the attempt bonus also goes when an enemy that escaped is killed later", () => {
  const { run } = makeRun();
  run.director.update = () => {};
  run.player.iframes = 1e9;
  const a = spawnAlpha(run, 16);
  a.hp = a.maxHp * 0.05;
  run.hitEnemy(a, 1, null);
  run.player.x = a.x;
  run.player.z = a.z;
  withRandom(0.999, () => run.capture.throw()); // escapes, back to 30 % and fighting
  assert.equal(run.capture.attempts.get(a.id), 1);
  run.killEnemy(a, null);
  assert.equal(run.capture.attempts.has(a.id), false);
});
