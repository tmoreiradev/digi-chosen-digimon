// Front-end screens: title, roster picker, region/difficulty setup, pause and results.

import { el, clear, typeCss } from "./dom.js";
import { DIFFICULTIES } from "../game/rules.js";
import { fmtTime } from "../core/math.js";
import { accounts, profile } from "./account.js";
import { portraitStyle } from "../render/sprites.js";
import { Pokedex } from "./pokedex.js";

export class Screens {
  constructor(root, data) {
    this.root = root;
    this.data = data;
    this.onStart = () => {};
    this.onResume = () => {};
    this.onQuit = () => {};
    this.onVolume = () => {};
    this.selected = 1;
    this.biome = data.rules.biomes[0].id;
    this.difficulty = DIFFICULTIES[0];
    this.mode = "classic";
    this.screen = "title";
    this.pokedex = new Pokedex(this.root, this.data, profile);
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
          el("p", { class: "tagline" }, "Survivor roguelite · Kanto · offline"),
          el("div", { class: "title-actions" },
            el("button", { class: "btn big red", onclick: () => this.showAccountPicker() }, "▶ Play"),
            el("button", { class: "btn big ghost", onclick: () => this.showHelp() }, "? How to play")
          ),
          el("div", { class: "title-stats" },
            el("span", {}, `Runs: ${profile.data.runs ?? 0}`),
            el("span", {}, `Best: ${fmtTime(profile.data.best ?? 0)}`),
            el("span", {}, `Caught: ${(profile.data.caught ?? []).length} / ${this.data.rules.roster.length}`)
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
          el("h2", {}, "How to play"),
          el("ul", { class: "help-list" },
            el("li", {}, el("kbd", {}, "WASD"), " / arrows — move"),
            el("li", {}, el("kbd", {}, "Space"), " — jump"),
            el("li", {}, el("kbd", {}, "Shift"), " — dash (brief invulnerability)"),
            el("li", {}, el("kbd", {}, "R"), " — ultimate, once charged"),
            el("li", {}, el("kbd", {}, "P"), " — pause"),
            el("li", {}, el("kbd", {}, "1"), el("kbd", {}, "2"), el("kbd", {}, "3"), " — pick an upgrade on level-up"),
            el("li", {}, el("kbd", {}, "E"), " — throw a ball at a weakened alpha/boss (capture)"),
            el("li", {}, el("kbd", {}, "F"), " reroll · ", el("kbd", {}, "X"), " skip · ", el("kbd", {}, "Z"), " banish")
          ),
          el("p", { class: "muted" }, "Your Pokémon attacks on its own. Collect blue XP orbs to level up, choose upgrades, and evolve before the horde overwhelms you."),
          el("button", { class: "btn big red", onclick: () => this.showTitle() }, "Back")
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
          el("div", { class: "ac-kind muted" }, prof.kindLabel + " · " + (prof.progress?.runs ?? 0) + " runs"),
          el("div", { class: "ac-best muted" }, "Best: " + fmtTime(prof.progress?.best ?? 0))
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
          el("h2", {}, "Choose a profile"),
          list,
          el("div", { class: "result-actions", style: { marginTop: 16 } },
            el("button", { class: "btn big ghost", onclick: () => this.showAccountManage() }, "+ Create / Log in"),
            el("button", { class: "btn big red", onclick: () => { accounts.playAsGuest(); profile.save(); this.showPicker(); } }, "Play as Guest")
          )
        )
      )
    );
  }

  showAccountManage() {
    this.screen = "account-manage";
    this.clear();
    const nameIn = el("input", { type: "text", placeholder: "Name", class: "inp", value: "" });
    const passIn = el("input", { type: "text", placeholder: "Passphrase (optional)", class: "inp", value: "" });
    const msg = el("div", { class: "muted" });
    this.root.append(
      el(
        "div",
        { class: "screen dim" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, "Create or log in"),
          el("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            el("label", {}, "Name"),
            nameIn,
            el("label", {}, "Passphrase"),
            passIn,
            msg
          ),
          el("div", { class: "result-actions", style: { marginTop: 14, gap: 8 } },
            el("button", { class: "btn big red", onclick: () => {
              const r = accounts.create(nameIn.value, passIn.value);
              if (!r.ok) { msg.textContent = r.error; return; }
              profile.save();
              this.showPicker();
            } }, "Create & Play"),
            el("button", { class: "btn big ghost", onclick: () => {
              const r = accounts.login(nameIn.value, passIn.value);
              if (!r.ok) { msg.textContent = r.error; return; }
              profile.save();
              this.showPicker();
            } }, "Log In"),
            el("button", { class: "btn big ghost", onclick: () => this.showAccountPicker() }, "Back")
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
        el("div", { class: "pc-types" }, ...species.types.map((t) => el("span", { class: "chip", style: { background: typeCss(t) } }, t))),
        el("div", { class: "pc-passive" }, el("b", {}, this.data.abilities[String(species.abilities[0])]?.name ?? "—")),
        el("div", { class: "pc-stats" },
          ...["hp", "atk", "def", "spa", "spd", "spe"].map((k) =>
            el("span", { class: "pc-stat" }, el("i", {}, k.toUpperCase()), String(species.stats[k]))
          )
        ),
        el("div", { class: "pc-rank " + entry.rank }, entry.rank)
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
          el("h1", {}, "Choose your partner"),
          el("p", { class: "muted" }, "Unlocked partners grow as you complete challenges. Starters are always available.")
        ),
        list,
        el(
          "div",
          { class: "picker-foot" },
          el("div", { class: "picker-detail" },
            el("b", {}, species?.name ?? ""),
            el("span", { class: "muted" }, entry ? ` · ${entry.role} · ${entry.rank}` : "")
          ),
          el("button", { class: "btn big red", onclick: () => this.showSetup() }, "Continue")
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
        el("h3", {}, b.name),
        el("p", { class: "muted" }, b.desc),
        el("div", { class: "pc-types" }, ...b.types.map((t) => el("span", { class: "chip", style: { background: typeCss(t) } }, t)))
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
          el("span", { class: "muted" }, d.id === "normal" ? "Enemies at base strength" : `Enemies +${Math.round((d.enemyHp - 1) * 100)}% HP, +${Math.round((d.enemyDamage - 1) * 100)}% damage`)
        )
      );
    }

    const modeList = el(
      "div",
      { class: "mode-list" },
      el("button", { class: "mode-card" + (this.mode === "classic" ? " on" : ""), onclick: () => { this.mode = "classic"; this.showSetup(); } },
        el("b", {}, "Classic"), el("span", { class: "muted" }, "Zones, guardians and a sanctuary")),
      el("button", { class: "mode-card" + (this.mode === "endless" ? " on" : ""), onclick: () => { this.mode = "endless"; this.showSetup(); } },
        el("b", {}, "Endless"), el("span", { class: "muted" }, "Endless hordes and milestones")),
      el("button", { class: "mode-card" + (this.mode === "tower" ? " on" : ""), onclick: () => { this.mode = "tower"; this.showSetup(); } },
        el("b", {}, "Tower"), el("span", { class: "muted" }, "Themed floors, waves and guardians"))
    );

    this.root.append(
      el(
        "div",
        { class: "screen setup-screen" },
        el("div", { class: "setup-grid" },
          el("div", {}, el("h2", {}, "Region"), regionList),
          el("div", {}, el("h2", {}, "Mode"), modeList, el("h2", {}, "Difficulty"), diffList)
        ),
        el(
          "div",
          { class: "setup-foot" },
          el("button", { class: "btn big ghost", onclick: () => this.showPicker() }, "← Back"),
          el("button", { class: "btn big red", onclick: () => this.onStart() }, "Start!")
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
    const caught = new Set(profile.data.caught ?? []);
    caught.add(p.speciesId);
    profile.data.caught = [...caught];
    profile.save();

    this.root.append(
      el(
        "div",
        { class: "screen dim results-screen" },
        el(
          "div",
          { class: "card panel" },
          el("h2", {}, victory ? "Victory!" : "You fainted"),
          el("p", { class: "muted" }, `${p.species.name} · ${run.biome.name} · ${run.difficulty.name}`),
          el("div", { class: "result-grid" },
            el("div", {}, el("b", {}, fmtTime(run.time)), el("span", {}, "survived")),
            el("div", {}, el("b", {}, String(stats.kills)), el("span", {}, "kills")),
            el("div", {}, el("b", {}, String(stats.levels)), el("span", {}, "levels")),
            el("div", {}, el("b", {}, String(stats.items)), el("span", {}, "upgrades")),
            el("div", {}, el("b", {}, String(stats.gold)), el("span", {}, "coins")),
            el("div", {}, el("b", {}, String(Math.round(stats.damage))), el("span", {}, "damage"))
          ),
          el(
            "div",
            { class: "result-actions" },
            el("button", { class: "btn big red", onclick: () => this.showSetup() }, "Play again"),
            el("button", { class: "btn big ghost", onclick: () => this.showTitle() }, "Main menu")
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
          el("h2", {}, "Paused"),
          el("label", { class: "vol-row" }, el("span", {}, "Volume"), slider),
          el(
            "div",
            { class: "result-actions" },
            el("button", { class: "btn big red", onclick: onResume }, "Resume"),
            el("button", { class: "btn big ghost", onclick: () => this.showPokedex() }, "Pokédex"),
            el("button", { class: "btn big ghost", onclick: () => this.showNickname() }, "Apelido"),
            el("button", { class: "btn big ghost", onclick: () => this.showHeldItem() }, "Item Seg. "),
            el("button", { class: "btn big ghost", onclick: onQuit }, "Quit to menu")
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

  showNickname() {
    this.screen = "nickname";
    this.clear();
    const run = globalThis.__PB__?.run;
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
    const run = globalThis.__PB__?.run;
    const player = run?.player;
    // Only offer items with implemented held-item effects.
    const ITEMS_WITH_HELD_EFFECT = ["leftovers", "choice-band"];
    const keys = ITEMS_WITH_HELD_EFFECT.filter((k) => (this.data.items ?? {})[k]);
    const items = Object.fromEntries(
      keys.map((k) => [k, this.data.items[k]])
    );
    const current = player?.heldItem ?? null;
    const list = el("div", { class: "helditem-list" });
    const refresh = () => {
      clear(list);
      list.append(el("p", { class: "muted" }, "Escolha um item para segurar (ou nenhum):"));
      const none = el("button", {
        class: "btn " + (current === null ? "red" : "ghost"),
        onclick: () => { if (player) { player.heldItem = null; profile.data.heldItem = null; profile.save(); } refresh(); },
      }, "Nenhum" + (current === null ? " ✓" : ""));
      list.append(none);
      for (const key of keys) {
        const it = items[key];
        const isCur = current === key;
        list.append(
          el("button", {
            class: "btn " + (isCur ? "red" : "ghost"),
            onclick: () => { if (player) { player.heldItem = key; profile.data.heldItem = key; profile.save(); } refresh(); },
          }, it.name + " — " + it.desc + (isCur ? " ✓" : ""))
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
