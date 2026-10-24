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

// Scripted upgrades (src/game/scripted.js): rules.json carries the upstream Spanish text; these
// describe what THIS engine does. An item without an entry falls back to the data description.
export const ITEM_DESC_PT = {
  "grip-claw": "Cada acerto tem 4% de chance de enraizar o inimigo por 2 s.",
  "berry-juice": "Cada abate tem 5% de chance de curar 2% do HP máximo.",
  "shell-bell": "Recupera 0,8% do dano que você causa.",
  metronome: "+2% de dano por segundo sem levar golpe (até +40%).",
  "binding-band": "+20% de dano em inimigos paralisados, enraizados, congelados, dormindo ou recuando.",
  awakening: "Cada acerto tem 2,5% de chance de adormecer o inimigo por 3 s.",
  lemonade: "Seus aliados causam 25% mais dano e atacam 15% mais rápido.",
  "poke-doll": "As passivas dos seus aliados valem 50% mais.",
  stick: "3% de chance de um acerto causar ×8 de dano: Bonk!",
  "razor-fang": "Elimina na hora inimigos comuns abaixo de 8% de HP (+4% por cópia). Alfas e bosses não.",
  "focus-band": "15% de chance de sobreviver a um golpe letal com 1 HP (uma vez a cada 20 s).",
  "full-heal": "+6% de dano por status diferente no inimigo (até +30%).",
  "guard-spec": "A cada 14 s, bloqueia o próximo golpe por completo.",
  "gold-teeth": "A loja cobra 8% menos (até −24%).",
  "focus-sash": "Sobrevive a um golpe letal uma vez por zona.",
  revive: "Revive uma vez com 35% do HP.",
  "reaper-cloth": "+1% de dano a cada 100 abates na partida (até +30%).",
  "thick-club": "Dano físico +1% a cada 2 de armadura (até +50%).",
  "fire-stone": "Inimigos queimados explodem ao morrer (40% do HP deles, em 3 u).",
  "leaf-stone": "Cada abate tem 10% de chance de soltar um redemoinho de folhas que corta os inimigos próximos e cura 1% do HP.",
  "ss-ticket": "+1 vaga para aliados nesta partida.",
  "max-revive": "Revive uma vez com 60% do HP.",
  "soda-pop": "O dash solta uma onda de bolhas que fere os inimigos em volta.",
  "adrenaline-orb": "Ao levar um golpe: +20% de velocidade e +12% de velocidade de ataque por 3 s.",
  "metal-powder": "Parado por meio segundo: +30% de armadura e +8% de velocidade de ataque até se mover.",
  "ice-heal": "Acertar um inimigo congelado quebra o gelo: +60% de dano e estilhaços que paralisam os vizinhos.",
  "old-rod": "A cada 9 s um Magikarp salta sobre um inimigo. Às vezes vem um Gyarados…",
  eviolite: "Enquanto ainda puder evoluir: +50% de armadura e +25% de HP máximo.",
  "shed-shell": "Dash com invulnerabilidade mais longa e recarga 10% mais rápida.",
  "cell-battery": "+1,5% de velocidade de ataque a cada 10 abates sem levar golpe (até +25%).",
  "griseous-orb": "Cada abate tem 12% de chance de soltar uma sombra que explode e amaldiçoa os vizinhos.",
  electirizer: "A cada 2,5 s um raio cai em 3 inimigos próximos e pode paralisá-los (+1 raio por cópia).",
  "silph-scope": "A cada 6 s marca o inimigo mais forte por perto (+1 por cópia): ele leva 40% mais dano de tudo. Se cair, marca outro.",
  "max-ether": "Suas vitaminas podem subir mais 2 níveis (até o 12).",
  "tm-case": "Seus golpes podem subir mais 2 níveis (até o 10).",
  "poke-flute": "O ultimate carrega 25% mais rápido; ao usá-lo, todos os golpes recarregam e a velocidade de ataque sobe 30% por 6 s.",
};
export const itemDesc = (key, def) => ITEM_DESC_PT[key] ?? def?.desc ?? "";
