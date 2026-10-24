// Front-end screens: title, roster picker, region/difficulty setup, pause and results.

import { el, clear, typeCss } from "./dom.js";
import { DIFFICULTIES } from "../game/rules.js";
import { fmtTime } from "../core/math.js";
import { accounts, profile } from "./account.js";
import { portraitStyle } from "../render/sprites.js";
import { Pokedex } from "./pokedex.js";
import { ACHIEVEMENTS, DEX_TASKS, progressSnapshot } from "../game/achievements.js";
import { typeName, biomeName, biomeDesc, rankName, heldItemDesc } from "../core/i18n.js";
import { HELD_ITEMS } from "../game/scripted.js";
import { tr, getLang, setLang, LANGS } from "../core/lang.js";

/** The account name; any guest (old saves were named "Guest") shows as Convidado. */
const trainerName = () => (!accounts.current || accounts.current.kind === "guest" ? "Convidado" : accounts.current.name);

export class Screens {
  constructor(root, data) {
    this.root = root;
    this.data = data;
    this.onStart = () => {};
    this.onResume = () => {};
    this.onQuit = () => {};
    this.getRun = () => null; // the live run, for the pause submenus (set by main.js)
    this.onVolume = () => {};
    this.selected = 1;
    this.biome = data.rules.biomes[0].id;
    this.difficulty = DIFFICULTIES[0];
    this.mode = "classic";
    this.screen = "title";
    this.pokedex = new Pokedex(this.root, this.data, profile);
    // The Pokédex is only opened from the pause menu; closing it goes back there.
    this.pokedex.onClose = () => this.returnToPause();
  }

  clear() {
    clear(this.root);
    this.root.className = "screens";
  }

  showTitle() {
    this.screen = "title";
    this.clear();
    const unlocked = profile.data.unlocked ?? [];
    this.root.append(
      el(
        "div",
        { class: "screen title-screen" },
        el("div", { class: "title-wrap" },
          el("h1", { class: "game-title" }, "Digi", el("span", {}, "Chosen")),
          el("p", { class: "tagline" }, "Roguelite survivor · Kanto · offline"),
          el("div", { class: "title-actions" },
            el("button", { class: "btn big red", onclick: () => this.showAccountPicker() }, "▶ Jogar"),
            el("button", { class: "btn big ghost", onclick: () => this.showHelp() }, "? Como jogar"),
            // Language switch: names the other language in that language, so it is readable either way.
            el("button", { class: "btn big ghost lang-switch", onclick: () => { setLang(getLang() === "en" ? "pt-BR" : "en"); this.showTitle(); } },
              getLang() === "en" ? "🌐 Português" : "🌐 English")
          ),
          el("div", { class: "title-stats" },
            el("span", {}, `Treinador: ${trainerName()}`),
            el("span", {}, `Partidas: ${profile.data.runs ?? 0}`),
            el("span", {}, `Melhor: ${fmtTime(profile.data.best ?? 0)}`),
            el("span", {}, `Capturados: ${(profile.data.pokedex?.caught ?? []).length} / ${this.data.pokemon.length}`),
            el("span", {}, `Parceiros: ${(profile.data.unlocked ?? []).length} / ${this.data.rules.roster.length}`)
          )
        )
      )
    );
  }

  showHelp() {
    this.clear();
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Como jogar"),
          el("ul", { class: "help-list" },
            el("li", {}, el("kbd", {}, "WASD"), " / setas — mover"),
            el("li", {}, el("kbd", {}, "Espaço"), " — pular"),
            el("li", {}, el("kbd", {}, "Shift"), " — dash (invulnerabilidade breve)"),
            el("li", {}, el("kbd", {}, "R"), " — ultimate, quando carregado"),
            el("li", {}, el("kbd", {}, "P"), " — pausar"),
            el("li", {}, el("kbd", {}, "1"), el("kbd", {}, "2"), el("kbd", {}, "3"), " — escolher um upgrade ao subir de nível"),
            el("li", {}, el("kbd", {}, "E"), " — abrir baú/loja/altar ou lançar a bola num alfa enfraquecido (captura)"),
            el("li", {}, el("kbd", {}, "F"), " re-sortear · ", el("kbd", {}, "X"), " pular · ", el("kbd", {}, "Z"), " banir")
          ),
          el("p", { class: "muted" }, "Seu Pokémon ataca sozinho. Colete as orbes azuis de XP para subir de nível, escolha upgrades e evolua antes que a horda te engula."),
          el("button", { class: "btn big red", onclick: () => this.showTitle() }, "Voltar")
        )
      )
    );
  }

  showAccountPicker() {
    this.screen = "account-picker";
    this.clear();
    const list = el("div", { class: "account-list" });
    for (const prof of accounts.list()) {
      list.append(
        el(
          "button",
          {
            class: "account-card",
            onclick: () => {
              accounts.current = prof;
              profile.save();
              this.showPicker();
            },
          },
          el("div", { class: "ac-name" }, prof.name),
          el("div", { class: "ac-kind muted" }, prof.kindLabel + " · " + (prof.progress?.runs ?? 0) + " partidas"),
          el("div", { class: "ac-best muted" }, "Melhor: " + fmtTime(prof.progress?.best ?? 0))
        )
      );
    }
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Escolha um perfil"),
          list,
          el("div", { class: "result-actions", style: { marginTop: 16 } },
            el("button", { class: "btn big ghost", onclick: () => this.showAccountManage() }, "+ Criar / Entrar"),
            el("button", { class: "btn big red", onclick: () => { accounts.playAsGuest(); profile.save(); this.showPicker(); } }, "Jogar como convidado")
          )
        )
      )
    );
  }

  showAccountManage() {
    this.screen = "account-manage";
    this.clear();
    const nameIn = el("input", { type: "text", placeholder: "Nome", class: "inp", value: "" });
    const passIn = el("input", { type: "password", placeholder: "Senha (opcional)", class: "inp", value: "" });
    const msg = el("div", { class: "muted" });
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Criar ou entrar"),
          el("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            el("label", {}, "Nome"),
            nameIn,
            el("label", {}, "Senha"),
            passIn,
            msg
          ),
          el("div", { class: "result-actions", style: { marginTop: 14, gap: 8 } },
            el("button", { class: "btn big red", onclick: () => {
              const r = accounts.create(nameIn.value, passIn.value);
              if (!r.ok) { msg.textContent = tr(r.error); return; }
              profile.save();
              this.showPicker();
            } }, "Criar e jogar"),
            el("button", { class: "btn big ghost", onclick: () => {
              const r = accounts.login(nameIn.value, passIn.value);
              if (!r.ok) { msg.textContent = tr(r.error); return; }
              profile.save();
              this.showPicker();
            } }, "Entrar"),
            el("button", { class: "btn big ghost", onclick: () => this.showAccountPicker() }, "Voltar")
          )
        )
      )
    );
  }

  showPicker() {
    this.screen = "picker";
    this.clear();
    const roster = this.data.rules.roster;
    const unlocked = new Set(profile.data.unlocked ?? []);
    const list = el("div", { class: "picker-grid" });

    for (const entry of roster) {
      const species = this.data.get(entry.id);
      if (!species) continue;
      const isUnlocked = unlocked.has(entry.id) || entry.start;
      const card = el(
        "button",
        {
          class: "picker-card" + (entry.id === this.selected ? " on" : "") + (isUnlocked ? "" : " locked"),
          disabled: !isUnlocked,
          onclick: () => {
            if (!isUnlocked) return;
            this.selected = entry.id;
            this.showPicker();
          },
        },
        el("div", { class: "pc-num" }, `#${String(species.id).padStart(3, "0")}`),
        el("div", { class: "pc-sprite" }, el("div", { class: "pc-sprite-img", style: portraitStyle(entry.id, 56) ?? {} })),
        el("div", { class: "pc-name" }, species.name),
        el("div", { class: "pc-role" }, entry.role),
        el("div", { class: "pc-types" }, ...species.types.map((t) => el("span", { class: "chip", style: { background: typeCss(t) } }, typeName(t)))),
        el("div", { class: "pc-passive" }, el("b", {}, this.data.abilities[String(species.abilities[0])]?.name ?? "—")),
        el("div", { class: "pc-stats" },
          ...["hp", "atk", "def", "spa", "spd", "spe"].map((k) =>
            el("span", { class: "pc-stat" }, el("i", {}, k.toUpperCase()), String(species.stats[k]))
          )
        ),
        el("div", { class: "pc-rank " + entry.rank }, rankName(entry.rank))
      );
      list.append(card);
    }

    const species = this.data.get(this.selected);
    const entry = this.data.rosterById.get(this.selected);

    this.root.append(
      el(
        "div",
        { class: "screen picker-screen" },
        el(
          "div",
          { class: "picker-head" },
          el("h1", {}, "Escolha seu parceiro"),
          el("p", { class: "muted" }, "Parceiros são desbloqueados ao capturar espécies e completar desafios. Os iniciais estão sempre disponíveis.")
        ),
        list,
        el(
          "div",
          { class: "picker-foot" },
          el("div", { class: "picker-detail" },
            el("b", {}, species?.name ?? ""),
            el("span", { class: "muted" }, entry ? ` · ${entry.role} · ${rankName(entry.rank)}` : "")
          ),
          el("button", { class: "btn big red", onclick: () => this.showSetup() }, "Continuar")
        )
      )
    );
  }

  showSetup() {
    this.screen = "setup";
    this.clear();
    const biomes = this.data.rules.biomes;
    const regionList = el("div", { class: "region-list" });
    for (const b of biomes) {
      const card = el(
        "button",
        {
          class: "region-card" + (b.id === this.biome ? " on" : ""),
          onclick: () => {
            this.biome = b.id;
            this.showSetup();
          },
        },
        el("h3", {}, biomeName(b)),
        el("p", { class: "muted" }, biomeDesc(b)),
        el("div", { class: "pc-types" }, ...b.types.map((t) => el("span", { class: "chip", style: { background: typeCss(t) } }, typeName(t))))
      );
      regionList.append(card);
    }

    const diffList = el("div", { class: "diff-list" });
    for (const d of DIFFICULTIES) {
      diffList.append(
        el(
          "button",
          {
            class: "diff-card" + (d.id === this.difficulty.id ? " on" : ""),
            onclick: () => {
              this.difficulty = d;
              this.showSetup();
            },
          },
          el("b", {}, d.name),
          el("span", { class: "muted" }, d.id === "normal" ? "Inimigos na força base" : `Inimigos com +${Math.round((d.enemyHp - 1) * 100)}% de HP e +${Math.round((d.enemyDamage - 1) * 100)}% de dano`)
        )
      );
    }

    const modeList = el(
      "div",
      { class: "mode-list" },
      el("button", { class: "mode-card" + (this.mode === "classic" ? " on" : ""), onclick: () => { this.mode = "classic"; this.showSetup(); } },
        el("b", {}, "Clássico"), el("span", { class: "muted" }, "Zonas, guardiões e um santuário")),
      el("button", { class: "mode-card" + (this.mode === "endless" ? " on" : ""), onclick: () => { this.mode = "endless"; this.showSetup(); } },
        el("b", {}, "Infinito"), el("span", { class: "muted" }, "Hordas e marcos sem fim")),
      el("button", { class: "mode-card" + (this.mode === "tower" ? " on" : ""), onclick: () => { this.mode = "tower"; this.showSetup(); } },
        el("b", {}, "Torre"), el("span", { class: "muted" }, "Andares temáticos, ondas e guardiões"))
    );

    this.root.append(
      el(
        "div",
        { class: "screen setup-screen" },
        el("div", { class: "setup-grid" },
          el("div", {}, el("h2", {}, "Região"), regionList),
          el("div", {}, el("h2", {}, "Modo"), modeList, el("h2", {}, "Dificuldade"), diffList)
        ),
        el(
          "div",
          { class: "setup-foot" },
          el("button", { class: "btn big ghost", onclick: () => this.showPicker() }, "← Voltar"),
          el("button", { class: "btn big red", onclick: () => this.onStart() }, "Começar!")
        )
      )
    );
  }

  showResults(run, victory) {
    this.screen = "results";
    this.clear();
    const p = run.player;
    const stats = run.stats;
    profile.data.runs = (profile.data.runs ?? 0) + 1;
    profile.data.best = Math.max(profile.data.best ?? 0, run.time);
    // The partner you played with is at least "seen"; only captures count as caught.
    const dex = profile.data.pokedex ?? (profile.data.pokedex = { seen: [], caught: [] });
    if (!dex.seen.includes(p.speciesId)) dex.seen.push(p.speciesId);
    profile.save();

    this.root.append(
      el(
        "div",
        { class: "screen dim results-screen" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, victory ? "Vitória!" : "Você desmaiou"),
          el("p", { class: "muted" }, `${trainerName()} · ${p.species.name} · ${biomeName(run.biome)} · ${run.difficulty.name}`),
          el("div", { class: "result-grid" },
            el("div", {}, el("b", {}, fmtTime(run.time)), el("span", {}, "sobrevividos")),
            el("div", {}, el("b", {}, String(stats.kills)), el("span", {}, "abates")),
            el("div", {}, el("b", {}, String(stats.levels)), el("span", {}, "níveis")),
            el("div", {}, el("b", {}, String(stats.items)), el("span", {}, "upgrades")),
            el("div", {}, el("b", {}, String(Math.floor(stats.gold))), el("span", {}, "moedas")),
            el("div", {}, el("b", {}, String(Math.round(stats.damage))), el("span", {}, "dano"))
          ),
          el(
            "div",
            { class: "result-actions" },
            el("button", { class: "btn big red", onclick: () => this.showSetup() }, "Jogar de novo"),
            el("button", { class: "btn big ghost", onclick: () => this.showTitle() }, "Menu principal")
          )
        )
      )
    );
  }

  showPause(onResume, onQuit, onVolume) {
    this.screen = "pause";
    this.onResume = onResume;
    this.onQuit = onQuit;
    this.onVolume = onVolume;
    this.clear();
    const volume = profile.data.settings?.volume ?? 0.5;
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(Math.round(volume * 100)),
      class: "volume",
      oninput: (e) => {
        const v = Number(e.target.value) / 100;
        profile.data.settings = { ...profile.data.settings, volume: v };
        onVolume?.(v);
      },
    });
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Pausado"),
          el("label", { class: "vol-row" }, el("span", {}, "Volume"), slider),
          el(
            "div",
            { class: "result-actions" },
            el("button", { class: "btn big red", onclick: onResume }, "Continuar"),
            el("button", { class: "btn big ghost", onclick: () => this.showPokedex() }, "Pokédex"),
            el("button", { class: "btn big ghost", onclick: () => this.showAchievements() }, "Conquistas"),
            el("button", { class: "btn big ghost", onclick: () => this.showNickname() }, "Apelido"),
            el("button", { class: "btn big ghost", onclick: () => this.showHeldItem() }, "Item segurado"),
            el("button", { class: "btn big ghost", onclick: onQuit }, "Sair para o menu")
          )
        )
      )
    );
  }

  /** Return to the pause screen from a submenu without unpausing. */
  returnToPause() {
    this.showPause(this.onResume, this.onQuit, this.onVolume);
  }

  showPokedex() {
    this.screen = "pokedex";
    this.clear();
    this.pokedex.show();
  }

  /** Achievements and species tasks with progress and rewards; opened from the pause menu. */
  showAchievements() {
    this.screen = "achievements";
    this.clear();
    const prog = profile.data;
    const unlocked = new Set(prog.achievements?.unlocked ?? []);
    const s = progressSnapshot(prog);
    const tasks = prog.dexTasks ?? {};
    const row = (key, title, desc, cur, goal, gold) => {
      const done = unlocked.has(key);
      const pct = goal ? Math.min(1, cur / goal) : 0;
      return el(
        "div",
        { class: "ach-row" + (done ? " on" : "") },
        el("div", { class: "ach-mark" }, done ? "✓" : ""),
        el("div", { class: "ach-info" },
          el("div", { class: "ach-title" }, title),
          el("div", { class: "ach-desc muted" }, desc),
          el("div", { class: "ach-bar" }, el("i", { style: { width: `${Math.round(pct * 100)}%` } }))
        ),
        el("div", { class: "ach-meta" }, el("b", {}, `${Math.min(cur, goal)} / ${goal}`), el("span", { class: "ach-gold" }, `+${gold}G`))
      );
    };
    const list = el("div", { class: "ach-list" });
    for (const a of ACHIEVEMENTS) list.append(row(a.key, a.title, a.desc, s[a.stat] ?? 0, a.goal, a.gold));
    for (const t of DEX_TASKS) list.append(row("task_" + t.key, t.title, t.desc, tasks[t.key] ?? 0, t.need, t.gold));
    const doneAch = ACHIEVEMENTS.filter((a) => unlocked.has(a.key)).length;
    const doneTasks = DEX_TASKS.filter((t) => unlocked.has("task_" + t.key)).length;
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Conquistas"),
          el("p", { class: "muted" }, `${doneAch} / ${ACHIEVEMENTS.length} conquistas · ${doneTasks} / ${DEX_TASKS.length} tarefas · ouro pendente: ${prog.pendingGold ?? 0}G`),
          list,
          el("button", { class: "btn big ghost", onclick: () => this.returnToPause() }, "Fechar")
        )
      )
    );
  }

  showNickname() {
    this.screen = "nickname";
    this.clear();
    const run = this.getRun();
    const player = run?.player;
    const current = player?.nickname ?? "";
    const input = el("input", {
      type: "text",
      value: current,
      placeholder: "Apelido",
      class: "nick-input",
    });
    const hint = el("p", { class: "muted" }, "Deixe em branco para usar o nome da espécie.");
    const save = () => {
      if (player) {
        player.nickname = input.value.trim() || null;
        // Persist to profile so it survives across runs
        profile.data.nickname = player.nickname;
        profile.save();
      }
      this.returnToPause();
    };
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Apelido do Pokémon"),
          hint,
          input,
          el(
            "div",
            { class: "result-actions" },
            el("button", { class: "btn big red", onclick: save }, "Salvar"),
            el("button", { class: "btn big ghost", onclick: () => this.returnToPause() }, "Cancelar")
          )
        )
      )
    );
    input.focus();
  }

  showHeldItem() {
    this.screen = "helditem";
    this.clear();
    const run = this.getRun();
    const player = run?.player;
    // Only offer items with implemented held-item effects.
    const keys = HELD_ITEMS.filter((k) => (this.data.items ?? {})[k]); // only items with an implemented effect
    const items = Object.fromEntries(
      keys.map((k) => [k, this.data.items[k]])
    );
    const list = el("div", { class: "helditem-list" });
    const refresh = () => {
      clear(list);
      // Read the live value on every refresh: the selection changes it.
      const current = player ? player.heldItem ?? null : profile.data.heldItem ?? null;
      list.append(el("p", { class: "muted" }, "Escolha um item para segurar (ou nenhum):"));
      const none = el("button", {
        class: "btn " + (current === null ? "red" : "ghost"),
        onclick: () => { if (player) { player.heldItem = null; profile.data.heldItem = null; profile.save(); run.recompute(player); } refresh(); },
      }, "Nenhum" + (current === null ? " ✓" : ""));
      list.append(none);
      for (const key of keys) {
        const it = items[key];
        const isCur = current === key;
        list.append(
          el("button", {
            class: "btn " + (isCur ? "red" : "ghost"),
            onclick: () => { if (player) { player.heldItem = key; profile.data.heldItem = key; profile.save(); run.recompute(player); } refresh(); },
          }, it.name + " — " + heldItemDesc(key, it) + (isCur ? " ✓" : ""))
        );
      }
    };
    refresh();
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Item Segurado"),
          list,
          el("button", { class: "btn big ghost", onclick: () => this.returnToPause() }, "Fechar")
        )
      )
    );
  }
}
