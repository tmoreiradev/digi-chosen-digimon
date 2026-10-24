// pt-BR labels for the data-driven strings (the extracted tables carry Spanish archetype labels
// and English biome, vitamin and tower names) and for shared UI words. Species, moves, items,
// roles and ultimate names stay as the data has them (they are proper names).

export const TYPE_PT = {
  normal: "Normal",
  fighting: "Lutador",
  flying: "Voador",
  poison: "Veneno",
  ground: "Terra",
  rock: "Pedra",
  bug: "Inseto",
  ghost: "Fantasma",
  steel: "Aço",
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  psychic: "Psíquico",
  ice: "Gelo",
  dragon: "Dragão",
  dark: "Sombrio",
  fairy: "Fada",
};
export const typeName = (t) => TYPE_PT[t] ?? t;

export const ARCH_PT = {
  bolt: "Projétil",
  orb: "Esfera explosiva",
  lob: "Bomba",
  barrage: "Rajada",
  homing: "Teleguiado",
  beam: "Raio",
  cone: "Cone",
  nova: "Onda expansiva",
  aura: "Aura",
  orbit: "Órbita",
  strike: "Golpe",
  dash: "Investida",
  chain: "Cadeia",
  smite: "Impacto celeste",
  meteor: "Meteoro",
  boomerang: "Bumerangue",
  trap: "Armadilha",
  vortex: "Vórtice",
  wave: "Onda",
  trail: "Rastro",
  drain: "Dreno",
  spin: "Giro",
  weather: "Clima",
  buff: "Fortalecimento",
  random: "Aleatório",
  fusion: "Fusão",
};
export const archLabel = (arch, rules) => ARCH_PT[arch] ?? rules?.archetypes?.[arch]?.label ?? arch;

export const BIOME_PT = {
  forest: { name: "Floresta Verde", desc: "Uma floresta frondosa cheia de vida — e de Pokémon que preferem ficar com ela só para si." },
  desert: { name: "Deserto Rochoso", desc: "Areia escaldante, cânions de pedra e tempestades que cegam." },
  coast: { name: "Costa das Tempestades", desc: "Praias, recifes e tempestades elétricas sobre o mar. Cuidado com a maré." },
  glacier: { name: "Geleira Celestial", desc: "Gelo eterno sob auroras. Os lagos congelados escorregam e o frio morde até os seus ataques." },
  graveyard: { name: "Torre Lavanda", desc: "Névoa, lápides e sussurros. Os fantasmas daqui nunca descansam." },
  volcano: { name: "Ilha do Vulcão", desc: "Rios de lava e cinzas. Só os mais fortes sobrevivem ao calor." },
};
export const biomeName = (b) => BIOME_PT[b?.id]?.name ?? b?.name ?? "";
export const biomeDesc = (b) => BIOME_PT[b?.id]?.desc ?? b?.desc ?? "";

export const MODE_PT = { classic: "Clássico", endless: "Infinito", tower: "Torre" };

export const RARITY_PT = ["Comum", "Incomum", "Raro", "Épico", "Lendário"];
export const RANK_PT = { common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Épico", legendary: "Lendário" };
export const rankName = (rank) => RANK_PT[rank] ?? rank;

export const VITAMIN_DESC_PT = {
  protein: "Dano físico",
  calcium: "Dano especial",
  iron: "Armadura",
  zinc: "Escudo regenerativo",
  carbos: "Velocidade de movimento",
  "hp-up": "HP máximo",
  "pp-up": "Projéteis",
  ether: "Velocidade de ataque",
  "dire-hit": "Chance de crítico",
  "x-speed": "Velocidade dos projéteis",
  "x-defense": "Evasão",
  "x-attack": "Chance de status",
  stardust: "Área de efeito",
  elixir: "Duração",
  "super-potion": "Regeneração de HP",
  nugget: "Moedas",
  "exp-candy": "Experiência",
  "star-piece": "Sorte",
  "max-potion": "Roubo de vida",
  "escape-rope": "Alcance de coleta",
  "sticky-barb": "Espinhos",
  "enigma-berry": "Sobrecura",
  "super-lure": "Aparição de elites",
  "poke-radar": "Power-ups",
  "loaded-dice": "Um atributo aleatório",
};
export const vitaminDesc = (def) => VITAMIN_DESC_PT[def.key] ?? def.desc;

export const TOWER_FLOOR_PT = {
  Vestibule: "Vestíbulo",
  "Hall of Headstones": "Salão das Lápides",
  "Mist Room": "Sala da Névoa",
  "Candles Out": "Velas Apagadas",
  "Purified Zone": "Zona Purificada",
  "Marowak's Shadow": "Sombra de Marowak",
  "The Summit": "O Cume",
};
export const towerFloorName = (name) => TOWER_FLOOR_PT[name] ?? name;

export const THREAT_PT = ["CALMO", "INQUIETO", "ALERTA", "PERIGO", "CERCADO"];

// Held items: items.json carries the games' flavour text; these describe what THIS engine does
// (run.js: Leftovers regen, Choice Band damage multiplier).
export const HELD_ITEM_DESC_PT = {
  leftovers: "Recupera cerca de 1/16 do HP máximo por segundo.",
  "choice-band": "+50% de dano em todos os golpes.",
};
export const heldItemDesc = (key, def) => HELD_ITEM_DESC_PT[key] ?? def?.desc ?? "";
