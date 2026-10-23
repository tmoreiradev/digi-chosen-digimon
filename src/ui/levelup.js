// Level-up chooser: three upgrade cards plus reroll / skip / banish.

import { el, clear, typeCss } from "./dom.js";

const RARITY_CSS = ["#c8d0dc", "#5ad87a", "#4aa8ff", "#c070ff", "#ffc83a"];

export class LevelUpPanel {
  constructor(root, onPick) {
    this.root = root;
    this.onPick = onPick;
    this.choices = [];
    this.rollsLeft = 2;
    this.active = false;
  }

  show(choices) {
    this.choices = choices;
    this.active = true;
    this.render();
  }

  render() {
    clear(this.root);
    this.root.className = "levelup show";
    const cards = el("div", { class: "levelup-cards" });

    this.choices.forEach((ch, i) => {
      const rarity = ch.rarity ?? 0;
      const isVit = ch.kind === "newVit" || ch.kind === "upVit";
      const card = el(
        "div",
        { class: "lu-card", style: { "--rar": RARITY_CSS[rarity] } },
        el("div", { class: "lu-key" }, String(i + 1)),
        el("div", { class: "lu-title" }, ch.title),
        ch.sub && !ch.kind ? el("div", { class: "lu-sub" }, ch.sub) : null,
        ch.type ? el("div", { class: "lu-type" }, el("i", { style: { background: typeCss(ch.type) } }), ch.type) : null,
        ch.kind ? el("div", { class: isVit ? "lu-vit" : ch.kind === "fusion" ? "lu-fusion" : "lu-sub" },
          isVit ? "VITAMIN" : ch.kind === "fusion" ? "FUSION" : ch.sub) : null,
        ...(ch.lines ?? []).map((l) => el("div", { class: "lu-line" }, l)),
        el("div", { class: "lu-rarity" }, ["Common", "Uncommon", "Rare", "Epic", "Legendary"][rarity])
      );
      card.addEventListener("click", () => this.choose(i));
      cards.append(card);
    });

    const actions = el(
      "div",
      { class: "levelup-actions" },
      el("button", { class: "btn ghost", onclick: () => this.reroll() }, "Reroll ", el("kbd", {}, "F"), ` (${this.rollsLeft})`),
      el("button", { class: "btn ghost", onclick: () => this.skip() }, "Skip ", el("kbd", {}, "X")),
      el("button", { class: "btn ghost", onclick: () => this.banish() }, "Banish ", el("kbd", {}, "Z"))
    );

    this.root.append(
      el(
        "div",
        { class: "levelup-inner" },
        el("h2", {}, "Level up!"),
        el("p", { class: "levelup-sub" }, "Choose an upgrade"),
        cards,
        actions
      )
    );
  }

  /** Hide the cards without picking (run ended); pending level-ups are the caller's to drop. */
  close() {
    this.active = false;
    this.root.className = "levelup";
    clear(this.root);
  }

  choose(index) {
    if (!this.active) return;
    const choice = this.choices[index];
    if (!choice) return;
    this.close();
    this.onPick(choice);
  }

  reroll() {
    if (!this.active || this.rollsLeft <= 0) return;
    this.rollsLeft--;
    this.onPick(null, "reroll");
  }

  skip() {
    if (!this.active) return;
    this.close();
    this.onPick(null, "skip");
  }

  banish() {
    if (!this.active) return;
    const choice = this.choices[0];
    if (choice?.key) this.onPick(null, "banish", choice.key);
  }

  key(code) {
    if (!this.active) return false;
    if (code === "Digit1") this.choose(0);
    else if (code === "Digit2") this.choose(1);
    else if (code === "Digit3") this.choose(2);
    else if (code === "KeyF") this.reroll();
    else if (code === "KeyX") this.skip();
    else if (code === "KeyZ") this.banish();
    else return false;
    return true;
  }
}
