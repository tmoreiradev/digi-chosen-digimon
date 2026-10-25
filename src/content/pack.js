// Content pack: the franchise the engine is dressed in. The engine reads every franchise-specific
// constant from here; the rest of the content is data (src/data/*.json, with rules.json) and art
// (assets/<spriteDirs>). A fork in another universe replaces this file, the tables and the art,
// and keeps the engine. The contract is in docs/PACOTE_DE_CONTEUDO.md.

export const PACK = {
  id: "pokemon",
  // localStorage prefix: saves live under "<prefix>.accounts.v1" etc. Changing it here starts a
  // fresh save set (a fork wants that); this pack must keep it, or old saves stop loading.
  storagePrefix: "pokebonk-clone",
  // Sprite folders under assets/ (copied next to the bundle): animated sheets, then static fallbacks.
  spriteDirs: ["pmd", "front"],
  // Partners every profile starts with (species ids).
  starters: [1, 4, 7],
  // The sanctuary's legendary when a biome lists none (species id).
  fallbackLegendary: 150,
  // Old Rod: the common and the rare catch it calls up (species ids; the floater shows their names).
  oldRod: { common: 129, rare: 130 },
  // Elemental types: colour (0xRRGGBB) and name per interface language (English defaults to the
  // capitalised key). The type chart itself is data (types.json).
  types: {
    normal: { color: 0xc8d0dc, pt: "Normal", es: "Normal" },
    fighting: { color: 0xe0a020, pt: "Lutador", es: "Lucha" },
    flying: { color: 0x6ac8ff, pt: "Voador", es: "Volador" },
    poison: { color: 0xb560e0, pt: "Veneno", es: "Veneno" },
    ground: { color: 0xd8b070, pt: "Terra", es: "Tierra" },
    rock: { color: 0xb0a060, pt: "Pedra", es: "Roca" },
    bug: { color: 0x8ac020, pt: "Inseto", es: "Bicho" },
    ghost: { color: 0x7a68b0, pt: "Fantasma", es: "Fantasma" },
    steel: { color: 0xa0b0c0, pt: "Aço", es: "Acero" },
    fire: { color: 0xff7a2a, pt: "Fogo", es: "Fuego" },
    water: { color: 0x3aa0ff, pt: "Água", es: "Agua" },
    grass: { color: 0x5ad24a, pt: "Planta", es: "Planta" },
    electric: { color: 0xffd030, pt: "Elétrico", es: "Eléctrico" },
    psychic: { color: 0xff7fa0, pt: "Psíquico", es: "Psíquico" },
    ice: { color: 0x80d8f0, pt: "Gelo", es: "Hielo" },
    dragon: { color: 0x9060e0, pt: "Dragão", es: "Dragón" },
    dark: { color: 0x706090, pt: "Sombrio", es: "Siniestro" },
    fairy: { color: 0xf090c0, pt: "Fada", es: "Hada" },
  },
  // Word swaps applied to every on-screen text after translation, per language: a fork maps the
  // franchise words the engine's text uses ("Pokémon", "Pokédex", "Poké Bola"…) to its own.
  // This pack is the source of that text, so it swaps nothing.
  terms: { "pt-BR": {}, en: {}, es: {} },
};

/** 0xRRGGBB → [r, g, b]. */
export const packRgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
