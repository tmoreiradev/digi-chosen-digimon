// Interface language. The game is written in pt-BR and the pt-BR text is the key (gettext style):
// tr() turns it into English at the points where text reaches the screen (dom.js el(), the HUD,
// banners, canvas labels). Exact strings come from EN; strings with numbers or names from EN_PATTERNS.
// Anything without a translation stays in pt-BR, and is recorded in TR_MISSING to find it.

import { EN, EN_PATTERNS, bindTr } from "./lang-en.js";

export const LANG_KEY = "pokebonk-clone.lang.v1"; // new key; the save keys are untouched
export const LANGS = { "pt-BR": "Português", en: "English" };

let current = "pt-BR";
try {
  const saved = globalThis.localStorage?.getItem(LANG_KEY);
  if (saved && LANGS[saved]) current = saved;
} catch {
  /* storage blocked: stay in pt-BR */
}

export const getLang = () => current;

export function setLang(lang) {
  if (!LANGS[lang]) return;
  current = lang;
  try {
    globalThis.localStorage?.setItem(LANG_KEY, lang);
  } catch {
    /* not persisted, still applied */
  }
  if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = lang;
}

/** pt-BR strings that reached the screen in English mode without a translation (for tests/tools). */
export const TR_MISSING = new Set();

export function tr(text) {
  if (current === "pt-BR" || typeof text !== "string" || !text) return text;
  if (Object.hasOwn(EN, text)) return EN[text]; // own keys only: "toString" is not a translation
  for (const [re, fn] of EN_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const out = fn(...m.slice(1));
    if (out != null) return out; // null: the pattern matched the shape but not the words, keep looking
  }
  // Composites joined by " · " (card lines, the results line, upgrade descriptions): part by part.
  if (text.includes(" · ")) return text.split(" · ").map(tr).join(" · ");
  if (/[A-Za-zÀ-ÿ]{3}/.test(text)) TR_MISSING.add(text);
  return text;
}

bindTr(tr);
