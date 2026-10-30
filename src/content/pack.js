// Content pack — DIGIMON (fork of the Digi Chosen engine). The franchise the engine is dressed in. The engine reads every franchise-specific
// constant from here; the rest of the content is data (src/data/*.json, with rules.json) and art
// (assets/<spriteDirs>). A fork in another universe replaces this file, the tables and the art,
// and keeps the engine. The contract is in docs/PACOTE_DE_CONTEUDO.md.

export const PACK = {
  id: "digimon",
  // localStorage prefix: this fork keeps its saves apart from the Pokémon game's.
  storagePrefix: "digi-chosen-digimon",
  // Sprite folders under assets/ (copied next to the bundle): animated sheets, then static fallbacks.
  spriteDirs: ["sprites", "portraits"], // NSS overworld folders (sprites/<id>/) and 40x40 faces; see scripts/nss.mjs
  // Partners every profile starts with (species ids).
  starters: [1, 5, 9, 23, 27], // Agumon, Gabumon, Patamon, Guilmon, Salamon
  // The sanctuary's legendary when a biome lists none (species id).
  fallbackLegendary: 22, // Devimon
  // Old Rod: the common and the rare catch it calls up (species ids; the floater shows their names).
  oldRod: { common: 17, rare: 18 }, // Gomamon, Ikkakumon
  // Elemental types: colour (0xRRGGBB) and name per interface language (English defaults to the
  // capitalised key). The type chart itself is data (types.json).
  types: {
    normal: { color: 0xc8d0dc, pt: "Neutro", en: "Neutral", es: "Neutro" },
    fighting: { color: 0xe0a020, pt: "Lutador", es: "Lucha" },
    flying: { color: 0x6ac8ff, pt: "Vento", en: "Wind", es: "Viento" },
    poison: { color: 0xb560e0, pt: "Veneno", es: "Veneno" },
    ground: { color: 0xd8b070, pt: "Terra", es: "Tierra" },
    rock: { color: 0xb0a060, pt: "Pedra", es: "Roca" },
    bug: { color: 0x8ac020, pt: "Inseto", es: "Bicho" },
    ghost: { color: 0x7a68b0, pt: "Fantasma", es: "Fantasma" },
    steel: { color: 0xa0b0c0, pt: "Máquina", en: "Machine", es: "Máquina" },
    fire: { color: 0xff7a2a, pt: "Fogo", es: "Fuego" },
    water: { color: 0x3aa0ff, pt: "Água", es: "Agua" },
    grass: { color: 0x5ad24a, pt: "Planta", es: "Planta" },
    electric: { color: 0xffd030, pt: "Trovão", en: "Thunder", es: "Trueno" },
    psychic: { color: 0xff7fa0, pt: "Psíquico", es: "Psíquico" },
    ice: { color: 0x80d8f0, pt: "Gelo", es: "Hielo" },
    dragon: { color: 0x9060e0, pt: "Dragão", es: "Dragón" },
    dark: { color: 0x706090, pt: "Trevas", en: "Darkness", es: "Oscuridad" },
    fairy: { color: 0xf090c0, pt: "Luz", en: "Light", es: "Luz" },
  },
  // Word swaps applied to every on-screen text after translation, per language: a fork maps the
  // franchise words the engine's text uses ("Pokémon", "Pokédex", "Poké Bola"…) to its own.
  terms: {
    // The capture phrases first: "a bola"/"a ball" has no franchise word for the short swaps to catch.
    "pt-BR": { "lançar a bola": "usar o Digivice", Pokédex: "DigiDex", "Poké Bola": "Digivice", Pokémon: "Digimon", Kanto: "Ilha File", Evoluiu: "Digievoluiu" },
    en: { "throw a ball": "use the Digivice", Pokédex: "DigiDex", "Poké Ball": "Digivice", Pokémon: "Digimon", Kanto: "File Island", Evolved: "Digivolved" },
    es: { "lanzar la Poké Ball": "usar el Digivice", Pokédex: "DigiDex", "Poké Ball": "Digivice", Pokémon: "Digimon", Kanto: "Isla File", Evolucionó: "Digievolucionó" },
  },
};

/** 0xRRGGBB → [r, g, b]. */
export const packRgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
