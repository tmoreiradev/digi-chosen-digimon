// Bootstrap: loads data, wires the screens, and drives the game loop.

import { loadGameData } from "./data/game-data.js";
import { Run } from "./game/run.js";
import { DIFFICULTIES } from "./game/rules.js";
import { Tower } from "./game/tower.js";
import { Renderer } from "./render/renderer.js";
import { initSprites } from "./render/sprites.js";
import { Hud } from "./ui/hud.js";
import { LevelUpPanel } from "./ui/levelup.js";
import { Screens } from "./ui/screens.js";
import { accounts, profile } from "./ui/account.js";
import { Sfx } from "./audio/sfx.js";
import { Music } from "./audio/music.js";

const canvas = document.getElementById("game");
const uiRoot = document.getElementById("ui");
const screenRoot = document.getElementById("screens");
const hudRoot = document.getElementById("hud");
const levelRoot = document.getElementById("levelup");

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  dash: false,
  dashPressed: false,
  ult: false,
  ultPressed: false,
  capture: false,
  capturePressed: false,
};

const KEY_MAP = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  KeyR: "ult",
  KeyE: "capture",
};

const state = {
  data: null,
  run: null,
  renderer: null,
  hud: null,
  screens: null,
  levelup: null,
  sfx: new Sfx(),
  music: new Music(),
  paused: false,
  mode: "title",
  pendingLevelUps: 0,
  lastTime: 0,
  accumulator: 0,
};

async function boot() {
  state.data = await loadGameData();
  initSprites(state.data.sprites, state.data.spriteBounds);
  state.renderer = new Renderer(canvas);
  state.hud = new Hud(hudRoot);
  state.screens = new Screens(screenRoot, state.data);
  state.levelup = new LevelUpPanel(levelRoot, handleLevelUpChoice);

  state.screens.onStart = startRun;
  // Load the saved profile BEFORE reading its settings (the volume used to come from a blank default).
  accounts.load();
  state.sfx.setVolume(profile.data.settings?.volume ?? 0.5);
  state.music.setVolume(profile.data.settings?.volume ?? 0.5);

  window.addEventListener("resize", () => state.renderer.resize());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", () => {
    const ctx = state.sfx.ensure();
    if (ctx) state.music.ensure(ctx);
  });

  state.screens.showTitle();
  // Expose the live state for debugging and automated playtests.
  globalThis.__PB__ = state;
  requestAnimationFrame(loop);
}

function startRun() {
  const s = state.screens;
  const difficulty = DIFFICULTIES.find((d) => d.id === s.difficulty.id) ?? DIFFICULTIES[0];
  const run = new Run(state.data, {
    speciesId: s.selected,
    biomeId: s.biome,
    difficulty,
    mode: s.mode,
    input,
    profile,
    onLevelUp: queueLevelUp,
    onBanner: (text) => {
      state.hud.banner(text);
      state.sfx.levelUp();
    },
    onHit: () => state.sfx.hit(),
    onKill: () => state.sfx.pickup(),
    onPickup: (pk) => {
      if (pk.kind === "xp") state.sfx.pickup();
    },
    onShoot: () => state.sfx.shoot(),
    onHurt: () => state.sfx.hurt(),
    onUltimate: () => state.sfx.ultimate(),
    onCaught: (name) => {
      state.sfx.pickup();
      state.hud.banner(`Caught ${name}!`);
    },
    // Zone/floor progression after a boss lives in Run.onBossDefeated; this is just the jingle.
    onBossDown: () => state.sfx.levelUp(),
    onVictory: () => {
      state.sfx.evolve();
      setTimeout(() => endRun(run), 900);
    },
    onDeath: () => {
      state.sfx.death();
      setTimeout(() => endRun(run), 900);
    },
    onWorldEventOpen: () => {
      state.paused = true;
      state.music.stop();
    },
    onWorldEventClose: () => {
      state.paused = false;
      state.music.start();
    },
  });
  state.run = run;
  state.mode = "game";
  state.paused = false;
  state.pendingLevelUps = 0;
  state.levelup.reset(); // rerolls are per run; the panel object lives across runs

  // Background music, themed by biome and paused with the game.
  state.music.setTheme(s.biome ?? "forest", false);
  state.music.start();

  clearScreen();
  hudRoot.classList.add("show");
  canvas.classList.add("show");
  backdrop?.classList.add("hidden");
  state.renderer.resize();
  state.hud.update(run);
  // The first Pokémon of every line can evolve once the level gate is reached.
  run.tryEvolve = run.tryEvolve.bind(run);
}

function clearScreen() {
  screenRoot.className = "screens";
  screenRoot.innerHTML = "";
}

/**
 * End the current run and show the results. `expected` ties a delayed end (death/victory
 * timeout) to its own run, so it never ends a newer one. The outcome comes from the run's
 * own terminal state, so a "Quit to menu" cannot turn a won run into a defeat.
 */
function endRun(expected = state.run) {
  const run = state.run;
  if (!run || run !== expected) return;
  const victory = run.state === "victory";
  // Floors cleared, not the floor you are standing on; a cleared tower counts all of them.
  const towerFloors = run.tower ? (run.tower.cleared ? run.tower.floor : run.tower.floor - 1) : 0;
  // A chest/shop/altar panel open at the moment of death must not outlive the run (its key
  // listener would keep selling). Closing it restarts the music, so stop the music after.
  run.events.panel?.close();
  state.music.stop();
  // A level-up that landed as the run ended must not sit on the results or block the next run.
  state.levelup.close();
  state.pendingLevelUps = 0;
  state.mode = "menu";
  hudRoot.classList.remove("show");
  canvas.classList.remove("show");
  backdrop?.classList.remove("hidden");
  state.screens.showResults(run, victory);
  run.achievements.recordRun(victory, towerFloors);
  state.run = null;
}

function queueLevelUp() {
  state.pendingLevelUps++;
  if (!state.levelup.active) showLevelUp();
}

function showLevelUp() {
  if (!state.run) return;
  const choices = state.run.rollChoices();
  if (!choices.length) {
    state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
    return;
  }
  state.levelup.show(choices);
  state.sfx.levelUp();
}

function handleLevelUpChoice(choice, action, key) {
  const run = state.run;
  if (!run) return;
  if (choice) {
    run.applyChoice(choice);
    state.sfx.pickup();
  } else if (action === "reroll") {
    // LevelUpPanel.reroll() already spent the reroll; don't count it twice.
    const fresh = run.rollChoices();
    state.levelup.choices = fresh;
    state.levelup.render();
    return;
  } else if (action === "banish" && key) {
    run.banished.add(key);
  }
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  if (state.pendingLevelUps > 0) showLevelUp();
}

function onKeyDown(e) {
  if (e.code === "Tab") e.preventDefault();

  // Level-up modal captures its own keys.
  if (state.levelup.active && state.levelup.key(e.code)) {
    e.preventDefault();
    // A shop/chest panel may also listen for digits on window; the card choice wins.
    e.stopImmediatePropagation();
    return;
  }

  if (state.mode === "game") {
    // A world-event panel (chest/shop/altar) owns the keyboard: Esc closes it, P is ignored;
    // toggling the pause on top of it used to restart the music while the panel stayed open.
    if (state.run?.stateEventPanel) {
      if (e.code === "Escape") {
        e.preventDefault();
        state.run.events.panel?.close();
      } else if (e.code === "KeyP") {
        e.preventDefault();
      }
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    const action = KEY_MAP[e.code];
    if (action) {
      if (!input[action]) {
        if (action === "jump") input.jumpPressed = true;
        if (action === "ult") input.ultPressed = true;
        if (action === "capture") input.capturePressed = true;
      }
      input[action] = true;
      e.preventDefault();
    }
  } else if (state.mode === "menu" && state.screens.screen === "title") {
    if (e.code === "Enter") state.screens.showPicker();
  }
}

function onKeyUp(e) {
  const action = KEY_MAP[e.code];
  if (action) input[action] = false;
}

function togglePause() {
  // No pause between a death/victory and its results screen (900 ms): the run is over.
  if (!state.run || state.run.state !== "running") return;
  state.paused = !state.paused;
  if (state.paused) {
    state.screens.showPause(
      () => {
        state.paused = false;
        state.music.start();
        clearScreen();
      },
      () => {
        state.paused = false;
        endRun(); // a quit is never a victory: endRun reads run.state
      },
      (v) => {
        state.sfx.setVolume(v);
        state.music.setVolume(v);
        profile.save();
      }
    );
    state.music.stop();
  } else {
    clearScreen();
    state.music.start();
  }
}

const STEP = 1 / 60;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - (state.lastTime || now)) / 1000);
  state.lastTime = now;

  const run = state.run;
  if (run && state.mode === "game" && !state.paused && !state.levelup.active && !run.stateEventPanel) {
    state.accumulator += dt;
    let steps = 0;
    while (state.accumulator >= STEP && steps < 5) {
      state.accumulator -= STEP;
      run.update(STEP);
      // Evolution is checked every level; it consumes the level itself.
      if (run.player.level > run.player.lastEvoCheck) {
        run.player.lastEvoCheck = run.player.level;
        if (run.tryEvolve()) state.sfx.evolve();
      }      input.jumpPressed = false;
      input.ultPressed = false;
      input.capturePressed = false;
      steps++;
    }
    state.hud.update(run);
    state.renderer.render(run);
  } else if (run && state.mode === "game") {
    // Keep the last frame visible while paused or choosing an upgrade.
    state.renderer.render(run);
  } else {
    drawMenuBackdrop();
  }
}

/** A calm animated backdrop for the menu screens. */
let backdrop = null;
function drawMenuBackdrop() {
  if (!backdrop) {
    backdrop = document.createElement("canvas");
    backdrop.width = 320;
    backdrop.height = 180;
    backdrop.className = "backdrop";
    document.body.append(backdrop);
  }
  const g = backdrop.getContext("2d");
  const t = performance.now() / 1000;
  const grad = g.createLinearGradient(0, 0, 0, backdrop.height);
  grad.addColorStop(0, "#241d45");
  grad.addColorStop(1, "#12101f");
  g.fillStyle = grad;
  g.fillRect(0, 0, backdrop.width, backdrop.height);
  for (let i = 0; i < 40; i++) {
    const x = (i * 83 + t * 6) % backdrop.width;
    const y = (i * 47 + Math.sin(t + i) * 6) % backdrop.height;
    g.fillStyle = `rgba(200,190,255,${0.05 + 0.05 * Math.sin(t + i)})`;
    g.fillRect(x, y, 1.5, 1.5);
  }
}

boot().catch((err) => {
  console.error(err);
  document.getElementById("screens").innerHTML =
    `<div class="screen dim"><div class="card panel"><h2>Failed to start</h2><p class="muted">${err.message}</p><p class="muted">Serve the folder over HTTP (npm start) and reload.</p></div></div>`;
});
