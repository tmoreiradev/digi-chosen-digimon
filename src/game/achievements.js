// Achievements & species tasks: track progress across runs and reward milestones.
// Persisted in profile.data.achievements / .dexTasks / .eggs / .pendingGold
// (profile.data IS the account's `progress` object, see ui/account.js).
//
// Every achievement is judged by its `need` predicate on one numbers snapshot
// (check()); unlocking pays `gold` to the running run, or banks it in the
// profile for the next run when it happens after a run ended (results screen).

import { clamp } from "../core/math.js";

export const ACHIEVEMENTS = [
  { key: "first_catch", title: "Primeiro Passo", desc: "Capture seu primeiro Pokémon.", need: (s) => s.caught >= 1, gold: 20 },
  { key: "collector_10", title: "Colecionador", desc: "Capture 10 espécies diferentes.", need: (s) => s.caught >= 10, gold: 50 },
  { key: "collector_25", title: "Grande Colecionador", desc: "Capture 25 espécies diferentes.", need: (s) => s.caught >= 25, gold: 150 },
  { key: "dex_50", title: "Dex 50", desc: "Veja 50 espécies no Pokédex.", need: (s) => s.seen >= 50, gold: 100 },
  { key: "shiny_hunter", title: "Caçador de Shinies", desc: "Capture 3 Pokémon shiny.", need: (s) => s.shinyCaught >= 3, gold: 200 },
  { key: "veteran", title: "Veterano", desc: "Complete 5 runs.", need: (s) => s.runs >= 5, gold: 100 },
  { key: "champion", title: "Campeão", desc: "Vença o jogo (modo clássico).", need: (s) => s.wins >= 1, gold: 300 },
  { key: "tower_climber", title: "Subidor da Torre", desc: "Complete 3 andares da Torre.", need: (s) => s.towerFloors >= 3, gold: 150 },
];

export const DEX_TASKS = [
  { key: "catch_grass", title: "Tipo Grama", desc: "Capture 5 Pokémon do tipo Grama.", type: "catch", filter: { type: "grass" }, need: 5, gold: 40 },
  { key: "catch_fire", title: "Tipo Fogo", desc: "Capture 5 Pokémon do tipo Fogo.", type: "catch", filter: { type: "fire" }, need: 5, gold: 40 },
  { key: "catch_water", title: "Tipo Água", desc: "Capture 5 Pokémon do tipo Água.", type: "catch", filter: { type: "water" }, need: 5, gold: 40 },
  { key: "catch_electric", title: "Tipo Elétrico", desc: "Capture 5 Pokémon do tipo Elétrico.", type: "catch", filter: { type: "electric" }, need: 5, gold: 40 },
  { key: "evolve_ally", title: "Evolução", desc: "Faça um aliado evoluir.", type: "evolve", need: 1, gold: 60 },
];

export class AchievementTracker {
  constructor(profile, run) {
    this.profile = profile;
    this.run = run;
    const p = profile.data;
    if (!p.achievements) p.achievements = { unlocked: [], progress: {} };
    if (!p.dexTasks) p.dexTasks = {};
    this.ach = p.achievements;
    this.tasks = p.dexTasks;
    // Older saves counted runs/wins inside `achievements`; the profile's own counters are the source now.
    if ((this.ach.runsCompleted ?? 0) > (p.runs ?? 0)) p.runs = this.ach.runsCompleted;
    if ((this.ach.wins ?? 0) > (p.wins ?? 0)) p.wins = this.ach.wins;
  }

  save() {
    this.profile.save();
  }

  /** The numbers every achievement is judged on. */
  snapshot() {
    const p = this.profile.data;
    return {
      caught: p.pokedex?.caught?.length ?? 0,
      seen: p.pokedex?.seen?.length ?? 0,
      shinyCaught: this.ach.shinyCaught ?? 0,
      runs: p.runs ?? 0,
      wins: p.wins ?? 0,
      towerFloors: this.ach.towerFloors ?? 0,
    };
  }

  /** Unlock every achievement whose condition now holds. */
  check() {
    const s = this.snapshot();
    for (const a of ACHIEVEMENTS) if (!this.isUnlocked(a.key) && a.need(s)) this.unlock(a.key);
  }

  isUnlocked(key) {
    return this.ach.unlocked.includes(key);
  }

  /** Unlock an achievement or a task ("task_<key>"); pays its gold. False when already unlocked. */
  unlock(key) {
    if (this.isUnlocked(key)) return false;
    this.ach.unlocked.push(key);
    const a = ACHIEVEMENTS.find((x) => x.key === key);
    const t = a ? null : DEX_TASKS.find((x) => "task_" + x.key === key);
    const def = a ?? t;
    const gold = def?.gold ?? 0;
    if (gold) this.reward(gold);
    if (def) this.run?.banner?.(`${a ? "Conquista" : "Tarefa concluída"}: ${def.title}${gold ? ` · +${gold}G` : ""}`);
    this.save();
    return true;
  }

  /** Gold goes to the running run; once the run is over it waits in the profile for the next one. */
  reward(gold) {
    const run = this.run;
    if (run && !this.runOver && run.state === "running") run.stats.gold += gold;
    else this.profile.data.pendingGold = (this.profile.data.pendingGold ?? 0) + gold;
  }

  taskProgress(key) {
    return this.tasks[key] ?? 0;
  }

  incrementTask(key, amount = 1) {
    const next = this.taskProgress(key) + amount;
    this.tasks[key] = next;
    const t = DEX_TASKS.find((x) => x.key === key);
    if (!(t && next >= t.need && this.unlock("task_" + key))) this.save();
    return next;
  }

  /** Called when a run ends (death, victory or quit); showResults has already counted it in profile.data.runs. */
  recordRun(victory, towerFloors = 0) {
    const p = this.profile.data;
    this.runOver = true; // a quit run is still "running": rewards from here on are banked
    if (victory) p.wins = (p.wins ?? 0) + 1;
    if (towerFloors > (this.ach.towerFloors ?? 0)) this.ach.towerFloors = towerFloors;
    this.check();
    this.save();
  }

  /** Called after Run.markCaught put the species in profile.data.pokedex.caught. */
  recordCatch(species, shiny = false) {
    if (shiny) this.ach.shinyCaught = (this.ach.shinyCaught ?? 0) + 1;
    for (const t of species?.types ?? []) {
      if (DEX_TASKS.some((x) => x.key === "catch_" + t)) this.incrementTask("catch_" + t, 1);
    }
    this.check();
    this.save();
  }

  /** Called for every new species seen (only unlock() writes to storage). */
  recordSeen() {
    this.check();
  }
}

export class EggSystem {
  constructor(run) {
    this.run = run;
    const p = run.profile?.data;
    if (!p.eggs) p.eggs = { active: null, steps: 0, needed: 0, hatchSpecies: null };
    this.egg = p.eggs;
    this.stepsSinceHatch = this.egg.steps ?? 0;
    this.playerSteps = 0;
  }

  save() {
    this.egg.steps = this.stepsSinceHatch;
    this.run.profile.save();
  }

  giveEgg(speciesId, stepsNeeded = 200) {
    if (this.egg.active) return false;
    this.egg.active = true;
    this.egg.needed = stepsNeeded;
    this.egg.hatchSpecies = speciesId;
    this.stepsSinceHatch = 0;
    this.save();
    this.run.banner?.("Você recebeu um ovo!");
    return true;
  }

  addSteps(n) {
    if (!this.egg.active) return;
    this.stepsSinceHatch += n;
    this.playerSteps += n;
    if (this.stepsSinceHatch >= this.egg.needed) {
      this.hatch();
    }
    this.save();
  }

  hatch() {
    const speciesId = this.egg.hatchSpecies;
    const run = this.run;
    this.egg.active = false;
    this.egg.hatchSpecies = null;
    this.stepsSinceHatch = 0;
    this.save();
    run.banner?.("O ovo eclodiu!");
    run.burst(run.player.x, run.player.y + 0.8, run.player.z, 0xffd166, 20, "star");
    // Recruit the hatched species as a level 1 ally; it counts as caught in the Pokédex.
    const species = run.data.get(speciesId);
    if (species && run.allies) {
      run.allies.recruit(species, 1);
      run.markCaught?.(species.id);
      run.achievements?.check();
    }
  }

  draw(ctx, zoom, sx, sy) {
    if (!this.egg.active) return;
    const t = this.run.time;
    const pulse = 1 + 0.1 * Math.sin(t * 4);
    const u = zoom * 0.28 * pulse;
    ctx.save();
    ctx.translate(sx, sy - u);
    ctx.fillStyle = "#fff9c4";
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbc02d";
    ctx.beginPath();
    ctx.arc(0, -u * 0.1, u * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const pct = clamp(this.stepsSinceHatch / this.egg.needed, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx - u * 0.7, sy + u * 0.6, u * 1.4, u * 0.12);
    ctx.fillStyle = "#fbc02d";
    ctx.fillRect(sx - u * 0.7, sy + u * 0.6, u * 1.4 * pct, u * 0.12);
  }
}
