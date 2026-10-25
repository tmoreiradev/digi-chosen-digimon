# Mapeamento de mecânicas do PokéBonk (sessão de jogo de 25/10/2026)

Notas de jogo em pokebonk.com com a conta do dono (login feito por ele). Complementa
`docs/VISUAL_POKEBONK.md` (visual e render). Cada item diz como foi observado.

## Fim de partida (tela "Você foi derrotado!")

Observado após a run 1 (Charmander, Floresta Verde, Zona 1, Normal, morreu em 1:31).

- Cabeçalho: região · zona · dificuldade, retrato com nível, e quatro números: tempo, abates, dano, pontos.
- **Classificação:** abates nesta partida e diferença para a melhor marca; posição na temporada e no
  histórico; quantos abates faltam para superar o próximo jogador do ranking; quanto falta para o top 50
  (insígnia da temporada) e quando a temporada termina; ranking por Pokémon ("Com Charmander: #246k …
  soma da sua melhor partida com ele em cada região"; falta X para o top 3 = moldura Especialista).
- **Sua partida:** Stardust ganho; reações, evoluções, melhor sequência (×42), golpes sofridos;
  **dano por ataque** com nível do golpe, dano total e % (Ember 64 %, Fire Spin 22 %, Flamethrower 11 %,
  "Passiva, itens e estados" 2 %); linha "Sem capturas, Alfas nem tarefas nesta partida".
- **Pokédex:** abates por espécie (com selo NOVO) e **Pesquisa** por espécie com barra (Ditto 33/66,
  Zubat 25/61): os abates de cada espécie enchem uma meta de pesquisa.
- Botões: Menu (Esc) e De novo (Enter).

## Run 2 (Charmander, Floresta Verde, Normal — 3:25, 313 abates, nível 12)

Jogada por um autoplayer na página (anda em círculo largo, escolhe carta de ataque novo ou melhoria,
aperta R e E); os textos vêm de um registro de toda linha nova que aparece na tela, com horário.

### Início da zona
- "Preparando a zona" com contador "Pokémon prontos: 5/12 → 12/12" (carrega o elenco da zona),
  depois "Hora de sobreviver!". O mapa é sorteado a cada partida (relevo, lagoas e props mudam).
- Dica no início: "As Poké Balls do mapa guardam itens: abra-as com E."

### Interagíveis vistos
- **Poké Bola:** "Abrir Poké Bola · 18 ₽" (aparece "(sem dinheiro)" quando falta ₽).
- **Poké Bola amaldiçoada:** "Abrir Poké Bola amaldiçoada (grátis... tem certeza?)".
- **Poké Bola grátis:** "O primeiro elite da zona solta uma Poké Bola grátis!".
- **Item achado** pausa o jogo: "Você encontrou um item!", carta com raridade, efeito, descrição em
  inglês, "Acumula até 10.", botões Pegar (E) e Vender (+10 ₽) (V). Ex.: Scope Lens +6 % crítico.
- **Altar de Porygon:** "troque um atributo por outro".
- **Cogumelo saltitante:** cogumelo gigante que lança o jogador; ao pisar, dica "Aperte Shift no ar
  para mergulhar: quanto mais alto, mais dano".
- **TM no chão (power-up):** "TM Dança das Espadas! +50% de dano" (temporário).

### Encontros
- **Inicial selvagem (desafio da Liga):** "Bulbasaur selvagem apareceu!" + "Desafio concluído:
  enfraqueça-o e capture-o para uni-lo à sua Liga". Seta na borda da tela com retrato e distância em
  metros. Ao zerar: "Bulbasaur foi derrotado!" → "Aproxime-se e aperte E para lançar a Poké Bola";
  se demorar, "Bulbasaur se recuperou e está fugindo!".
- **Alfa:** "Pokémon Alfa! Um Ditto gigante e furioso apareceu" — "É enorme e duro, mas vale a pena:
  ao enfraquecê-lo, você poderá lançar uma Friend Ball para que lute com você, ou ele soltará um prêmio."
- **Evento Eclipse (40 s, com contador no HUD):** "A luz se apaga. Saem os Pokémon da noite... e algum
  shiny". O mapa escurece.

### Sequência (combo de abates) — recompensas por marco
| Marco | Recompensa |
|---|---|
| ×10 | +3 ₽ |
| ×25 | +4 ₽ · ímã de doces |
| ×50 | +5 ₽ · ímã de doces · +15 % de HP |
| ×100 | +7 ₽ · ímã de doces · +15 % de HP |
| ×150 | +9 ₽ · ímã de doces · +15 % de HP |

### Cartas vistas (nível 2–12)
- Ataques novos: Flamethrower (Especial · Cone, 1,9 s, queimado), Dragon Breath (Especial · Cone,
  1,8 s, paralisado), Fire Spin (Especial · Vórtice, 3,1 s, enraizado). Máximo nível 8 por ataque.
- Melhorias de ataque sorteiam 2 bônus por nível entre: +dano 22 %, +1 projétil, +1 perfuração,
  +1 ricochete, +15 % área, +20–24 % duração, −8 % recarga, +5 % crítico, +15 % velocidade,
  +25–30 % chance de status. A carta mostra "Dano por golpe 21.4 → 24".
- Vitaminas/itens (com valor antes → depois): Carbos +8,4 % velocidade; Protein +12 % físico
  (avisa "Nenhum dos seus ataques usa isso"); X Attack +15 % chance de status; Fruta Enigma +5 %
  sobrecura; Elixir +10 % duração ("Afeta: Fire Spin · Flamethrower"); Farpa Grudenta +10 espinhos
  ("acertam todos ao seu redor, envenenam e também ativam quando você esquiva"); Zinc +12 escudo
  regenerável; X Speed +17,4 % vel. de projétil ("Afeta: Ember"); Ferro +5 armadura; Direct Hit
  +5 % crítico; Ether +8 % vel. de ataque; Max Potion +2,4 % roubo de vida; Nugget +15 % ₽;
  Escape Rope +1,2 alcance de coleta; Star Piece +10 sorte; Stardust +10 % área; Poké Radar +15 %
  power-ups ("Caem mais power-ups (Ímã, TMs, frutas…) e duram mais."); Exp. Candy +12 % XP;
  X Defense +4,2 % evasão; Super Isca +18 % surgimento de elites ("E +5% de dano a elites e chefes
  por nível").
- Raridades vistas: Comum, Incomum, Raro. Atualizar (2), Pular (2), Banir (1) por partida.

### Fim da run 2
- "NOVO RECORDE NESTE MAPA! +239 vs. sua melhor marca"; dano por ataque inclui **Ultimate**
  (30 % do dano total). "TAREFAS CONCLUÍDAS · RESGATE-AS EM TAREFAS" (ex.: tarefa do dia "Fogo
  cruzado"). "PESQUISA CONCLUÍDA · JÁ PODE USÁ-LOS COMO AVATAR" (Ditto 66/66 → avatar).
- Durante a run: aviso "Novo recorde da temporada! Floresta Verde · 84 abates" e cartão
  "ENTRAR NO TOP 50" com o rival seguinte.
- Dica no reinício: "Aperte R quando a Ultimate estiver carregada: ela carrega lutando."

### Desempenho observado
- Com muitos inimigos a tela vira uma nuvem de números de dano enormes (sprites 3D perto da câmera)
  e o jogo deles engasga.

## Run 3 (Charmander, Floresta Verde, Normal — ~4:40, nível 18, sequência ×511)

### Novidades
- **Ameaça:** o indicador passa de TRANQUILO para **MODERADO** por volta dos 3 min.
- **Alfa derrotado:** "Pidgeotto Alfa foi derrotado!" + "Apoio: +10 % de Pokédólares · Aperte E perto:
  Friend Ball para que lute com você nesta partida (não entra na sua Liga) · se não, solta o prêmio";
  botão "Soltar". Cada Alfa tem um bônus de apoio próprio.
- **Inicial selvagem que escapa:** "Squirtle foi embora... Voltará a aparecer em outra partida".
- **Poké Bola amaldiçoada:** "Era uma armadilha! Os fantasmas saem da Poké Bola" — mas o item que
  saiu foi **Épico** (Dusk Stone: +40 % dano crítico e +8 % crítico; vende por 50 ₽). Risco por
  recompensa melhor.
- **Debandada!** "Uma manada de Rattata! Saia do caminho" — evento de manada que atravessa o mapa.
- **Power-ups no chão:** "TM Onda de Trovão! Paralisa todos os Pokémon ao redor"; "Rare Candy! Você
  sobe de nível"; "Coletar Oran Berries" (arbusto de frutas).
- **Itens seguráveis (Pegar/Vender):** Twisted Spoon (+30 % Psíquico e +3 % dano total), Dusk Stone,
  Scope Lens. Vender: 10 ₽ (comum), 50 ₽ (épico).
- **Cartas novas:** Dado Viciado ("Role o dado: o atributo de uma vitamina aleatória, ×1,50 … cada
  nível rola o dado"); PP Up (+0,5 projéteis: "cada +1 inteiro é um projétil a mais"); Calcium
  (+14,5 % dano especial); HP Up (+18 HP máx.).
- **Sequência continua escalando:** ×200 +11 ₽, ×300 +15 ₽, ×400 +19 ₽, ×500 +23 ₽ (sempre com ímã e
  +15 % de HP).
- **Recordes de outros jogadores** aparecem durante a run: "anxxd — Floresta Verde · 314 abates".

## Do código público deles (bundle `main-*.js`, lido no navegador)

O bundle de produção não é ofuscado (nomes de campos e comentários de shader legíveis). Abaixo,
regras e números — descritos, não copiados.

### Diretor de spawn (modo Clássico, por zona de ~10 min)
- **Linha do tempo da zona** (segundos de zona; na zona 1 alguns itens vêm mais tarde):
  - nova **carta de espécie** a cada ~60 s (×0,8–1,2) de 1 a 9,6 min — o elenco cresce ao longo da zona;
  - **Alfa** em 150, 330 e 480 s (+240 s com o reforço "honey");
  - **manada ou enxame** em 235 s (zona 1; 200 s nas outras), **enxame** em 390 s, **manada** em 520 s;
  - **onda de elites** em 330 s (zona 1; 270 nas outras) e 450 s;
  - **totem** em 290 s (zona 1; 255) e 420 s; **invocador** em 360 s;
  - **evento de mundo**: um entre 170–300 s na zona 1; dois nas outras (130–230 s e 340–460 s);
  - Difícil/Pesadelo antecipam tudo (menos cartas e eventos); Pesadelo ganha um totem extra em 510 s.
- **Sobrevivência (infinito):** batidas periódicas — carta a cada 48–72 s; Alfa a cada 150 s; horda
  (enxame, manada, **rio**, **chuva de pedras**, em rodízio) a cada 140–160 s; totem 200–220 s; onda de
  elites 180 s; invocador 340–380 s; evento 220–260 s. No máximo 12 cartas: a de menor peso sai.
- **Elenco da zona:** espécies não lendárias com algum tipo do bioma; zona 1 só formas básicas, zona 2
  até 1.ª evolução, zona 3 evoluídas + espécies sem evolução fortes (BST ≥ 420). Há um elenco de
  "residentes" da região (uma em cada três cartas) e um elenco "tardio" (40 % de chance depois de 4 min).
- **Créditos:** cada carta custa `1 + BST/220`; a carta nova entra com peso 1,4 e as antigas perdem 15 %
  a cada carta — a espécie recém-chegada domina por um tempo.
- **Teto de inimigos vivos:** `(10 + 0,65·s + 4,5·(s/60)²) × (1 + 0,6·(zona−1))`, com `s` em segundos de
  zona; teto absoluto 1400; teto "ao vivo" ajustado ao FPS (500/650/800, passos de 50, alvo 45–55 fps).
  Até 1800 spawns/s permitidos; quando cheio, o crédito fica represado.
- **Ponto de spawn:** anel de 24–36 u ao redor do jogador, nunca a menos de 14 u (borda do mapa).
- **Elites:** chance `1,2 % + 0,4 %/min + 3 % por zona` (+ dificuldade, eventos, Super Isca); nenhum
  elite nos primeiros 90 s da zona 1.
- **Curvas por minuto de zona `t`:**
  - HP: `(1 + 0,3·t + r·max(0, t−1,5)²) × base`, base por zona 1 / 5,5 / 13 / 20 e `r` 0,15 / 0,07 /
    0,05 / 0,05; chefes recebem 80 / 55 / 50 / 50 % disso.
  - Dano: `(1 + 0,13·t) × fator da zona`.
  - Velocidade: `min(1,3, 1 + 0,02·t + 0,06·(zona−1))`.
  - "Dureza" (multiplicador extra do começo): `1,35 + 1,05 × max(0, 1 − s/480)`.
- **Ameaça** (o selo TRANQUILO…): `0,5 × log2(HP × dano × quantidade × velocidade²)`, com limiares
  0 / 1 / 2 / 3 / 4 / 5,5 / 7 → Tranquilo, Moderado, Perigoso, Muito perigoso, Brutal, Letal, Impossível
  (verde → roxo).
- **Enxame final** (fim de zona sem ter derrotado o chefe): créditos ×6, HP ×4 e dano ×2 **por minuto**
  (exponencial), e rajadas de 6 elites.

### Tipos de inimigo (flags)
comum, **elite**, **enxame** (swarm), **manada** (stampede), **Alfa**, **totem**, **invocador**
(summoner), **chefe** e **lendário** (chefe com kit próprio).

### Eventos de mundo (com céu, névoa e luz próprios)
| Evento | Duração | Texto |
|---|---|---|
| Névoa espectral | 45 s | "Uma névoa gelada cobre tudo... e algo se move nela" (inimigos voadores, XP ×2) |
| Tempestade elétrica | 40 s | "Caem raios: afaste-se das marcas amarelas" |
| Eclipse | 40 s | "A luz se apaga. Saem os Pokémon da noite... e algum shiny" (1.º spawn vira elite após 90 s) |
| Meowth dourado | 25 s | "Solta moedas a cada golpe. Pegue-o antes que escape!" |

Cada evento troca a paleta do céu (topo/base), a névoa (cor, perto/longe), a luz, as nuvens, a vinheta
e um tom de cor geral; spawna `3 + zona` Pokémon do evento a 20–27 u. Clima de zona à parte: **jato
d'água** (spout) e **nevasca** (blizzard).

### Estado da partida (lista de campos) — indica sistemas
ouro, **chaves**, **ganância** (greed), **maldições** (Poké Bolas amaldiçoadas abertas), baús comprados,
compras e renovações da loja, **caça-níqueis** (giros, gasto, prêmios), modificadores temporários,
**santuários** (fóssil, rugidos, Porygon), **fusões** (Máquina do Bill), banidos/renovações/pulos,
níveis pendentes, chefe surgido, zona limpa, **Mewtwo enfrentado**, **Master Ball**, santuário do
lendário, ovo, bomba, segurar evolução, clima, `timeScale` e **hitstop**, sequência, tempos parciais
(contra o relógio).

### Câmera e render
- Câmera em perspectiva atrás do jogador: inclinação 0,45 rad (~26°), distância 9 u, guinada
  (`camYaw`) girável; **trauma** para tremor; **hitstop** e `timeScale`; câmera **cinemática** nas
  capturas (distância 7,5, inclinação 0,22, órbita lenta, áudio abaixado).
- Pós-processamento: **tinta de cor** por evento, **vinheta**, **aberração cromática** que dá um
  "chute" no impacto e decai (`exp(−8t)`), resolução dinâmica (0,5–1,5× conforme FPS e GPU), modo
  pixelado opcional (`image-rendering: pixelated`), detecção de GPU por software (swiftshader) para
  baixar qualidade.
- **Céu** é uma cúpula com shader pixelado (`uPx = 4`): gradiente, sol em disco pixelado com anel e
  duas faixas de brilho, nuvens com cobertura, estrelas e lua; no eclipse, disco preto com coroa
  vermelho-alaranjada sempre à vista da câmera.
- Luz: sol direcional + hemisférica; névoa com perto/longe por bioma/evento.
- Jogador: sombra no chão, anel no chão sob o jogador, poeira ao correr, piscar com invencibilidade,
  achatamento (squash) no ataque e no deslize, partículas de brilho quando shiny, rastro espectral.
- Efeitos (vfx): partículas com formas (suave, faísca, chama pixelada, chamas, rachadura, wisp,
  brilho), anéis no chão, decalques em "pool" no chão, "glow", clarão, poeira.
- Terreno com altura (`terrain.height`), superfície (`terrain.surface`), água (`inWater`, nado e
  vadear), limites jogáveis.

### Interagíveis do mapa (tecla E) — do código
| Tipo | O que faz |
|---|---|
| Poké Bola (`chest`) | custa ₽ (base × fator que cresce a cada compra; −8 % por Big Nugget até −40 %; sorte reduz até −25 %); sorteia item |
| Poké Bola grátis | presente (ex.: 1.º elite da zona) |
| Poké Bola amaldiçoada | grátis; 40 % (× sorte, até 80 %) de vir 2 itens; +5 % dificuldade; emboscada de fantasmas |
| Estátua amaldiçoada (Gengar) | +15 % inimigos, +10 % dificuldade, sorteia item raro |
| Desafio da ganância (Gengar) | +20 % dificuldade, +25 % XP e ₽ |
| Meowth | abre a loja |
| Ditto | copia um item que você já tem |
| Hypno | esquecer um golpe |
| Fóssil, Rhydon, ninho, Porygon | santuários (Porygon troca um atributo por outro) |
| Máquina do Bill | fusão de golpes nível 8 |
| Caça-níqueis | gasta ₽, sorteia prêmios |
| Snorlax | 50 % (× sorte, até 85 %) de bênção; senão ₽ (≥ 30 × zona) |
| Magnemite | ímã: puxa toda a XP do mapa por 5 s |
| Arbusto de frutas Oran | cura 50 % do HP |
| **Altar do guardião** (`boss`) / santuário | **chama o chefe da zona quando o jogador quiser** (bloqueado se Mewtwo está ativo) |
| Portal | leva à próxima zona (no infinito, migra de mapa) |
| Jaula | 20 + 10 × zona ₽: liberta um Pokémon (+25 de pesquisa da espécie, +50 % de um nível) |
| Pedra | quebra e dá ₽ |
| Desafio (`challenge`) | desafio de captura (ex.: inicial selvagem) |
| Torre | interações do modo Torre |

**Fluxo da zona:** o relógio de 10 min não chama o chefe; o jogador vai até o altar e o ativa quando
se sentir pronto. Ao vencer, surge o portal. Se o tempo zera antes, começa o **enxame final**
(exponencial). Zona 3 com santuário → lendário do santuário; sem santuário → lendário da região
(com chance de shiny). O chefe de cada zona sai da lista de guardiões do bioma (por semente).

### Modo Sobrevivência (do código)
- Marcos periódicos chamam guardião (HP 60 %, o 1.º mais fraco), lendário (HP 260 % com kit) ou
  **Mewtwo**. Depois de cada marco vencido, o jogo oferece um **pacto** (maldição em troca de prêmio).
- "NOITE SEM FIM": a partir de certo ponto, a cada minuto os selvagens ficam mais fortes; rajadas de
  elites; aviso de que "agora você se cura um pouco menos a cada minuto".

## Runs 4–7 — mapa da zona, guardião e mais interagíveis

### Mapa da zona (tecla M)
- Painel "Mapa da zona — Para cima é o norte": mapa quadrado com relevo sombreado (paredões em marrom,
  lagoas em azul), borda tracejada da área jogável, ícones redondos por tipo de interagível, a seta do
  jogador, zoom (+ / − / 1:1) e arrastar. Abrir o mapa pausa o jogo.
- Legenda "DESCOBERTO NESTA ZONA" com contagem por tipo. Exemplos de zonas reais:
  - Altar do guardião ×1, Altar Unown (bênção) ×1, Altar de Gengar (mais difícil, mais espólio) ×1,
    Altar de desafio ×1, Ruínas do Fóssil (poder em troca de HP máx.) ×1, **Rugido de Rhydon (guardião
    mais forte, mais Great Balls)** ×1, Altar de Porygon ×1, **Ninho com um Ovo Pokémon (choca
    lutando)** ×1, Meowth (loja) ×1, **Caça-níqueis (aposte por itens)** ×1, Snorlax (bênção ou ₽) ×1,
    Ímã ×1, Poké Ball grátis ×1–2, Poké Ball amaldiçoada (emboscada) ×1–2, Jaula ×1, Berries ×2,
    Poké Ball (item, paga) ×3–8, Rocha de ouro ×4–5, Cogumelo saltitante ×2.
- "Você só vê o que já esteve por perto, menos o altar do guardião, o santuário e o portal" (névoa de
  guerra no mapa).
- "Toque no mapa para pôr uma marca (até 3) ou toque num ícone para o seguir": o ícone seguido vira uma
  **bússola na borda da tela** com ícone e distância em metros.
- O mapa é sorteado a cada partida: o altar do guardião caiu a 113–258 m do início.

### Guardião da zona 1 (Floresta Verde)
- No altar aparece o prompt "Acordar o guardião". Ao acordar: barra de chefe no topo com retrato,
  nome (**Raichu**), selo "GUARDIÃO", HP numérico (≈ 4000 aos 1:20 de zona) e o **nome do ataque em
  curso** com ícone do tipo ("ONDA DE CHOQUE!", "RAIO!"). Texto "GUARDIÃO DA ZONA".
- Arena marcada por um **anel vermelho no chão** com chamas na borda.
- "Raio!" desenha raios amarelos pixelados em zigue-zague pelo chão.
- Chamado cedo, o guardião é mais fraco (HP escala com o tempo de zona), mas o personagem também.
- Platôs exigem achar rampas ou pular (pulo duplo alcança a borda).

### Outros textos vistos
- Jaula: "Libertar Bulbasaur · 30 ₽". Snorlax: "Acordar o Snorlax". "Abrir Great Ball (grátis)".
- Poké Bola paga sobe de preço a cada compra (18 → 43 ₽).
- Baú com escolha: "Você encontrou itens! Escolha um" (3 itens, ou "Nenhum (+13 ₽)"), cada um com
  "Você tem 0/10".
- Itens: Choice Band (+35 % físico, −8 % vel. de ataque; acumula até 5; vende por 30 ₽), Charcoal
  (+30 % Fogo, +3 % total), Oran Berry (+15 HP máx.), Quick Claw (+10 % vel. de ataque).
- Alfa capturado: "VAI, FRIEND BALL!" → "CAPTURADO!" → "ALFA DE APOIO! Primeape acompanha você nesta
  partida!" com o bônus (+10 % de dano em elites) e um cartão no HUD; a tela final tem a seção "Alfas
  de apoio" com abates e dano dele. Dica: "Primeape é da linha de Mankey. Para jogar com Mankey na
  Liga: complete o desafio dele na Liga e capture-o quando aparecer."
- Power-ups: "Explosão do Electrode! Você limpa a área".
- Eventos vistos jogando: Eclipse, Tempestade elétrica ("Caem raios: afaste-se das marcas amarelas"),
  Debandada de Rattata/Caterpie, **Enxame** ("Um enxame de Doduo te rodeia...").
- Carta Incenso Maldito: "+12 % mais inimigos e mais fortes, mas +6 % de XP e +6 % de ₽ por nível".
- Carta de ataque básico físico: Scratch (Normal, Físico · Golpe, "Um golpe em arco contra o inimigo
  mais próximo", 0,8 s).
- Erro de carga visível ao jogador: "Falta 1 gráfico para carregar — Tentar de novo".
- Fim de partida: "NOVIDADE NO SEU CADERNO DE PESQUISA!", "Assistente do laboratório", "Moldura Normal".

### Terreno (do código)
- **Heightmap** em grade (`res`+1 pontos por lado; a textura de altura da água é 241×241), altura
  bilinear, normal por diferença finita. Alturas em **degraus** (platôs em múltiplos de uma altura
  fixa) + "maciços" + ruído suave.
- **Rampas garantidas:** depois de gerar, um flood fill a partir do centro marca o que é alcançável
  andando (degrau ≤ 0,9); para cada platô isolado com ≥ 70 células procura o par de pontos mais
  barato e **escava uma rampa** (inclinação ~0,42 de altura por unidade, ≥ 6 u de comprimento, largura
  ~2,25 u com borda suave). Repete até 40 vezes. Nenhum platô fica inacessível.
- **Lagoas:** `6 × √área` (+0–1) com raio 6–11 u, só em degrau plano, longe do centro (≥ 26 u + r),
  dos maciços e umas das outras; nível um pouco abaixo do degrau. Viram "marcos" do mapa.
- **Mapa de jogo:** quadrado com limite `play`; inimigos nascem dentro dele; o mapa da zona mostra a
  borda tracejada.
- **Shader do chão:** grama "toon" pixelada na **mesma densidade de pixel dos sprites** (13,5 px por
  unidade — "Same Pokémon lawn … at the sprites' pixel density"); rocha dos paredões gerada pelo
  shader em pixel, com coordenada ao longo da parede (arco em volta do platô) para as rachaduras;
  **AO no pé de cada paredão**; sombra de contato suave abaixo das bordas; **borda grama/rocha
  pontilhada** pela inclinação; **grama pendurada** sobre a borda superior dos paredões; areia perto
  da água e chão mais escuro e azulado sob a superfície; zonas molhadas em volta de **cachoeiras**;
  névoa por distância; luz toon.
- **Água:** shader com profundidade (pela heightmap), fluxo, espuma na margem e reflexo do céu.
- **Grama/flores** como malhas instanciadas (tufos + florzinhas emissivas), além do atlas de props.
- O modo Torre usa um gerador próprio: arena circular com platôs com rampa, estrado central,
  escadaria e bandeiras.

**Lição para o nosso render:** a coesão visual deles vem de três regras simples — (1) chão, paredões
e sprites na **mesma densidade de pixel**; (2) relevo em **degraus** com paredão de pixel-art, AO no pé
e grama pendurada na borda; (3) névoa e luz por bioma/evento. Tudo isso tem equivalente 2,5D.

### Chefes (do código)
- **HP do chefe** = curva de HP da zona × 80/55/50 % (zona 1/2/3) × 1,6 se lendário × (1 + bônus por
  **Rugido de Rhydon** aceito). Depois o jogo **sobe o HP até o "orçamento" de DPS do jogador × tempo
  de luta alvo** (no máximo 4× o valor da curva) — o mesmo princípio do nosso `playerExpectedDps`.
- **Teto de dano por segundo** (como o nosso teto em `hitEnemy`): guardião não morre em menos de
  25 / 30 / 35 s (zona 1/2/3), totem 10–14 s, invocador 6–8 s; banco de 3 s de dano.
- **Exaustão:** passado 2× o tempo alvo, o chefe recebe dano crescente (×2 a cada 20 s) — popup
  "Esgotado!" e aviso "{nome} está esgotado: recebe cada vez mais dano". Impede luta infinita.
- **Fúria** abaixo de 50 % do HP (limiar depende da dificuldade).
- **Repertório** sorteado de: pancadas, anel, **investida** (velocidade 30, dano ×1,5 e empurrão),
  **rajada** de projéteis, **onda de choque** (anel que cresce 13 u/s pelo chão — pular por cima dá
  "Esquivado!"); lendários somam **redemoinho** (espiral de tiros), **chuva do céu** (meteoros) e
  **terreno hostil** (poças que tiram 4 % do HP máx. a cada 0,5 s). Algumas espécies têm mecânica
  própria; os lendários têm "kit" próprio (alguns flutuam).
- O nome do golpe em curso aparece na barra do chefe. Golpe forte do chefe aplica **Ferido** ("Ferido!
  Cura pela metade"). Dica do jogo: "Deslize (Shift) para desviar dos ataques fortes dos chefes."
- Dica no início: "Cada zona termina com o seu guardião: derrote-o para abrir o portal."
- **Altar de desafio:** "invoca uma onda; se você a derrotar, Great Ball".
- **Altar Unown dourado** desperta (variação rara do altar de bênção).

## Pausa, câmera e Sobrevivência

### Tela de pausa (Esc/P)
- Coluna do personagem: retrato, região/zona/dificuldade, HP e EXP em barra, tempo, abates, dano,
  **dano/s**, dinheiro, melhor sequência. Botões: Continuar, Mapa grande, Mapa, Configurações,
  Relatar, **Desistir** (pede segundo clique: "Desistir? Aperte de novo") e Reiniciar.
- Abas: **Ataques** (habilidade passiva; cada golpe com tipo · classe · forma, dano, recarga, alcance,
  chance de estado, descrição, dano total e %, **dano/s nos últimos 15 s**; "Outras fontes de dano";
  botões "A conseguir" e "Fusões"), **Itens** e **Estatísticas** (Ataque / Defesa / Utilidade, com
  armadura mostrando a redução "8 (−15 %)") + Glossário.

### Câmera e controles (do código)
- Mouse com captura do ponteiro gira a câmera (guinada livre, inclinação −0,25 a 1,25 rad, sensibilidade
  e eixo Y invertido nas configurações); roda do mouse aproxima/afasta (4,5 a 26 u, salvo no perfil);
  a câmera volta sozinha para trás do jogador quando o mouse para.
- Tab segurado mostra o mapa por cima; M abre o mapa grande.
- Passo da simulação limitado a 1/20 s; **hitstop** desacelera tudo para 8 %; estados `evolving`,
  `cinematic` e `capturing` congelam a simulação. Vigias destravam o jogo se um modal ou cinemática
  sumir sem fechar.

### Sobrevivência (jogada: 4:02, nível 15, 494 abates)
- Equipe de até 4 Pokémon da Liga na seleção ("Adicionar à Equipe").
- Tela de setup lista os **marcos**: "um chefe a cada 5 minutos · Noite sem fim a partir do minuto
  45": 5 Guardião, 10 Guardião, **15 Mew**, 20, 25 Guardião, **30 Moltres** (lendário da região), 35,
  40 Guardião, **45 Mewtwo**.
- "Como se joga": um só mapa, sem zonas nem portais; a cada marco vencido escolhe-se um **pacto**;
  "Do céu caem Poké Bolas e itens, e o Meowth passa com sua loja"; classifica por tempo sobrevivido
  (abates desempatam) e soma para o clã.
- HUD: "MARCO 1 · GUARDIÃO — Raichu em 4:57" (contagem regressiva) e "Fase 1/3".
- Eventos vistos: "Suprimento! Uma Poké Bola caiu do céu"; **Fragmento de cometa** ("Caiu um
  fragmento de cometa! Carregue-o antes que se apague", 10 s); **Meowth de visita** ("veio com sua
  loja! Ele vai embora em 45 s"); **Terreno hostil** ("Uma poça de lama deixa lento quem pisa nela";
  "Um espinheiro venenoso fere quem o atravessa"); Névoa espectral; enxame de Growlithe; reação
  "Poison Gas!".
- Ranking dessa tabela: o 50.º tem **360 min** somados (6 h) — o tempo soma por mapa.
- Resultado: "Você sobreviveu 4:02", "NOVO RECORDE NESTE MAPA!", marcos / lendários / pactos,
  dano por ataque, Alfas de apoio, pesquisas concluídas (viram avatar), **moldura** nova
  ("Moldura Bug").
- **Pactos** (do código; cada um até 2×, Lua e Espinhoso 1×):
  | Pacto | Ganho | Custo |
  |---|---|---|
  | da Horda | item Épico ou melhor | +25 % de selvagens |
  | de Ferro | item Lendário | selvagens +35 % HP |
  | da Fúria | +25 % de dano | selvagens +25 % de dano |
  | do Vento | +15 % velocidade e +1 pulo | selvagens 12 % mais rápidos |
  | de Elite | +30 % XP e +20 sorte | o dobro de elites |
  | da Lua | sobe 3 níveis na hora | Alfa a cada 90 s (era 150 s) |
  | Ganancioso | ₽ na hora e +30 % ₽ | Poké Bolas 50 % mais caras |
  | de Cristal | +40 % dano crítico e +10 % crítico | −20 % HP máx. |
  | Espinhoso | **+1 espaço de vitamina** | cura 30 % menor |

## Evento A Noite da Torre Lavender (jogado: 1.º andar)
- Tela do evento: Velas (moeda), melhor marca, título "Visitante da Torre", próximo prêmio (faltam 42
  velas); Jogar, Livro de Velas, Conquistas, Classificação, Prêmios.
- "Como se joga": subir a Torre andar por andar (7 andares) vencendo **3 ondas** por andar para abrir a
  escada ("A escada está selada: supere as ondas"); fantasmas não identificados quase não levam dano
  e o **pulso do Silph Scope** os revela; acender **velas** para enxergar no escuro; **lápides de
  Gengar** (travessura ou gostosura); uma **Oferenda** por andar; acalmar Marowak no 6.º e derrotar
  Gengar no topo; depois, "Andares do Além" infinitos onde cada maldição aceita dá mais velas.
- Ritmo do andar: "A ONDA 1/3 SE APROXIMA — Prepare-se" → "ONDA 1/3 · Restam 22" → "Onda superada!
  Respire..." ("RESPIRE · ONDA 2/3") → … → "ONDA 3/3 · GUARDIÃO".
- Guardião do 1.º andar: **Pokémon Totem** Haunter ("irradia uma aura poderosa e chama os seus");
  golpes anunciados na barra: SHADOW CLAW!, "PEÇA AJUDA!!" (invoca), SHADOW BALL!, RAGE!. Ao cair:
  "Pokémon Totem derrotado! A aura dele é sua: escolha uma bênção" (3 bênçãos com raridade).
- Visual: interior com piso de ladrilhos roxos rachados, pilares de pedra, altar com tapetes vermelhos,
  candelabros, teias, ossos, lápides (modelos `.glb`), névoa roxa, **raios de luz** (god rays) e
  vinheta avermelhada. Fantasmas não revelados aparecem como silhuetas brancas. A câmera se aproxima
  quando há parede atrás (colisão de câmera).
- Ultimate: faixa diagonal na tela com retrato e "ULTIMATE! Labareda Ascendente"; coluna de fogo e
  anel de chamas em pixel no chão.

## Outros sistemas (do código)
- **Bênçãos** (Unown, Snorlax, Totem): 12 atributos — +12 % dano, +10 % vel. de ataque, +20 HP,
  +8 % velocidade, +6 % crítico, +12 % área, +15 % XP, +0,8 regeneração, +8 armadura, +15 sorte,
  +20 % duração, +20 % chance de estado — multiplicados pelo fator da raridade sorteada.
- **Loja do Meowth:** 4 itens; preço por raridade 80 / 130 / 220 / 400 / 750 ₽ × escala da zona ×
  "calor" da loja (sobe ao comprar) × desconto.
- **Caça-níqueis:** custo `max(5, 40 × escala × 1,08^giros)`; prêmios: 7-7-7 1,8 % ("JACKPOT! Três
  objetos, um deles épico ou melhor"), Pikachu 5 % (item melhor), fruta 9 % (cura 25 % + item),
  Meowth 10 % (2,5× o custo em ₽), Voltorb 6 % (saem Voltorbs da máquina — um elite), Gengar 6 %
  (maldição: +5 % inimigos e dificuldade, limitado). Sorte multiplica os prêmios bons (até 2×).
  Rolos perdedores nunca mostram três iguais (e às vezes dois iguais, para "quase").
- **Ninho/Ovo:** pegar o ovo ("Eclode após N abates"); o ovo **orbita o jogador** e treme perto de
  chocar; ao chocar, flash, anel e fragmentos, e o filhote vira aliado (ou deixa um presente).
- **Fóssil:** reviver um fóssil dá poder em troca de HP máx. pelo resto da partida (uma vez).
  **Porygon:** um atributo sobe e outro desce (uma vez).
- Inimigos ficam numa **grade espacial** (células de 3 u num mundo de 420 u) para colisão e alvo.

## O que levar para o Digi Chosen (prioridade)

Cruza este mapeamento com o que já temos (BACKLOG 2b e `docs/VISUAL_POKEBONK.md`). Esforço: P até
meio dia, M 1–2 dias, G vários dias.

| # | Item | Por quê | Esforço |
|---|---|---|---|
| 1 | **Altar do guardião sob demanda + enxame final exponencial** no lugar do chefe por relógio | dá ao jogador a escolha de quando lutar e um fim de zona que pune a demora | M |
| 2 | **Diretor por linha do tempo** (cartas de espécie, Alfas 150/330/480 s, manada/enxame, onda de elites, totem, invocador, evento) e cartas com custo `1 + BST/220` e peso decrescente | ritmo de zona legível; hoje o nosso spawn é contínuo | M |
| 3 | **Mapa da zona (M)** com legenda por tipo, névoa de guerra, seguir ícone → bússola na borda da tela com distância | navegação; o nosso minimapa é quase vazio | M |
| 4 | **Teto de dano do chefe por tempo mínimo + exaustão** depois de 2× o tempo alvo | já temos o teto; falta a exaustão | P |
| 5 | **Repertório de chefe com nome do golpe na barra** (investida, onda de choque pulável, rajada, espiral, poças) e "Ferido" | luta legível e esquivável | M |
| 6 | **Recompensas de sequência** (×10, ×25, ×50… com ₽, ímã e +15 % HP) | reforço barato e visível | P |
| 7 | **Eventos de mundo com paleta própria** (Eclipse, Névoa, Tempestade, Meowth dourado) e **hordas** (manada atravessando, enxame cercando) | variedade com pouco código | M |
| 8 | **Interagíveis novos:** Poké Bola amaldiçoada (emboscada + item melhor), estátua de Gengar (maldição/ganância), caça-níqueis, jaula, Snorlax, ninho com ovo, fóssil, Porygon, cogumelo saltitante | já temos baú/loja/altar; estes reaproveitam `WorldEvents` | M–G |
| 9 | **Painel de item achado** (Pegar/Vender, "Você tem N/10") e baú com escolha de 3 | decisão em vez de item automático | P |
| 10 | **Pausa com dano/s por golpe** (últimos 15 s) e aba de estatísticas por grupo | diagnóstico para o jogador | P |
| 11 | **Pesquisa por espécie** (abates enchem uma meta; concluída vira avatar) e tela final com dano por ataque | meta de coleção que já conversa com a nossa Pokédex | M |
| 12 | **Pactos da Sobrevivência** (tabela acima) e marcos a cada 5 min com lendários | modo infinito com escolhas | M |
| 13 | Visual: ver `docs/VISUAL_POKEBONK.md`; acrescentar **mesma densidade de pixel** entre chão e sprites, relevo em degraus com **rampas garantidas** (flood fill + rampa), AO no pé do paredão e grama pendurada | maior salto visual | G |

## Limites desta sessão
- Jogado com autoplayer (círculo, cartas automáticas, seguir marcador): 9 runs de Clássico (todas
  mortas na zona 1, entre 0:16 e 4:41), 1 de Sobrevivência (4:02) e o 1.º andar da Torre. Não vi
  zona 2/3, santuário, lendário, evolução em partida nem os outros três biomas (bloqueados na conta).
- O jogo só roda com a janela do app visível: com o painel oculto ou a janela coberta cai para ~2 fps.
- Números "do código" foram lidos do bundle de produção deles nesta data e podem mudar.
- A conta ganhou Stardust, entradas de Pokédex/pesquisa e marcas de ranking por jogar; nada foi gasto,
  resgatado, comprado ou girado.
