// Language switch: pt-BR (default) / English. The sweep in scripts/collect-strings.mjs plays every
// screen, card, event and full bot runs in English and lists the text that reached the screen
// untranslated; nothing Portuguese may be left in it.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";
import { collectMissing } from "../scripts/collect-strings.mjs";

installFakeDom().register("ui");

const { getLang, setLang, tr, LANG_KEY } = await import("../src/core/lang.js");

// Portuguese tell-tales: accents (except in Pokémon names) and common short words.
const PT = /[ãõçáíóúâêôà]|\b(de|do|da|dos|das|para|com|seu|sua|não|uma|ao|no|na|em|por|mais|golpes?|inimigos|ouro|nível|aperte|sair|vença|veja)\b/i;
const NAMES = /Pokémon|Pokédex|Flabébé|🌐 Português|🌐 Español/g; // names, and the switch label that names Portuguese on purpose

// Portuguese that Spanish does not share (Spanish also has á, í, ó, ú, "de", "no", "en", "para"...).
const PT_NOT_ES = /[ãõçâêô]|(?<!\p{L})(não|você|seu|sua|uma|ao|em|dos|das|ouro|nível|aperte|sair|vença|veja|inimigos|mais|nenhum|abates|fechar|voltar)(?!\p{L})/iu; // "golpe" is Spanish too; letter-aware boundaries (\b breaks on accents)

test("in Spanish, nothing Portuguese reaches the screen either", async () => {
  const { missing, rendered, bot } = await collectMissing("es");
  const pt = (list) => list.filter((s) => PT_NOT_ES.test(s.replace(NAMES, "")));
  assert.deepEqual(pt(missing), [], "untranslated text that went through tr()");
  assert.deepEqual(pt(rendered), [], "text actually on screen");
  assert.ok(bot.some((s) => (s.chestsOpened ?? 0) > 0), "a chest was opened in Spanish");
  setLang("pt-BR");
});

test("in English, nothing Portuguese reaches the screen across screens, cards, events and full runs", async () => {
  const { missing, rendered, bot } = await collectMissing("en");
  const pt = (list) => list.filter((s) => PT.test(s.replace(NAMES, "")));
  assert.deepEqual(pt(missing), [], "untranslated text that went through tr()");
  assert.deepEqual(pt(rendered), [], "text actually on screen (text nodes, direct textContent writes included)");
  assert.ok(rendered.length > 200, "the sweep really rendered the interface: " + rendered.length);
  // The English runs must have used the panels for real, not just closed them.
  assert.ok(bot.some((s) => (s.chestsOpened ?? 0) > 0), "a chest was opened in English");
  assert.ok(bot.some((s) => (s.bought ?? 0) > 0), "something was bought in English");
});

test("names the player typed are never translated", async () => {
  const { accounts } = await import("../src/ui/account.js");
  const { Screens } = await import("../src/ui/screens.js");
  const { loadData, makeRun } = await import("./_helpers.mjs");
  setLang("en");
  accounts.create("Campeão", "");
  const root = document.createElement("div");
  const screens = new Screens(root, loadData());
  screens.showTitle();
  assert.match(root.querySelector(".title-stats").textContent, /Trainer: Campeão/);
  const { run } = makeRun();
  run.state = "dead";
  screens.showResults(run, false);
  assert.ok(root.all().some((n) => /^Campeão · /.test(n.textContent ?? "")), "results keep the name");
  assert.equal(tr("toString"), "toString", "inherited keys are not translations");
  setLang("pt-BR");
});

test("spot checks: fixed text, patterns, nested parts and composites", () => {
  setLang("en");
  assert.equal(tr("Pausado"), "Paused");
  assert.equal(tr("Zona 2 limpa!"), "Zone 2 cleared!");
  assert.equal(tr("Comprou Doce Raro por 92G."), "Bought Rare Candy for 92G.");
  assert.equal(tr("+12% de dano"), "+12% damage");
  assert.equal(tr("+12% quantidade de inimigos · +10% ganho de XP · +5 sorte"), "+12% enemy count · +10% XP gain · +5 luck");
  assert.equal(tr("Scyther: Saraivada!"), "Scyther: Volley!");
  assert.equal(tr("Brock · Bulbasaur · Green Forest · Difícil"), "Brock · Bulbasaur · Green Forest · Hard");
  assert.equal(tr("Leftovers"), "Leftovers", "proper names pass through");
  setLang("es");
  assert.equal(tr("Pausado"), "En pausa");
  assert.equal(tr("Zona 2 limpa!"), "¡Zona 2 despejada!");
  assert.equal(tr("+12% quantidade de inimigos · +10% ganho de XP"), "+12% cantidad de enemigos · +10% experiencia obtenida");
  setLang("en");
});

test("the choice persists under its own key and pt-BR is untouched text", () => {
  setLang("en");
  assert.equal(localStorage.getItem(LANG_KEY), "en");
  assert.equal(document.documentElement.lang, "en");
  setLang("pt-BR");
  assert.equal(getLang(), "pt-BR");
  assert.equal(tr("Pausado"), "Pausado");
  setLang("xx");
  assert.equal(getLang(), "pt-BR", "unknown languages are ignored");
});

test("the title screen switch flips the language and redraws in it", async () => {
  const { Screens } = await import("../src/ui/screens.js");
  const { loadData } = await import("./_helpers.mjs");
  setLang("pt-BR");
  const root = document.createElement("div");
  const screens = new Screens(root, loadData());
  screens.showTitle();
  const btn = () => root.all().find((n) => n.tagName === "button" && /🌐/.test(n.textContent));
  assert.equal(btn().textContent, "🌐 English");
  btn().click();
  assert.equal(getLang(), "en");
  assert.ok(root.all().some((n) => n.tagName === "button" && n.textContent === "▶ Play"));
  assert.equal(btn().textContent, "🌐 Español", "the next language, named in itself");
  btn().click();
  assert.equal(getLang(), "es");
  assert.ok(root.all().some((n) => n.tagName === "button" && n.textContent === "▶ Jugar"));
  assert.equal(btn().textContent, "🌐 Português");
  btn().click();
  assert.equal(getLang(), "pt-BR");
  assert.ok(root.all().some((n) => n.tagName === "button" && n.textContent === "▶ Jogar"));
});
