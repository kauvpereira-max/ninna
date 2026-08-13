# Design do protótipo — especificação extraída

Extraída em 13/08/2026 do `Ninna — Protótipo offline.html` (Claude Design), lendo
o markup renderizado, não a aparência. Todos os valores abaixo são literais do
arquivo.

> **Esta é a referência visual do bloco de interface.** Onde ela divergir do
> `src/theme/tokens.ts`, a decisão é de produto — mas a divergência precisa ser
> notada, não resolvida em silêncio.

---

## ✅ O markup do protótipo ESTÁ no repositório desde 13/08/2026

`docs/prototipo/markup-extraido.html` — 113 KB, o markup desescapado.

O original (`Ninna - Protótipo offline.html`, 7,4 MB) é uma página empacotada
com o template embutido como string JS escapada (`/` no lugar de `/`).
Deles, ~7,4 MB são o runtime; o que descreve as telas são os 113 KB extraídos.

**Só o extrato entrou no git**, e a escolha é deliberada: 7,4 MB de bundle
entrariam de novo a cada re-exportação do protótipo, e nenhuma linha deles é
legível num diff. Para refazer a extração:

```bash
node -e "
const s=require('fs').readFileSync('Ninna - Protótipo offline.html','utf8');
require('fs').writeFileSync('markup-extraido.html',
  s.slice(7600000).replace(/\\\\u002F/g,'/').replace(/\\\\\"/g,'\"').replace(/\\\\n/g,'\n'));
"
```

> ⚠️ **Eu disse antes que este arquivo não existia, e estava errado.** Listei
> `ls ~/Downloads/*.html | head -3`, vi três páginas InterDemo e concluí
> ausência — de uma lista truncada. É a regra 2 fora de um teste: filtro que não
> acha não prova que não existe.

---

## ⚠️ ESTE DOCUMENTO ESTÁ INCOMPLETO, E ISSO TEM CUSTO

A extração de 13/08/2026 cobriu o markup, e os blocos 1–7 converteram **token e
propriedade** a partir dela: cor, fonte, raio, sombra, espaçamento. **A
estrutura das telas não foi tocada** — e é onde a distância com o protótipo
ainda é grande.

Pior: três especificações que o protótipo tem **não estão neste arquivo** e
chegaram por conversa, não por extração:

| O que | De onde veio |
|---|---|
| Fundo claro do card de monitoramento e o estado de atenção | conversa, 13/08 |
| Seção "Padrões da [bebê]" com cards de 212px | conversa, 13/08 |
| Cabeçalho "Hoje" e link "Relatórios" nos últimos registros | conversa, 13/08 |

Elas estão registradas abaixo e **marcadas como não-extraídas**, porque o resto
do arquivo tem outra procedência: os valores literais do markup.

**O conserto não é escrever mais aqui — é o HTML do protótipo entrar no
repositório**, em `docs/prototipo/`. Enquanto ele estiver só na máquina de
alguém, as lacunas se descobrem uma mensagem por vez, e cada descoberta custa
uma volta inteira.

---

## ✅ Conferido no navegador em 13/08/2026 — o recorte "quase idêntico" fechou

Não é "passou nos testes": os três do fechamento (`tsc`, testes puros,
`expo export`) **não enxergam cor, gradiente nem uma tela que dura 1,2s**. Isto
aqui é o que foi visto e medido no DOM da PWA em produção.

| # | O quê | Medido |
|---|---|---|
| 1 | Card de monitoramento CLARO | `rgb(253,244,241)` = `#FDF4F1`, borda `rgb(239,213,205)` = `#EFD5CD`, raio 24, chip com ponto coral |
| 2 | Card "Converse com a Ninna" | `linear-gradient(rgb(255,255,255), rgb(253,244,241))` |
| 3 | Rótulo de seção e badge "+" | `Fredoka_500Medium` 18px; o "+" no canto superior esquerdo de **todos** os atalhos, na cor do próprio ícone |
| 4 | Tela "Pronto" | blob, selo de check, e **sumiu sozinha em ~1s** |
| 5 | Tela do sintoma | **esperou 6+ segundos sem sumir**, com botão "Fechar" |

### ✅ Os modais, conferidos em 13/08/2026 — e o stepper, duas vezes

Fralda, Humor e Peso passaram de primeira. **A Mamadeira reprovou**, e os dois
defeitos foram achados no navegador, não em teste:

- o passo **somava** em vez de encaixar (5, 15, 25 … 135) e **130 ml era
  inalcançável**;
- e o número tinha deixado de aceitar teclado, então não havia contorno.

Reconferido depois da correção: **5 → 10 → 20 → … → 130 em 13 toques**, e o
número aceita `132` digitado, mantendo o valor ao perder o foco.

> O primeiro toque anda 5 e os seguintes andam 10. **É o mecanismo, não
> irregularidade**: o passo é sempre "o próximo múltiplo", e o primeiro é curto
> porque o `min: 5` do schema não está na grade. Uniformizar isso reintroduz o
> bug.

E o `Peso` continua sendo campo digitado, com vírgula — que é a prova de que o
`passo` declarado por campo funcionou: sete tipos ganharam stepper e seis não.

---

**A linha 5 é a que vale mais**, e não é redundante com a 4: ela prova o
comportamento OPOSTO no mesmo aplicativo. Uma tela que se dispensa e outra que
espera, lado a lado, é a diferença entre confirmar um banho e confirmar algo que
a mãe anotou preocupada. Se as duas se comportassem igual, o teste da 4 sozinho
teria passado do mesmo jeito.

---

## ✅ As cinco decisões de 13/08/2026

Tomadas ao comparar a tela real com este documento. Ficam aqui porque são o
recorte do que "idêntico" quer dizer.

**1. Vigilância se marca por borda e chip, não por superfície.** O card de
monitoramento vira claro (`#FDF4F1`, borda `#EFD5CD`), e o estado de atenção é
`#FFF6F3` com borda `#E88A7D`. A superfície escura sai do app, e os tokens de
noite saem com ela. A regra completa está no `CLAUDE.md`.

**2. A nota do dia fica FORA — e é decisão, não pendência.** Não há fonte de
texto para ela, e as duas saídas eram piores que a ausência: a mãe escrevendo é
funcionalidade nova, e a Ninna escrevendo é uma segunda superfície de frase
gerada ao lado do card de monitoramento. Texto todo dia, sem ter o que dizer, é
exatamente onde a Ninna inventaria.

**3. "Ver tudo" e "Relatórios" ficam de fora enquanto Evolução não existir.**
Link inerte é pior que link ausente: a mãe toca, nada acontece, e ela conclui
que o app travou. Voltam junto com a tela que eles abrem.

**4. Os modais ganham um desenho genérico com a cara do protótipo**, e não seis
desenhos sob medida. O protótipo desenha 6 dos 19 tipos; sob medida, o app
ficaria com formulário derivado do schema "exceto quando não for" — que é perder
o que o `registroSchema.ts` comprou. Genérico cobre os 19 pelo preço de um.

**5. As exceções que valem são Sono e Amamentar, porque têm cronômetro** — e
ficam para depois. O Amamentar de dois timers não é fidelidade visual: é
`PRODUTO.md`, migration e mudança no motor. Ver o registro lá.

---

## ⚠️ O que NÃO copiar

O protótipo desenha um produto maior que o app de hoje. Três coisas nele não
existem e **não devem ser construídas** por causa deste documento:

| No protótipo | Por quê não |
|---|---|
| Tab bar de **5 abas** (Hoje · Rotina · Ninna · Evolução · Mais) | O app tem 4 (Hoje · Rotina · Ninna · Mais). Evolução é o bloco da curva de crescimento, ainda não decidido |
| Card de **previsão** ("Próxima soneca em 42 minutos") | O motor descreve o passado. Previsão é o bloco 5, com backtesting antes |
| Tela **Evolução** e tela **Insights** | Mesma razão |

E a copy do card de monitoramento do protótipo — *"A Liz costuma demonstrar fome
um pouco antes desse horário"* — **viola as regras de copy**: tem artigo de
gênero antes do nome e prevê comportamento. A copy do app está certa; o protótipo
é anterior às regras.

**Este documento é sobre fidelidade visual do que existe.** Espaçamento,
tipografia, cor, raio, sombra. Não sobre escopo.

---

## Paleta, por frequência real de uso

Contada no markup, não na documentação de marca.

### Tinta (texto)
| Hex | Uso | Ocorrências |
|---|---|---|
| `#2B211D` | Títulos, números de destaque | 63 |
| `#5C4A42` | Texto principal | 51 |
| `#8A6A60` | Texto de apoio | 29 |
| `#9C7C6C` | Rótulos, seções | 6 |
| `#B8A69C` | Texto terciário (o rótulo abaixo do registro) | 8 |

### Marca
| Hex | Uso |
|---|---|
| `#E08A80` | CTA primário, botão "Concluir" |
| `#A85A4E` | Texto sobre fundo rosa claro, rótulos de seção em modal |
| `#F3C9C5` | Rosa base |
| `#C4776C` | Seta de "avançar" |
| `#F4796B` | Botão "+" do grid e links de ação ("Ver tudo", "Relatórios") |

### Fundos
| Hex | Uso |
|---|---|
| `#FFFDFA` | Fundo da Home e dos modais |
| `#FFF9F2` | Fundo de onboarding e confirmação |
| `#F9F4EF` | Card de nota do dia |
| `#F4EBE3` | Botão de fechar do modal |
| `#FDF2EC` | Faixa de total dentro do modal |

### Linhas e bordas
| Hex | Uso |
|---|---|
| `#F3EDE6` | Divisórias horizontais e borda de card branco |
| `#F3E2D8` | Borda do rodapé de modal, trilho de progresso |
| `#F1EBE4` | Borda do seletor de bebê |
| `#F2E3DA` | Borda da tab bar |

---

## Tipografia

**Fredoka** só em título e número de destaque. **Nunito Sans** no resto.

| Elemento | Família | Tamanho | Peso | Cor |
|---|---|---|---|---|
| Saudação ("Bom dia, Kauane") | Fredoka | **25px** | 600 | `#2B211D` |
| Subtítulo da saudação | — | 14.5px | 500 | `#7A5C4E` |
| Título de seção ("Últimos registros") | Fredoka | **19px** | 600 | `#2B211D` |
| Rótulo de seção ("Registre a rotina") | Fredoka | 18px | 500 | `#9C7C6C` |
| Título de modal | Fredoka | 18px | 600 | `#2B211D` |
| Número grande (timer, stat) | Fredoka | 21–24px | 600 | `#2B211D` |
| Item da lista (detalhe) | — | 16px | **700** | `#2B211D` |
| Rótulo do item | — | 12.5px | 600 | `#B8A69C` |
| Rótulo do atalho | — | 13px | 600 | `#5C4A42` |
| Label da tab bar | — | 11px | 600 | ativo/inativo |

Detalhes que aparecem em quase todo texto corrido:
- `line-height: 1.45` a `1.55`
- `text-wrap: pretty`
- `letter-spacing: -.2px` em títulos grandes; `.2px` a `1px` em rótulos maiúsculos

---

## Raios

| Valor | Onde |
|---|---|
| **999px** | Tudo que é redondo: atalhos, avatares, botões de ação, chips, CTA (79 usos — é o raio dominante) |
| **26px** | Tab bar |
| **24px** | Card de monitoramento |
| **22px** | Card "Converse com a Ninna" |
| **20px** | Cards de conteúdo, card de padrão, modal interno |
| **16px** | Faixa de total, blocos menores |
| **12px** | Mini-cards de estatística |

---

## Sombras

Quatro, e cada uma tem função:

```
0 1px 3px rgba(92,74,66,.08)      card branco, elevação mínima
0 2px 10px rgba(92,74,66,.06)     card sobre fundo claro
0 8px 20px rgba(224,138,128,.35)  CTA coral — a sombra é colorida
0 6px 22px rgba(92,74,66,.07)     tab bar flutuante
```

A sombra do CTA **tem a cor do botão**, não cinza. É o que dá o brilho.

---

## Espaçamento

- Respiro lateral da tela: **20px**
- Entre blocos: **16–20px** de margem superior
- Padding interno de card: **16–22px**
- Grid de atalhos: `repeat(4, 1fr)`, `gap: 8px`
- Grid de stats: `1fr 1fr 1fr`, `gap: 8px`
- Padding do scroll: `52px` no topo, `124px` embaixo (espaço da tab bar)

---

## Home, elemento por elemento

Ordem exata do protótipo, de cima para baixo:

**1. Cabeçalho** — `padding: 0 20px 20px`, flex com `gap: 12px`
- Esquerda: saudação Fredoka 25px + subtítulo com a idade
- Direita: pill do bebê — fundo branco, borda `#F1EBE4`, raio 999px,
  `padding: 5px 10px 5px 5px`, avatar 34px + seta de 10px

**2. Card de monitoramento** — raio 24px, `padding: 22px 20px 6px`, borda 1.5px

> ⚠️ **NÃO EXTRAÍDO — veio por conversa em 13/08/2026.** As cores abaixo não
> saíram do markup como o resto deste arquivo.
>
> | Estado | Fundo | Borda |
> |---|---|---|
> | Repouso | `#FDF4F1` | `#EFD5CD` |
> | Atenção | `#FFF6F3` | `#E88A7D` |
>
> É o card CLARO. A versão no app é escura, e a diferença é a decisão nº 1
> acima — vigilância passa a ser borda e chip.
- Chip pulsante de 26px com ponto de 9px dentro (animação `nnPulse`, 3.2s)
- Frase de 17.5px, `line-height: 1.55`
- Linhas separadas por `border-top: 1px`
- Rodapé com link centralizado + seta

**3. Card "Converse com a Ninna"** — raio 22px, borda `#EFD5CD`,
`background: linear-gradient(180deg, #FFFFFF 0%, #FDF4F1 100%)`

**4. Nota do dia** — fundo `#F9F4EF`, raio 20px, `padding: 16px`, ícone + texto

**5. Divisória** — `height: 1px`, `background: #F3EDE6`, margem lateral 20px

**6. "Registre a rotina"** — grid de 4 colunas
- Atalho: círculo de **70px** em cor pastel + rótulo 13px embaixo, `gap: 9px`
- Badge de "+" no canto superior esquerdo do círculo: 20px, fundo
  `rgba(255,255,255,.8)`
- Último item: círculo `#F4796B` sólido com "+" branco e sombra colorida

**7. Mini-stats** — três cards brancos, raio 12px, `padding: 11px 12px`,
número Fredoka 21px + rótulo 12px

**8. Últimos registros** — a diferença mais visível do app atual:
- **Timeline com linha vertical**: `position: absolute; left: 81px; width: 2px;
  background: #F3EDE6`
- Cada item: hora à direita (46px, alinhada à direita) + círculo de 44px com
  `box-shadow: 0 0 0 4px #FFFDFA` (o anel que "corta" a linha) + detalhe
- Detalhe 16px peso 700, rótulo 12.5px cor `#B8A69C`

---

## ✅ Divergências deliberadas — o protótipo NÃO é copiado nestes três

Decididas em 13/08/2026. **Não são pendências**, e não devem voltar como "falta
implementar". Vieram por conversa, como as seções abaixo.

**1. Tocar no card de monitoramento não faz nada.** No protótipo o toque alterna
estados — é recurso de **demonstração**, para mostrar as variações numa
apresentação. No app, um card de insight que muda de estado ao ser tocado é
comportamento sem sentido: a mãe não escolhe o que a Ninna observou.

**2. O último item do grid chama "Mais", não "Registros".** É o único lugar onde
o protótipo perde, e o motivo é de escopo, não de gosto: ele foi desenhado com
**6 tipos** e um botão que abria a grade completa. O app tem **19 tipos e 7
atalhos**, e "Registros" sugere *ver o que já foi registrado* — que é a aba
Rotina. "Mais" descreve a ação; "Registros" descreveria outra tela.

**3. Não existe cabeçalho "Hoje" nos últimos registros, e a lista continua sendo
os 8 mais recentes.** O protótipo põe "Hoje" ali. A lista da Home não é de hoje —
ela traz os 8 últimos, venham do dia que vierem, e mostra "ontem 11:05" o tempo
todo. O cabeçalho seria falso na tela, e falso do jeito pior: a mãe confere
contra a memória e conclui que o app perdeu o registro de ontem.

E **filtrar a lista por hoje para o cabeçalho ficar verdadeiro é pior ainda**:
deixaria a Home vazia toda madrugada, que é justamente quando ela abre. Às 3h da
manhã "hoje" tem zero registros, e a tela que deveria acolher mostraria nada.

O histórico por dia já existe, inteiro, na aba Rotina — com cabeçalho de data de
verdade.

**4. A confirmação pós-registro se dispensa sozinha, sem botão "Continuar".**
Sai em ~1,2s; um toque em qualquer lugar antecipa. O visual é o do protótipo
inteiro — blob, badge de check, "Pronto" em Fredoka 26 — e **só a permanência
muda.**

É a única divergência por **uso**, e não por escopo. O protótipo foi desenhado
com 6 tipos e uso ocasional; o app tem 19, e a mãe registra mamada, fralda e
sono várias vezes por dia, às 3h, com o bebê no colo.

> Um passo a mais a cada registro deixa de ser encanto e vira atrito — e o custo
> aparece justamente em quem usa mais.

Se um dia houver dado de uso mostrando que a tela é bem-vinda, voltar ao botão é
trocar um `useEffect` por um `<Button>`.

**A palavra é "Pronto", não "Anotado".** "Anotado." é a abertura da copy de
saúde, e ela tem peso ali: confirma um registro que a mãe pode estar fazendo
preocupada, e a frase inteira devolve a decisão a ela. Usar a mesma abertura
para confirmar um banho esvaziaria isso — e o `teste-copy-saude.ts` defende que
as duas aberturas sejam diferentes. "Pronto" é o que se diz quando algo simples
deu certo, e não compete.

**5. Os modais são TELA CHEIA, não folha a 74–88% sobre a Home.**

O protótipo desenha um overlay `position:absolute` com altura de 74% a 88%,
deixando a Home aparecer em cima. No app eles continuam sendo **rota** com
`presentation: 'modal'`, ocupando a tela inteira.

Dois motivos, e o primeiro é sobre o aparelho:

**A proporção não se traduz do desktop para o telefone.** 78% de uma maquete
larga deixa uma faixa generosa de Home; 78% de um celular deixa ~150px — na
prática, uns 50px úteis depois da barra de status. O que parecia camada vira
sobra.

**E o protótipo faz isso porque a Home dele é bonita, não porque a mãe precise
vê-la enquanto registra.** É hierarquia visual de apresentação. No momento do
registro — 3h da manhã, bebê no colo — o pedaço de Home atrás não dá contexto:
dá distração, exatamente quando ela mais precisa de foco.

E o custo era concreto, não estético. Como overlay, o modal deixaria de ser rota,
e com isso:

| | Rota (hoje) | Overlay |
|---|---|---|
| URL | `/registro/fralda`, real e recarregável | some — vira estado da Home |
| Voltar do navegador | fecha o modal | **sai do app**, com o formulário preenchido |
| Recarregar | reabre o modal | cai na Home e perde o preenchido |

Mais três caminhos que já funcionam e ficariam frágeis: a **edição**
(`/registro/[tipo]?id=`, que a tela de detalhe abre por rota), o fallback do
`fechar()` — que existe justamente porque alguém já abriu o modal direto pela
URL — e a tela **"Mais tipos"**, que navega para o modal e passaria a voltar e
reabrir com um frame de Home no meio.

> Se um dia se quiser o efeito sem o custo: manter a rota e **imitar** a folha —
> `marginTop` proporcional, cantos arredondados no topo, fundo escurecido. Fica
> quase todo o visual sem tocar em navegação.

**6. O anel do Sono é VISUAL, e o encerrar continua na Home.**

O protótipo põe `toggleTimer` (play/pause) dentro do modal. Aqui o anel só conta;
não há stop nele. Três motivos:

- **O sono é o único evento que a mãe inicia e larga.** O lugar de voltar é onde
  ela bate o olho, e é a Home — não reabrir um modal.
- **É a mudança menor.** A lógica de encerrar que já funciona não é tocada. Mover
  a posse do estado do timer para o modal é como se reintroduz o "começou e
  nunca encerrou": dois donos do mesmo "correndo".
- **E o subtítulo publicado já promete o contrário.** Ele diz, com todas as
  letras: *"Deixo o sono correndo a partir desse horário — você encerra na Home
  quando acabar."* Mudar exigiria reescrever texto que já está no ar.

Vale notar que o protótipo **também não tem "Encerrar"** ali — ele tem
`toggleTimer` e o "Concluir" genérico do rodapé. O modelo dele é *começa,
assiste, conclui*, que é o de uma maquete, não o de um sono.

**O anel conta desde o horário ESCOLHIDO, não do zero.** Quando o modal abre não
há sono correndo, e um anel parado em `00:00` seria forma sem função — o mesmo
critério que recusou o overlay. Contando desde a hora do campo, ele diz algo
verdadeiro: *"o sono que você vai registrar já corre há 14 minutos"*.

**E não há arco de progresso.** O protótipo desenha um com `stroke-dasharray`.
Progresso rumo a quê? Sono não tem duração-alvo, e desenhar meta de sono é a
Ninna opinando sobre quanto o bebê devia dormir. Sem o arco, o anel é um trilho
com borda — e o `react-native-svg` deixa de ser necessário.

**7. O `object-position` do avatar não se aplica.** É enquadramento de foto, e o
avatar do app é a **inicial do nome num círculo**. Não há o que enquadrar.
Quando houver foto de bebê, a propriedade volta a fazer sentido e este registro
deixa de valer.

---

## ⚠️ Seções que o protótipo tem e este arquivo não descreve

**Não extraídas — vieram por conversa em 13/08/2026.** Ficam registradas para
não se perderem, e marcadas para não passarem por medida lida do markup.

**Seção "Padrões da [bebê]"** — cards horizontais de 212px, raio 20, com scroll
lateral e link "Ver tudo". O motor já calcula os três padrões, então é
estrutura, não escopo — mas tem duas perguntas em aberto antes de existir:

- as métricas têm **três estados de confiança**, e `insuficiente` e
  `nao_se_aplica` tiram o card de cena. A seção pode ficar com 3, 2, 1 ou zero
  cards, e um carrossel vazio é pior que seção ausente;
- o card de monitoramento **já narra padrão**. Precisa ficar claro o que cada um
  diz que o outro não diz, ou são duas superfícies repetindo.

O link "Ver tudo" fica de fora pela decisão nº 3.

**Cabeçalho "Hoje" e link "Relatórios"** nos últimos registros. O "Hoje" é
trivial; o "Relatórios" fica de fora pela decisão nº 3.

---

## ✅ Os modais, extraídos do markup em 13/08/2026

**São SEIS, e um deles é genérico.** O protótipo já resolveu a questão de
arquitetura que estava em aberto: ele tem `<!-- MODAL: GENÉRICO -->` ao lado dos
cinco por tipo.

### A casca, que é idêntica em todos

```
overlay   position:absolute; inset:0; z-index:60; background:#FFFDFA;
          display:flex; align-items:flex-end
sheet     width:100%; background:#FFFDFA; animation:nnUp .26s cubic-bezier(.2,.8,.3,1)
cabeçalho padding:18px 20px 8px  ·  fechar 40px redondo #F4EBE3, X stroke #5C4A42 2.6
          título Fredoka 18/600 #2B211D  ·  espaçador de 40px
corpo     flex:1; overflow-y:auto; padding:8px 20px 20px
rodapé    padding:12px 20px 28px; border-top:1px solid #F3E2D8
CTA       largura total; height:54px; radius:999px; #E08A80; branco 16,5/700
          box-shadow:0 8px 20px rgba(224,138,128,.35)   ·   rótulo "Concluir"
```

⚠️ **A altura do sheet é DIFERENTE em cada um** — o documento dizia "84%",
generalizando de um só:

| Genérico | Mamadeira | Sono | Amamentar | Fralda | Humor | Grade |
|---|---|---|---|---|---|---|
| 74% | 78% | 82% | 84% | 86% | 88% | 92% |

### Os cinco controles, e é aqui que mora a resposta

**1. Hora — em todos os seis.** Card branco, `radius:16`, `padding:14px 16px`,
ícone 18px stroke `#A85A4E`, texto **15,5/700** `#2B211D` ("Hoje, 11:05").

> A sombra dele diverge entre modais: `0 1px 3px rgba(92,74,66,.08)` na Fralda e
> na Mamadeira, `0 2px 10px rgba(92,74,66,.06)` no Humor e no genérico. É
> inconsistência do protótipo, não decisão — **use a de 2px/10px**, que é a do
> genérico.

**2. Escolha COM ícone** (Fralda). `grid-template-columns:1fr 1fr 1fr; gap:10px`.
Cada opção é um botão-card: `padding:14px 8px`, `radius:16`, `border:1.5px`,
coluna com `gap:9`, contendo um **círculo de 48px** na cor pastel + rótulo
**13,5/700** `#5C4A42`.

**3. Escolha SÓ TEXTO** (Humor). `grid-template-columns:1fr 1fr; gap:10px`.
Pílulas de **`height:48px`, `radius:999px`**, texto **14,5/700**, `border:1.5px`.

**4. Número** (Mamadeira). **Não é campo de texto — é stepper.** Card branco
`radius:20`, `padding:18`, `space-between`:
- menos: 44px redondo, `border:1.5px solid #F8D5D1`, fundo transparente;
- valor: **Fredoka 40/600**, `letter-spacing:-1px`, + unidade 15/700 `#8A6A60`;
- mais: 44px redondo, `#E08A80` sólido, `box-shadow:0 6px 14px rgba(224,138,128,.35)`.

**5. Texto livre** (genérico). `textarea rows=3`, `radius:16`,
`border:1.5px solid #F3C9C5`, `padding:14px 16px`, **15/600**.

**E o rótulo de campo, em todos:** **13/700** `#5C4A42`, `margin-bottom:8~10px`.
O sufixo opcional vem no mesmo elemento, em 600 `#B8A69C` — *"Motivo provável ·
opcional"*.

### O genérico, inteiro

Sheet 74%. No corpo, antes da Hora, um **card de dica**: `radius:20`,
`padding:16`, sombra `0 2px 10px`, com círculo pastel de **56px** (ícone 30px na
tinta do tipo) + texto **14/1.45/600** `#5C4A42`. Depois: Hora e "Observações".

### As duas exceções, e elas são exceções de verdade

**SONO — não é formulário, é cronômetro.** Sheet 82%, corpo centralizado sem
scroll:
- anel de **216×216**, dois círculos `r=98` `stroke-width:12` — trilho `#EFE4F4`,
  progresso `#9B8AC4` com `stroke-dasharray` e `rotate(-90)`;
- tempo em **Fredoka 46/600**, `letter-spacing:-1px`, `line-height:1`;
- status 13/700 `#8A6A60` embaixo;
- botão play/pause de **84px** `#9B8AC4`, sombra `0 12px 28px rgba(155,138,196,.45)`;
- link **"Adicionar manualmente"** 14,5/700 `#A85A4E`, sublinhado.

**AMAMENTAR — dois cronômetros.** Sheet 84%. Texto de abertura 14,5/1.5
`#8A6A60`, depois `grid 1fr 1fr; gap:14` com dois cards brancos `radius:20`,
`padding:18px 12px`:
- rótulo **"ESQUERDO"/"DIREITO"** 12/**800**, `letter-spacing:1px`, `#A85A4E`;
- botão de **88px** redondo, play/pause branco 28px, fundo e brilho dinâmicos;
- tempo em **Fredoka 24/600**.

> A frase de abertura é *"Dá pra alternar quantas vezes precisar"* — ou seja, não
> são duas durações, são **dois cronômetros acumulando** ao longo da mamada.
> Confirma que isto é modelo de dado, não layout: ver `PRODUTO.md` §3.4-bis.

---

## Modal de registro (a leitura anterior, generalizada — ver a extração acima)

Padrão idêntico nos seis:

```
inset: 0, z-index: 60, fundo #FFFDFA
sheet ocupando 84% da altura, alinhado embaixo
animação nnUp .26s cubic-bezier(.2,.8,.3,1)
```

- **Cabeçalho**: botão fechar de 40px redondo, fundo `#F4EBE3` + título Fredoka
  18px centralizado + espaçador de 40px (para o título ficar no centro real)
- **Corpo**: `padding: 8px 20px 20px`, com scroll
- **Rodapé**: `border-top: 1px solid #F3E2D8`, `padding: 12px 20px 28px`
- **CTA**: largura total, **54px** de altura, raio 999px, `#E08A80`, texto branco
  16.5px peso 700, sombra `0 8px 20px rgba(224,138,128,.35)`

---

## Confirmação pós-registro

Tela cheia sobre gradiente `#FFF9F2 → #FDEFE6`, com:
- Blob orgânico de 190px:
  `border-radius: 64% 36% 58% 42% / 46% 58% 42% 54%`
- Badge de check branco de 46px no canto
- "Anotado" em Fredoka 26px
- Botão "Continuar" com borda 1.5px `#F8D5D1`, fundo transparente

---

## Animações

Definidas no protótipo, todas curtas e suaves:

| Nome | Uso | Definição |
|---|---|---|
| `nnFade` | entrada de card | `opacity 0→1`, `translateY(10px)→0` |
| `nnUp` | entrada de modal | `translateY(18px)→0` + fade |
| `nnSheet` | sheet subindo | `translateY(100%)→0` |
| `nnPulse` | ponto do monitoramento | `scale(1)→1.35`, `opacity 1→.35`, 3.2s |
| `nnBreathe` | ícone da Ninna | `scale(1)→1.06`, 4.6–5.2s |
| `nnPop` | badge | `scale(.4)→1.06→1` |

Curva padrão: `cubic-bezier(.2,.8,.3,1)`.

Em React Native, `nnFade`/`nnUp` saem com `Animated`; `nnPulse`/`nnBreathe`
pedem loop. Se custar caro, o card estático continua correto — **animação é
acabamento, não requisito**.

---

## O que provavelmente mais muda no app hoje

Por ordem de impacto visual, olhando as telas em produção:

1. **A timeline dos últimos registros** — hoje é lista simples; no protótipo tem
   linha vertical, hora à esquerda e anel branco no ícone
2. **O tamanho dos atalhos** — 70px de círculo com rótulo embaixo
3. **A saudação em Fredoka 25px** com a idade do bebê logo abaixo
4. **O pill do bebê** no canto superior direito, com avatar
5. **A sombra colorida do CTA** — o `#E08A80` com brilho próprio
6. **Os mini-stats** de três colunas, que não existem hoje

---

## Uma nota sobre o filtro da Rotina

Não está no protótipo — ele foi desenhado com 6 tipos, e o app tem 19. A tela de
filtro com 20 chips é problema novo, sem referência visual. Vale resolver, mas é
decisão de design, não fidelidade.

---

# Adendo — extraído do código do protótipo (13/08/2026)

O documento acima veio do markup. Isto veio do **script**, e resolve as duas
lacunas apontadas no diagnóstico.

## As cores pastéis dos atalhos

Dez famílias. Cada uma é um par `[fundo, tinta]` — o círculo usa o primeiro, o
ícone e o texto usam o segundo.

| Família | Fundo (círculo) | Tinta (ícone) |
|---|---|---|
| coral | `#FDE7E1` | `#D9502F` |
| amarelo | `#FCF2D6` | `#C08A1E` |
| roxo | `#ECE7F8` | `#7A67A8` |
| verde | `#DDF0E7` | `#3F8368` |
| azul | `#E2EEF7` | `#43799A` |
| rosa | `#FBE7E4` | `#B96C63` |
| terra | `#F8E7D9` | `#A55E30` |
| lavanda | `#ECE9F9` | `#7A6DB8` |
| salvia | `#E3F0E6` | `#5A8768` |
| ameixa | `#F7E6EF` | `#8B4E6E` |

Isto **não é** a paleta de categoria do `tokens.ts`. Aquela é sólida e vívida,
para badge com ícone branco; esta é pastel, para círculo com ícone colorido. As
duas podem coexistir — mas são sistemas diferentes, e vale decidir qual vence
onde.

## Os 20 tipos, com a cor de cada um

O protótipo já atribuiu família a todos os 20 — inclusive Habilidade, que o app
ainda não tem.

| Tipo | Família | Tipo | Família |
|---|---|---|---|
| Amamentar | coral | Sintoma | coral |
| Mamadeira | verde | Humor | rosa |
| Fralda | amarelo | Peso | ameixa |
| Sono | roxo | Altura | salvia |
| Banho | azul | Circunferência | lavanda |
| Comida | terra | Atividade | terra |
| Hidratação | azul | Passeio | verde |
| Extração | verde | Leitura | lavanda |
| Medicação | rosa | Vacina | azul |
| Vitamina | amarelo | Habilidade | ameixa |

Duas coisas a notar:

1. **As famílias repetem de propósito.** Verde cobre Mamadeira, Extração e
   Passeio; azul cobre Banho, Hidratação e Vacina. Com 20 tipos, cor não é
   identidade única — é agrupamento semântico.
2. **Não bate com o `tokens.ts` de hoje.** Lá, Amamentar é `#E15C42` (coral
   vívido) e Sono é `#9B8AC4`. Aqui são pastéis de outra família.

## Ícones: o protótipo usa PNG, não SVG

Cada tipo tem um arquivo próprio — `ic-diaper.png`, `ic-moon.png`,
`ic-bottle.png`, e assim por diante, mais `liz-full.png` para a ilustração da
confirmação. São **20 imagens** que não estão no repositório do app.

Sem elas, a fidelidade visual dos atalhos não é alcançável — o app usa Ionicons,
que é outro sistema. Isso é decisão de produto e tem custo: ou os PNGs são
exportados do Claude Design, ou o app fica com ícones de biblioteca.

## Estado ativo tem cor própria

No modal de amamentação, o botão muda quando o timer está correndo:

```
parado:  #E08A80  com  0 8px 20px rgba(224,138,128,.35)
rodando: #E15C42  com  0 8px 22px rgba(225,92,66,.45)
```

O coral de vigilância aparece aqui — em botão, contrariando a regra do
`CLAUDE.md`. Mas o contexto é outro: é **estado ativo de um cronômetro**, não
decoração. Vale decidir se a regra ganha essa exceção ou se o estado usa outro
recurso (borda, pulso) em vez de coral.

## Botão desabilitado

O CTA da fralda quando nada foi escolhido:

```
fundo #F3D9D3 · texto #C6A79F · sem sombra
```

Rosa dessaturado, não cinza. O `tokens.ts` não tem estado desabilitado.
