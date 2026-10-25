// End-to-end check of the offline bundle: opens dist/digi-chosen.html straight from disk (file://)
// in a headless Chromium (Edge or Chrome, found locally or via CHROME_PATH), drives the real UI
// through the DevTools protocol and fails on any page error.
//
// Usage: npm run build && npm run e2e
// No dependencies: Node's built-in WebSocket and fetch talk to the browser, so this script needs Node >= 22
// (the rest of the project runs on Node >= 18).

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUNDLE = path.join(ROOT, "dist", "digi-chosen.html");

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const fail = (msg) => {
  console.error(`e2e: FAIL — ${msg}`);
  process.exitCode = 1;
};

async function main() {
  if (typeof WebSocket !== "function") return fail(`needs Node >= 22 for the built-in WebSocket (this is ${process.version})`);
  if (!fs.existsSync(BUNDLE)) return fail(`${BUNDLE} not found; run npm run build first`);
  const exe = CANDIDATES.find((p) => fs.existsSync(p));
  if (!exe) return fail("no Chromium-based browser found (set CHROME_PATH)");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "digi-e2e-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const browser = spawn(exe, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    const target = await waitForTarget(port);
    const cdp = await connect(target.webSocketDebuggerUrl);
    const errors = [];
    cdp.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") errors.push(p.args.map((a) => a.value ?? a.description).join(" "));
    });
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: pathToFileURL(BUNDLE).href });
    await waitFor(cdp, "!!document.querySelector('button') && /Jogar/.test(document.body.innerText)", 15000, "title screen");

    const result = await evaluate(cdp, `(${scenario.toString()})()`);
    console.log(result.join("\n"));
    if (errors.length) fail("page errors:\n  " + errors.join("\n  "));
    else if (!process.exitCode) console.log("e2e: OK — the file:// bundle boots, plays and returns to the menu with no page errors");
    cdp.close();
  } finally {
    // Wait for the browser to really exit before removing its profile (Windows keeps the files locked
    // until then); a leftover temp folder is only worth a warning, never a failed check.
    const exited = new Promise((r) => (browser.exitCode !== null ? r() : browser.once("exit", r)));
    browser.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000).unref())]); // unref: never keeps Node alive
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (e) {
      console.warn(`e2e: could not remove ${profile} (${e.code}); harmless, delete it later`);
    }
  }
}

/** Runs inside the page. Returns log lines; throws on a broken expectation. */
async function scenario() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const body = () => document.body.innerText.replace(/\s+/g, " ");
  const click = (text) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith(text));
    if (!b) throw new Error(`no button "${text}" on: ${body().slice(0, 120)}`);
    b.click();
  };
  const key = (k, code) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, code, bubbles: true }));
  const expect = (cond, what) => {
    if (!cond) throw new Error(`expected ${what}; page: ${body().slice(0, 160)}`);
    log.push(`  ✓ ${what}`);
  };

  expect(document.documentElement.lang === "pt-BR", "page language pt-BR");
  expect(globalThis.__POKEBONK_DATA__ && Object.keys(globalThis.__POKEBONK_DATA__).length >= 9, "data embedded in the bundle");
  click("▶ Jogar");
  await sleep(100);
  click("Jogar como convidado");
  await sleep(100);
  expect(/Escolha seu parceiro/i.test(body()), "partner picker");
  click("Continuar");
  await sleep(100);
  expect(/Região/i.test(body()) && /Ilha File/i.test(body()), "setup screen with the region in pt-BR");
  click("Começar!");
  await sleep(400);
  const run = globalThis.__PB__?.run;
  expect(run && run.state === "running", "a run started");
  // The real requestAnimationFrame loop must move the run on its own: no manual update before this check.
  const t0 = run.time;
  await sleep(800);
  expect(run.time > t0 + 0.2, "the main loop advances the run by itself");
  expect(document.querySelectorAll("canvas").length >= 1, "the game renders to a canvas");
  run.addXp(run.player.xpNext + 1);
  for (let i = 0; i < 3; i++) run.update(1 / 60);
  await sleep(200);
  expect(/Subiu de nível!/i.test(body()), "level-up cards");
  key("m", "KeyM");
  await sleep(150);
  expect(!/Mapa da zona/.test(body()), "M does nothing while the cards are up");
  const picked = run.stats.items + run.player.moves.length + run.player.vitamins.size + run.player.moves.reduce((t, m) => t + m.level, 0);
  key("1", "Digit1"); // the keyboard shortcut alone picks the first card
  await sleep(200);
  expect(!/Subiu de nível!/i.test(body()), "key 1 closes the cards");
  const after = run.stats.items + run.player.moves.length + run.player.vitamins.size + run.player.moves.reduce((t, m) => t + m.level, 0);
  expect(after > picked, "key 1 applied the first card");
  key("m", "KeyM");
  await sleep(150);
  expect(/Mapa da zona/.test(body()) && /Altar do guardião/.test(body()), "M opens the zone map with the guardian altar");
  const frozen = run.time;
  await sleep(300);
  expect(run.time === frozen, "the zone map holds the run still");
  key("Escape", "Escape");
  await sleep(150);
  expect(!/Mapa da zona/.test(body()), "Esc closes the zone map");
  key("p", "KeyP");
  await sleep(150);
  expect(/Pausado/i.test(body()), "pause menu");
  click("Item segurado");
  await sleep(100);
  expect(document.querySelectorAll(".helditem-list button").length >= 10, "held item list");
  click("Fechar");
  await sleep(100);
  click("Sair para o menu");
  await sleep(1300);
  expect(/Você desmaiou|Vitória!|▶ Jogar/i.test(body()), "back out of the run");
  if (!/▶ Jogar/.test(body())) {
    click("Menu principal");
    await sleep(150);
  }
  click("🌐 English");
  await sleep(150);
  expect(/▶ Play/.test(body()) && document.documentElement.lang === "en", "the language switch turns the title to English");
  click("▶ Play");
  await sleep(100);
  click("Play as guest");
  await sleep(100);
  expect(/Choose your partner/i.test(body()), "the next screens follow in English");
  globalThis.__PB__.screens.showTitle(); // the partner screen has no way back; the debug handle does
  await sleep(100);
  click("🌐 Español");
  await sleep(150);
  expect(/▶ Jugar/.test(body()) && document.documentElement.lang === "es", "and on to Spanish");
  return log;
}

async function waitForTarget(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("browser did not open its debugging port");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const handlers = new Map();
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          const msg = { id: ++id, method, params };
          ws.send(JSON.stringify(msg));
          return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
        },
        on(method, fn) {
          handlers.set(method, fn);
        },
        close: () => ws.close(),
      });
    ws.onerror = (e) => reject(new Error("websocket error: " + (e.message ?? e.type)));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
      } else if (msg.method && handlers.has(msg.method)) handlers.get(msg.method)(msg.params);
    };
  });
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

async function waitFor(cdp, expression, timeout, what) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(cdp, expression).catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timed out waiting for ${what}`);
}

main().catch((e) => fail(e.message));
