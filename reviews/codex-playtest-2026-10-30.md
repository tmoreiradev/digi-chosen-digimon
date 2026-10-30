## Achados

- [P1] HUD da Torre — `m25` a `final` continuam exibindo “Ilha File · Zona 1”, embora o registro avance do andar 2 ao 4; faltam andar, onda e inimigos restantes → em `src/ui/hud.js`, mostrar permanentemente “Torre · Andar 4/7 · Onda 3/3”, nome do andar e progresso de limpeza, usando `Tower.floor`, `wave` e `waveCount`.

- [P2] Relógios — em `m15`, o destaque é “23:01”, mas a duração da run é 15:01; em `m17`, ele vira “01:01” enquanto a partida segue em 17:01 → inverter a hierarquia em `HUD.update`: duração da run grande; hora fictícia pequena, identificada como “Hora do mundo”. O código confirma que não é reinício do cronômetro.

- [P2] Captura prolonga lutas já vencidas — Centarumon fica enfraquecido em `t=1064`, recupera-se repetidamente e só sai em `t=1110`; Myotismon passa de 7.064 HP em `t=852` para 18.347 em `t=862` → em `Capture.update`/`breakFree`, limitar recuperações ou reduzir a cura sucessiva; mostrar duração da janela e distância necessária para usar o Digivice. O piloto fugir explica oportunidades perdidas, mas a recuperação de 25–30% do HP máximo é uma regra real.

- [P2] Sustentação apaga o desgaste — contra Myotismon da zona 3, o HP vai de 615/784 a 784/784 entre `t=1293–1298`; contra Ikkakumon, várias perdas também desaparecem em segundos → instrumentar cura por origem antes de ajustar. `Run.collect` cura 25% por pickup, elites garantem cura e `castUltimate` cura 15%; testar primeiro menor concentração de curas garantidas durante chefes, preservando recuperação entre encontros.

- [P2] Clássico tem longos intervalos de baixa pressão — início da zona 2 (`t=421–542`) mantém HP cheio e aproximadamente 4–13 inimigos; início da zona 3 (`t=901–1021`) repete o padrão, visível em `m15` e `m17` → testar objetivos opcionais e inimigos que disputem rotas de coleta no `director.js`, com contrajogo claro. Não aumentar simplesmente HP/dano: a fase 42 já documenta que isso não resolve o comportamento de fuga do bot.

- [P2] Progressão concentrada em rajadas — o jogador sobe do nível 33 ao 44 entre `t=877–891`, atravessando MetalGreymon rapidamente, e chega ao teto em `t=1092`, mais de cinco minutos antes da vitória → registrar níveis recebidos por XP, ímã e XP Chip; revisar os drops de `Run.killEnemy` e distribuir recompensas. O salto é compatível com coleta acumulada, não prova duplicação de XP.

- [P2] Teto de nível deixa recompensa sem destino — em `m21` e `m23`, a barra permanece em `XP 1426/1426`, com a run ainda ativa e sem novas escolhas → em `Run.addXp`/`collect`, converter excedente em recompensa modesta ou progresso secundário e trocar o texto para “Nível máximo”. Evitar continuar oferecendo visualmente uma progressão impossível.

- [P2] Torre desacelera na limpeza das ondas — os três primeiros andares terminam em `t=74`, `139` e `261`; o quarto já dura 129 segundos no quadro final e ainda tem 12 inimigos, sem chefe → investigar tempo gasto perseguindo sobreviventes, alcance e coleta de XP em `Tower.update`/`spawnWave`. Marcar os últimos inimigos e fazê-los convergir para a arena antes de reduzir HP globalmente; a rota do piloto pode explicar parte da demora.

- [P2] Chefes precisam de duração e identidade mais consistentes — Gomamon invocador dura cerca de 14 s, DarkTyrannomon totem 67 s, Myotismon da zona 2 cerca de 155 s e Devimon final cerca de 59 s; Myotismon ainda se repete nas zonas 2 e 3 → revisar `Boss.spawn`, orçamento de HP e composição dos encontros; dar ao totem uma função própria além de compartilhar ataques e tornar o confronto final distinto. Comparar também tempo efetivamente atacável, pois fuga e captura alteram essas durações.

- [P2] Indicador de ameaça contradiz a luta — `m23` mostra “CALMO” diante de Devimon, com o jogador em 586/784 HP → `HUD.update` calcula ameaça apenas por quantidade de inimigos; incorporar chefe ativo, perigos próximos e projéteis, ou renomear o indicador para “Densidade” para não sugerir segurança.

- [P2] Cura na loja pode consumir ouro sem benefício — na Torre, o saldo cai de 304 para 54 entre `t=172–189`; isso não identifica sozinho as compras, mas `WorldEvents.canApply` permite comprar cura com HP cheio, e `applyShopItem` cobra normalmente → desabilitar compras sem efeito, considerando eventual sobrecura, e mostrar quanto será restaurado. A escolha automática do primeiro botão amplifica uma armadilha que também afeta pessoas.

- [P2] Economia depende muito de recompensas externas ao combate comum — no Clássico, o ouro sobe apenas de 27 para 31 entre `t=502–597`, enquanto as mortes aumentam de 846 para 977; a loja cobra 100 por nível e 120 por vitamina. Já a Torre começa com 300G da conquista anterior → medir ouro gerado, coletado e gasto separadamente; testar recompensa monetária previsível por mini-chefe e indicar “Bônus da conquista anterior: +300G” no início. Os 300G são explicados por `pendingGold`, não parecem duplicação.

- [P2] Aliados e inimigos se confundem — em `m13`, `m25` e `final`, criaturas de tamanho e aparência semelhantes ficam junto do jogador; a identificação depende muito da posição → reforçar anéis de aliados, contorno do parceiro e sinais de elite/chefe em `Renderer.drawAlly`/`drawEnemy`, usando formas além de cores. Acrescentar um pequeno painel dos aliados também esclareceria quem está contribuindo para o build.

- [P2] Área perigosa e efeito amistoso competem visualmente — em `m05`, `m17` e `m23`, círculos finos de ataque se misturam com terreno verde, sombras e outros anéis → diferenciar telegráficos hostis por borda forte, preenchimento discreto e animação de contagem; manter efeitos amistosos com outro padrão. As imagens sustentam o problema de contraste, mas não permitem julgar a antecedência dos avisos.

- [P2] Portal e objetivos dependem demais de descoberta fora do HUD — as transições funcionam em `t=402`, `884` e `1339`, porém o piloto conhece o alvo diretamente; as capturas mostram um minimapa dominado por pontos, sem orientação clara para eventos → adicionar ícones e indicação persistente “Portal aberto”/“Altar do guardião”, com seta opcional. `HUD.drawMinimap` é o ponto de integração; isso continua pendente no backlog.

- [P2] Eventos de zona têm pouca presença informativa — eclipse em `t=247–287` e tempestade em `t=1215–1255` aparecem no registro, mas seus estados dependem de texto pequeno e alterações de iluminação; não há captura adequada da tempestade para avaliar suas marcas → reservar um indicador legível com nome, duração e regra do evento; validar o contraste das marcas durante chefes. Em `ZoneEvents` e no render, distinguir evento temporário de iluminação normal do ciclo diário.

- [P2] Santuário recebe comércio durante o clímax — entra-se no santuário em `t=1339`, uma loja aparece em `t=1353` e há gasto de 75G até `t=1363`, durante Devimon → se o objetivo é um duelo final, interromper novos eventos em `WorldEvents.update` durante o santuário e oferecer preparação antes do portal. Hoje a loja pode interromper a luta com um painel que pausa o jogo.

- [P2] Cartas comunicam pouco impacto — `m01` oferece “+5% de chance de status / +3% de área”, sem dizer qual status nem esclarecer pontos percentuais versus aumento relativo; o painel também aparece escurecido → em `src/ui`, mostrar o efeito completo e valores antes/depois, destacar mudanças perceptíveis e verificar se a camada de escurecimento afeta as próprias cartas. Escolher sempre a carta 1 impede concluir que o conjunto de escolhas é ruim.

- [P3] Capturas geram mensagens redundantes — em `t=184`, aparecem entrada no time, conquista, parceiro, ovo e confirmação; em `t=400–402`, duas capturas competem com abertura do portal e mudança de zona → agrupar recompensas e priorizar objetivo/ataques no sistema de banners. Revisar também `Allies.recruit`: com equipe cheia, ele remove silenciosamente o aliado mais antigo; anunciar a substituição, inclusive quando um ovo eclode.

- [P3] Arte tem escalas e acabamentos desiguais — em `m11`, `m13` e `m21`, chefes ampliados mostram pixels muito maiores que os demais personagens; árvores e pedras geométricas contrastam com sprites detalhados, e o mesmo gramado acompanha toda a progressão → revisar escala por espécie em `src/render` e criar variações de cenário para zonas, Torre e santuário. Priorizar silhueta e coerência antes de acrescentar partículas.

- [P3] Resultados precisam de rótulos mais precisos — `results-1` mostra “49 NÍVEIS”, embora o personagem termine no 50, e “13 MOEDAS” representa saldo restante, não ganhos; o dano aparece como `8177652` → em `Screens.showResults`/`buildSummary`, usar “Níveis ganhos”, “Ouro restante”, separar ganhos/gastos e formatar números. Destacar também andar/modo e aliados, hoje ausentes do resumo.

## O que está bom

- O Clássico completou o percurso inteiro até a vitória, incluindo três zonas, portais e santuário, sem erros de página registrados.
- Digievoluções são reconhecíveis; retrato, nome e próxima evolução dão boa orientação de progressão.
- Mini-chefes, enxames e capturas criam acontecimentos concretos entre os guardiões.
- A Torre apresentou mais pressão inicial: Bakemon levou o jogador a 76/148 HP, sem impedir a recuperação posterior.
- As melhorias anteriores aparecem: ouro e abates têm rótulos, e o resultado mostra build e 49 upgrades.
- O santuário limpa a multidão e torna o confronto final visualmente mais fácil de acompanhar.

## Limites desta análise

Esta é uma run completa de Clássico e apenas os quatro primeiros andares da Torre, com Agumon no Normal. Não mede dificuldade para outros parceiros, jogadores iniciantes ou escolhas deliberadas de build.

Fuga automática reduz contato, pode atrasar coleta e prolongar chefes; ausência de esquiva intencional prejudica a avaliação de justiça dos ataques. HP cheio nas amostras não significa ausência de dano entre elas.

Capturas espaçadas não demonstram fluidez, qualidade das animações, áudio, duração dos telegráficos ou acessibilidade em movimento. “Sem erros de página” também não comprova desempenho estável.

Li os fontes e os documentos, sem executar Node, testes ou modificar arquivos. Não confirmei equivalência exata entre fontes e bundle gravado. Os termos “Pokémon”, “bola” e “Evoluiu” no registro podem ser mensagens anteriores à tradução por `PACK.terms`; não os classifico como vazamento visível confirmado.
