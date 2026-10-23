// Achievements & species tasks: track progress across runs and reward milestones.
// Persisted in profile.data.progress.achievements / .dexTasks / .eggs.

import { clamp } from "../core/math.js";

export const ACHIEVEMENTS = [
  { key: "first_catch", title: "Primeiro Passo", desc: "Capture seu primeiro Pokémon.", need: (s) => s.caught.size >= 1, reward: "20G" },
  { key: "collector_10", title: "Colecionador", desc: "Capture 10 espécies diferentes.", need: (s) => s.caught.size >= 10, reward: "50G" },
  { key: "collector_25", title: "Grande Colecionador", desc: "Capture 25 espécies diferentes.", need: (s) => s.caught.size >= 25, reward: "150G" },
  { key: "dex_50", title: "Dex 50", desc: "Veja 50 espécies no Pokédex.", need: (s) => s.seen.size >= 50, reward: "100G" },
  { key: "shiny_hunter", title: "Caçador de Shinies", desc: "Capture 3 Pokémon shiny.", need: (s) => s.shinyCaught >= 3, reward: "200G" },
  { key: "veteran", title: "Veterano", desc: "Complete 5 runs.", need: (s) => s.runsCompleted >= 5, reward: "100G" },
  { key: "champion", title: "Campeão", desc: "Vença o jogo (modo clássico).", need: (s) => s.wins >= 1, reward: "300G" },
  { key: "tower_climber", title: "Subidor da Torre", desc: "Complete 3 andares da Torre.", need: (s) => s.towerFloors >= 3, reward: "150G" },
];

export const DEX_TASKS = [
  { key: "catch_grass", title: "Tipo Grama", desc: "Capture 5 Pokémon do tipo Grama.", type: "catch", filter: { type: "grass" }, need: 5 },
  { key: "catch_fire", title: "Tipo Fogo", desc: "Capture 5 Pokémon do tipo Fogo.", type: "catch", filter: { type: "fire" }, need: 5 },
  { key: "catch_water", title: "Tipo Água", desc: "Capture 5 Pokémon do tipo Água.", type: "catch", filter: { type: "water" }, need: 5 },
  { key: "catch_electric", title: "Tipo Elétrico", desc: "Capture 5 Pokémon do tipo Elétrico.", type: "catch", filter: { type: "electric" }, need: 5 },
  { key: "evolve_ally", title: "Evolução", desc: "Faça um aliado evoluir.", type: "evolve", need: 1 },
];

export class AchievementTracker {
  constructor(profile, run) {
    this.profile = profile;
    this.run = run;
    const p = profile.data;
    if (!p.achievements) p.achievements = { unlocked: [], progress: {} };
    if (!p.dexTasks) p.dexTasks = {};
    if (!p.shinyCaught) p.shinyCaught = 0;
    if (!p.runsCompleted) p.runsCompleted = 0;
    if (!p.wins) p.wins = 0;
    if (!p.towerFloors) p.towerFloors = 0;
    this.ach = p.achievements;
    this.tasks = p.dexTasks;
  }

  save() {
    this.profile.save();
  }

  unlock(key) {
    if (!this.ach.unlocked.includes(key)) {
      this.ach.unlocked.push(key);
      const a = ACHIEVEMENTS.find((x) => x.key === key);
      if (a) this.run?.banner?.(`Conquista: ${a.title}`);
    }
    this.save();
  }

  isUnlocked(key) {
    return this.ach.unlocked.includes(key);
  }

  taskProgress(key) {
    return this.tasks[key] ?? 0;
  }

  incrementTask(key, amount = 1) {
    const cur = this.taskProgress(key);
    const next = cur + amount;
    this.tasks[key] = next;
    const t = DEX_TASKS.find((x) => x.key === key);
    if (t && next >= t.need && !this.isUnlocked("task_" + key)) {
      this.unlock("task_" + key);
    }
    this.save();
    return next;
  }

  recordRun(victory, towerFloors = 0) {
    this.ach.runsCompleted = (this.ach.runsCompleted ?? 0) + 1;
    if (victory) this.ach.wins = (this.ach.wins ?? 0) + 1;
    if (towerFloors > (this.ach.towerFloors ?? 0)) this.ach.towerFloors = towerFloors;
    if (this.ach.runsCompleted >= 5 && !this.isUnlocked("veteran")) this.unlock("veteran");
    if (victory && !this.isUnlocked("champion")) this.unlock("champion");
    if (towerFloors >= 3 && !this.isUnlocked("tower_climber")) this.unlock("tower_climber");
    this.save();
  }

  recordCatch(species, shiny = false) {
    if (shiny) {
      this.ach.shinyCaught = (this.ach.shinyCaught ?? 0) + 1;
      if (this.ach.shinyCaught >= 3 && !this.isUnlocked("shiny_hunter")) this.unlock("shiny_hunter");
    }
    const caught = this.profile.data.caught ?? [];
    if (caught.length >= 1 && !this.isUnlocked("first_catch")) this.unlock("first_catch");
    if (caught.length >= 10 && !this.isUnlocked("collector_10")) this.unlock("collector_10");
    if (caught.length >= 25 && !this.isUnlocked("collector_25")) this.unlock("collector_25");
    // Tarefas por tipo de captura
    if (species && species.types) {
      for (const t of species.types) {
        const key = "catch_" + t;
        const tsk = DEX_TASKS.find((x) => x.key === key);
        if (tsk) this.incrementTask(key, 1);
      }
    }
    this.save();
  }

  recordSeen(count) {
    // Called for every new species seen; only unlock() writes to storage.
    if (count >= 50 && !this.isUnlocked("dex_50")) this.unlock("dex_50");
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
    // Recruit the hatched species as a level 1 ally.
    const species = run.data.get(speciesId);
    if (species && run.allies) {
      run.allies.recruit(species, 1);
      run.pokedex?.caught?.add(species.id);
      run.markCaught?.(species.id);
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
