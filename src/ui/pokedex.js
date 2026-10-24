// Pokédex: browse every species in the data tables, filter by seen / caught /
// unseen, and track completion. Persisted in profile.data.progress.pokedex.

import { el, clear } from "../ui/dom.js";
import { portraitStyle } from "../render/sprites.js";
import { typeName } from "../core/i18n.js";

export class Pokedex {
  constructor(root, data, profile) {
    this.root = root;
    this.data = data;
    this.profile = profile;
    this.filter = "all"; // all | seen | caught | unseen
    this.search = "";
    this.onClose = () => {};
  }

  /* ------------------------------------------------------------- data */

  progress() {
    const p = this.profile.data;
    return p.pokedex ?? { seen: [], caught: [] };
  }

  seenSet() {
    return new Set(this.progress().seen ?? []);
  }

  caughtSet() {
    return new Set(this.progress().caught ?? []);
  }

  /* ------------------------------------------------------------- render */

  show() {
    this.root.className = "screen dim";
    clear(this.root);
    const panel = el("div", { class: "pokedex-panel" });

    const header = el("div", { class: "pokedex-header" });
    header.append(
      el("h2", {}, "Pokédex"),
      el("div", { class: "pokedex-stats" }, this.statsLine())
    );

    // Filter chips
    const filters = el("div", { class: "pokedex-filters" });
    const filterLabels = { all: "Todos", seen: "Vistos", caught: "Capturados", unseen: "Não vistos" };
    for (const f of ["all", "seen", "caught", "unseen"]) {
      const btn = el("button", {
        class: "chip " + (this.filter === f ? "on" : ""),
        onclick: () => { this.filter = f; this.renderList(list); },
      }, filterLabels[f]);
      filters.append(btn);
    }

    // Search
    const searchWrap = el("div", { class: "pokedex-search" });
    const searchInput = el("input", {
      type: "text",
      placeholder: "Buscar espécie…",
      value: this.search,
      oninput: (e) => { this.search = e.target.value.toLowerCase(); this.renderList(list); },
    });
    searchWrap.append(searchInput);

    header.append(filters, searchWrap);

    const list = el("div", { class: "pokedex-list" });
    this.renderList(list);

    const closeBtn = el("button", { class: "btn big ghost", onclick: () => this.close() }, "Fechar");

    panel.append(header, list, closeBtn);
    this.root.append(panel);
  }

  statsLine() {
    const seen = this.seenSet();
    const caught = this.caughtSet();
    const total = this.data.pokemon ? this.data.pokemon.length : 0;
    const pct = total ? Math.round((caught.size / total) * 100) : 0;
    return `${caught.size} / ${total} capturados  ·  ${seen.size} vistos  ·  ${pct}%`;
  }

  renderList(list) {
    clear(list);
    const seen = this.seenSet();
    const caught = this.caughtSet();

    const species = (this.data.pokemon || []).filter((sp) => {
      const name = (sp.name || "").toLowerCase();
      if (this.search && !name.includes(this.search)) return false;
      const isSeen = seen.has(sp.id);
      const isCaught = caught.has(sp.id);
      if (this.filter === "seen" && !isSeen) return false;
      if (this.filter === "caught" && !isCaught) return false;
      if (this.filter === "unseen" && isSeen) return false;
      return true;
    });

    // Sort: caught first, then seen, then unseen; then by id.
    species.sort((a, b) => {
      const ca = caught.has(a.id) ? 2 : seen.has(a.id) ? 1 : 0;
      const cb = caught.has(b.id) ? 2 : seen.has(b.id) ? 1 : 0;
      if (cb !== ca) return cb - ca;
      return a.id - b.id;
    });

    for (const sp of species) {
      const isSeen = seen.has(sp.id);
      const isCaught = caught.has(sp.id);
      const card = el("div", {
        class: "pokedex-card" + (isCaught ? " caught" : isSeen ? " seen" : " unseen"),
      });

      // Thumbnail
      const thumb = el("div", { class: "pokedex-thumb" });
      const style = portraitStyle(sp.id, 56) ?? {};
      const img = el("div", { class: "pokedex-img", style });
      if (!isSeen) {
        img.classList.add("hidden");
        img.append(el("div", { class: "pokedex-question", html: "?" }));
      }
      thumb.append(img);

      // Info
      const info = el("div", { class: "pokedex-info" });
      const nameRow = el("div", { class: "pokedex-name-row" });
      const num = el("div", { class: "pokedex-num" }, `#${String(sp.id).padStart(3, "0")}`);
      const name = el("div", { class: "pokedex-name" }, sp.name);
      const shinyStar = isCaught ? el("span", { class: "pokedex-shiny", title: "Capturado" }, "★") : null;
      nameRow.append(num, name, shinyStar);

      const types = el("div", { class: "pokedex-types" });
      for (const t of (sp.types || [])) {
        types.append(el("span", { class: "chip", style: { background: this.typeCss(t) } }, typeName(t)));
      }

      const status = el("div", { class: "pokedex-status" });
      if (isCaught) status.append(el("span", { class: "status caught" }, "Capturado"));
      else if (isSeen) status.append(el("span", { class: "status seen" }, "Visto"));
      else status.append(el("span", { class: "status unseen" }, "Não visto"));

      info.append(nameRow, types, status);
      card.append(thumb, info);
      list.append(card);
    }

    if (species.length === 0) {
      list.append(el("p", { class: "pokedex-empty" }, "Nenhuma espécie encontrada."));
    }
  }

  typeCss(t) {
    const map = {
      normal: "#c8d0dc", fighting: "#e0a020", flying: "#6ac8ff", poison: "#b560e0",
      ground: "#d8b070", rock: "#b0a060", bug: "#8ac020", ghost: "#7a68b0",
      steel: "#a0b0c0", fire: "#ff7a2a", water: "#3aa0ff", grass: "#5ad24a",
      electric: "#ffd030", psychic: "#ff7fa0", ice: "#80d8f0", dragon: "#9060e0",
      dark: "#706090", fairy: "#f090c0",
    };
    return map[t] ?? "#cccccc";
  }

  close() {
    this.root.className = "screens";
    clear(this.root);
    if (this.onClose) this.onClose();
  }
}
