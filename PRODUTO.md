# Ninna — planejamento de produto

*Escrito em 06/08/2026. Reescrito no mesmo dia, quando a tese apareceu — e ela
reordena o plano, não o ajusta.*

---

## 0. A tese

> **Tudo que a Ninna diz sai dos registros daquele bebê.**
> A comparação é da Liz com a Liz, nunca da Liz com a média.

O Blumy validou a categoria: PT-BR nativo, R$24,90/mês com desconto anual, tom
acolhedor, 50 mil downloads em ~9 meses. O que ele não resolve é que o
assistente, as mensagens e os avisos são **estatística populacional com o nome
do bebê colado por cima** — "bebês nessa idade costumam dormir X". Isso soa
personalizado e não é. A mãe percebe, porque o número não bate com a filha dela.

A tese da Ninna é o oposto, e ela já está construída:

- `src/lib/padroes.ts` calcula padrão **daquele** bebê — média circular, soneca
  separada de noite, janela de 7 dias;
- `src/lib/copyInsight.ts` traduz número em frase sem adjetivo avaliativo;
- a regra de copy que **proíbe comparação com faixa etária** existe desde o P4;
- o estado `nao_se_aplica` — a métrica sai de cena quando não descreve nada — é
  a mesma disciplina: melhor calar que dizer algo genérico.

**Isso muda o que este documento é.** A versão anterior tratava os quatro blocos
novos como funcionalidades a somar. Com a tese no centro, três deles são a
**mesma funcionalidade em três superfícies**: o assistente é o motor respondendo
sob demanda, a notificação é o motor falando na hora certa, a previsão é o motor
projetando para frente. O quarto — monitoramento ampliado — é o que alimenta os
três.

Consequência direta, e é a mais importante do documento: **o assistente deixa de
ser o bloco mais caro e mais arriscado e passa a ser o mais barato e o mais
defensável** (§3.1). Ele muda de lugar na fila.

### O que a tese proíbe, e o que ela permite

A tese não proíbe a existência de estatística populacional no app. Ela proíbe
**a Ninna falar por meio dela**. São duas coisas, e confundi-las custaria à mãe
a curva de crescimento que ela já conhece da caderneta.

| | Proibido — **conteúdo** | Permitido — **referência clínica rotulada** |
|---|---|---|
| O que é | A Ninna afirmando algo sobre a Liz a partir de população | A mesma referência que o pediatra usa, mostrada como referência |
| Exemplo | "Bebês nessa idade dormem 14h" · "A Liz está abaixo do esperado" | A curva da OMS como linha tracejada, com o peso da Liz por cima |
| Quem fala | A Ninna, com autoridade emprestada | A fonte, identificada — a Ninna só desenha |

**O teste, e ele é o critério, não um exemplo:**

> A frase fala do bebê dela, ou fala de uma média com o nome dela colado?

Curva rotulada passa. "A Liz está abaixo do esperado" não passa — e note que a
segunda pode ser derivada da primeira em um passo. É por isso que a permissão
vem com quatro travas, e elas são parte da regra, não ressalva:

1. **Referência é desenhada, nunca narrada.** Vira eixo, linha tracejada, faixa
   sombreada num gráfico. No instante em que vira frase da Ninna, virou conteúdo.
2. **Sempre atribuída.** A mãe precisa ver de quem é a afirmação — "referência
   OMS", como na caderneta. A Ninna não assume autoria de curva que não é dela.
3. **A Ninna não deriva conclusão dela.** Não calcula percentil em texto, não
   classifica, e não usa palavra de julgamento — *abaixo*, *acima*, *esperado*,
   *adequado*, *atrasado*. Ler a posição na curva é do pediatra, que examinou a
   criança; desenhar a curva é do app.
4. **Só onde a referência já faz parte do cuidado formal**: crescimento e
   calendário vacinal. **Não se estende** a sono, mamada, humor ou sintoma — não
   existe "curva oficial de sono", e a tentação de inventar uma é exatamente a
   deriva que o N8 descreve.

O texto da Ninna sobre crescimento continua sendo comparação dela com ela:
*"Liz ganhou 340 g desde a última pesagem"*. A curva de referência fica atrás
disso, no gráfico, fazendo o que faz na caderneta — dando contexto que a mãe lê
com o pediatra, não conclusão que o app entrega pronta.

---

## 1. O que já existe e serve

9.015 linhas. Com a tese no centro, o inventário se reorganiza: o que antes era
"código reaproveitável" agora é **o produto**.

### É a tese, já construída

| Peça | Linhas | Papel |
|---|---:|---|
| `src/lib/padroes.ts` | 361 | O motor. Responde as três métricas sobre *este* bebê. Base do assistente, da notificação e da previsão |
| `src/lib/copyInsight.ts` | 242 | Número → frase, com hedge por faixa de confiança e sem adjetivo avaliativo |
| `scripts/teste-padroes.ts` + `teste-copy-insight.ts` | 670 | Provam que o motor acerta e que **nenhuma frase possível** quebra as regras de tom. Isso é o que impede a tese de se degradar sozinha |
| `scripts/teste-copy-telas.ts` | 358 | Varre 355 trechos das telas contra gênero. O mesmo molde serve para varrer "linguagem de média" |
| As regras travadas no `CLAUDE.md`/`BETA.md` | — | Nunca compara bebês, silêncio honesto, copy de saúde. São a tese escrita antes de ter nome |

### Serve com adaptação

| Peça | Linhas | O que muda |
|---|---:|---|
| `src/lib/registros.ts` | 770 | Precisa virar genérico por tipo — a cadeia condicional não escala até 20 |
| `app/registro/[tipo].tsx` | 473 | Mesmo problema, no formulário. Vira guiado por schema |
| `supabase/migrations/` | 284 | RLS testada e cascata aplicada. Serve a 20 tipos, ganha tabelas novas |
| `src/contexts/`, autenticação, tokens, telas | ~1.700 | Independem da tese e do canal |
| `public/` + `vercel.json` | ~250 | Serve enquanto o canal for web |

### Não existe, e vai fazer falta

- **Nenhuma configuração nativa.** Sem `eas.json`, sem `bundleIdentifier`, sem
  `package`. `/ios` e `/android` nunca foram geradas.
- **Nenhum backend próprio.** Assistente e notificação exigem Edge Functions —
  a chave da API não pode ir para o bundle.
- **Nenhuma superfície de consulta.** O motor calcula três métricas para o card.
  O assistente precisa de um conjunto **enumerado** de perguntas que ele sabe
  responder (§3.1). Isso não existe e é o trabalho central do bloco.

---

## 2. Como ler as estimativas

Duas colunas que não se somam: **trabalho** (dias de construção) e **relógio**
(espera que trabalhar mais rápido não comprime — fila da App Store, aprovação de
conta, semanas de uso real).

E o aviso que continua valendo: **a velocidade do beta não se extrapola.** P1 a
P7 saíram em dois dias porque era CRUD greenfield com escopo travado. Os blocos
abaixo têm dependência externa e decisões que não são de engenharia.

---

## 3. Os quatro blocos, derivados da tese

### 3.1 Assistente ancorado

**Trabalho: 2–3 semanas. Relógio: 1–2 semanas.**
*(A versão anterior deste documento dizia 2–3 semanas de trabalho e 3–6 de
relógio, com risco alto. A tese cortou o relógio e o risco. O trabalho é o
mesmo — mudou de lugar.)*

#### O que ele é

Não é chat sobre bebês. É **linguagem natural sobre os registros dela**. A
pergunta vira consulta ao motor; o motor devolve um número; a IA traduz o número
em frase.

```
"faz quanto tempo desde a última mamada?"
   → consulta(ultimo_registro, tipo=mamada)
   → motor devolve: { ts: "14:20", delta_min: 160 }
   → frase: "A última mamada foi às 14h20 — faz 2h40."
```

O modelo nunca sabe nada sobre bebês em geral. Ele sabe **ler a pergunta** e
**dizer o número que o motor calculou**. Tudo que ele diz é rastreável a um
registro da Liz.

#### Isso resolve o maior risco do documento anterior

A versão anterior tinha isto como o item mais perigoso: um assistente em
conversa livre é estruturalmente incompatível com as regras travadas de copy de
saúde, porque a mãe vai perguntar "38,5 e não mama, o que faço?" às 3h da manhã.

**Ancorado, a resposta é estrutural e não depende de prompt:** o motor não tem
consulta que responda isso. Não existe `avaliar_gravidade()`. A pergunta cai fora
da superfície e recebe a resposta de fora-de-escopo — que é texto fixo, escrito e
revisado por você, e que já existe em espírito no app:

> Não consigo te ajudar com isso — eu só sei o que você registrou. Se você
> estiver preocupada, confie no seu instinto e fala com o pediatra.

A barreira que eu disse que precisava ser construída **vem de graça com a
arquitetura**. Não é um classificador tentando adivinhar intenção: é o fato de
que a única coisa que o assistente consegue fazer é consultar registros.

Ainda é preciso **impedir a alucinação na tradução** — o modelo dizendo "3h20"
quando o motor calculou "2h40". Isso é verificável em código: todo número na
resposta tem que aparecer no resultado do motor. Um validador de ~40 linhas, e
mais um teste no molde do `teste-copy-insight.ts`.

#### Custo por mensagem — recalculado

Preços da API (1P, 06/08/2026): Opus 5 $5/$25 por MTok · Sonnet 5 $3/$15 ·
Haiku 4.5 $1/$5. Leitura de cache ~0,1× da entrada. Mínimo cacheável: 512
tokens no Opus 5, 1.024 no Sonnet 5, **4.096 no Haiku 4.5**.

A conversa encolhe porque o prompt não carrega conhecimento nenhum — carrega a
gramática de consultas e as regras de tom:

| Parte | Antes (chat aberto) | Ancorado |
|---|---:|---:|
| Prompt fixo | ~2.000 | ~1.800 (cacheável) |
| Contexto do bebê no prompt | ~800 | 0 — vem por consulta |
| Histórico da conversa | ~1.500 | ~300 |
| Resultado do motor | — | ~200 |
| Saída | ~250 | ~120 |

**Desenho A — duas idas (o modelo escolhe a consulta, depois narra):**

| Modelo | Por mensagem | 240 msg/mês | R$/mês* |
|---|---:|---:|---:|
| Opus 5 | $0,0110 | $2,64 | ~R$ 14 |
| Sonnet 5 | $0,0066 | $1,58 | ~R$ 8,50 |
| Haiku 4.5 | $0,0054 | $1,30 | ~R$ 7 |

**Desenho B — uma ida (o modelo só escolhe a consulta; a frase sai do
`copyInsight.ts`, que já existe e já passa nos testes de tom):**

| Modelo | Por mensagem | 240 msg/mês | R$/mês* |
|---|---:|---:|---:|
| Opus 5 | $0,0041 | $0,98 | ~R$ 5,30 |
| Sonnet 5 | $0,0025 | $0,59 | ~R$ 3,20 |
| Haiku 4.5 | $0,0024 | $0,59 | ~R$ 3,20 |

\* a ~R$5,40/USD — **confira a cotação antes de usar em conta que importe.**

**O achado que muda a decisão de modelo:** no Desenho B, **o Opus 5 custa menos
que o Haiku 4.5 custava no chat aberto** ($0,98 contra $1,39 por mãe/mês).
Ancorar não é só mais barato — é o que torna acessível o modelo mais capaz. E
como o trabalho do modelo encolheu para "interpretar uma pergunta em português",
a diferença de qualidade entre os três encolhe junto.

Recomendo o **Desenho B como caminho padrão** e o A como escape para perguntas
que a copy determinística não cobre. A escolha de modelo continua sendo sua; o
que eu digo é que a arquitetura tirou o custo de cima dessa decisão.

**O limite diário continua obrigatório.** Uma mãe em 30 mensagens/dia custa
$9,90/mês no Desenho A com Opus (~R$53) — acima da assinatura inteira. No
Desenho B, $3,69 (~R$20), ainda alto. O teto não é economia, é o que faz o preço
fechar (§5).

#### Onde a complexidade foi parar

Saiu do prompt e foi para a **superfície de consulta** — e isso é uma boa troca,
porque prompt não se testa e superfície de consulta se testa.

O trabalho central é enumerar o que o assistente sabe responder:

| Família | Exemplos | Registros necessários |
|---|---|---:|
| Recall | "quando foi a última mamada?", "ela dormiu essa noite?" | 1 |
| Contagem | "quantas fraldas hoje?", "quantas mamadas ontem?" | 1 |
| Intervalo | "faz quanto tempo?", "de quanto em quanto tempo ela mama?" | 2 |
| Comparação própria | "essa semana foi diferente da passada?" | ~15 |
| Padrão | "que horas ela costuma dormir?" | 5 na métrica |
| Projeção | "quando ela deve dormir?" | ~20 (§3.3) |

**Essa tabela é o produto**, e é também o que faz o assistente ser testável do
mesmo jeito que o motor já é: para cada família, entrada conhecida → saída
esperada, rodando em Node sem banco.

Pergunta fora da lista recebe a resposta de fora-de-escopo. **Isso vai acontecer
muito no começo**, e a qualidade dessa recusa é metade da experiência.

#### Trabalho concreto

- Superfície de consulta: gramática, tipos, implementação sobre `padroes.ts` e
  `registros.ts` — 5 dias
- Edge Function (chave fora do bundle) + cache de prompt — 2 dias
- Validador de ancoragem: todo número da resposta existe no resultado — 1 dia
- Resposta de fora-de-escopo, incluindo o caminho de saúde — 1 dia
- UI de conversa, com limite diário visível — 3 dias
- Testes: superfície + tom + ancoragem — 3 dias

**Risco: médio-baixo.** Era alto. A arquitetura é que mudou isso, não uma
mitigação.

---

### 3.2 Notificações

**Trabalho: 2–3 semanas. Relógio: 1 semana.**

#### A regra da tese, aplicada

Permitido: **"Liz costuma dormir por volta de agora."**
Proibido: **"Bebês nessa idade dormem tanto."**

E há uma terceira categoria que a tese torna óbvia e que sem ela seria tentadora:
**notificação sem lastro no histórico dela não existe.** Se o motor não tem 5
registros da métrica, não há o que notificar — cala, exatamente como o card já
faz. Nenhuma notificação de "boas práticas", nenhuma dica genérica, nenhum
lembrete que não venha de um padrão dela.

Isso reduz drasticamente o problema de design que a versão anterior levantava
(notificação que interrompe e culpabiliza), porque elimina de saída a classe
inteira de avisos genéricos — que é justamente de onde vem o incômodo.

#### O que continua verdade sobre iOS

Corrigindo a premissa que estava no seu pedido original: **PWA no iOS entrega
push desde o iOS 16.4** (março/2023), com quatro condições —

1. só para PWA instalada na tela de início (Safari aberto não tem `PushManager`);
2. não existe prompt automático de instalação no iOS;
3. **não há `Background Sync`** — toda notificação parte do seu servidor;
4. push web não funciona em PWA na União Europeia (irrelevante hoje).

**Notificação não força nativo.** O que ela força é um **agendador no servidor**,
e esse custo você paga nos dois canais. O que muda entre eles é a **taxa de
adesão**: no PWA a mãe precisa instalar *e* aceitar; no nativo, só aceitar.

#### Trabalho concreto

- Tabela de subscriptions + RLS — 1 dia
- Edge Function de envio (VAPID/Web Push) — 2 dias
- **Agendador** (`pg_cron` calculando quem recebe o quê a partir dos padrões
  dela) — 4 dias. É a peça mais subestimada do bloco
- Regras de quando notificar e de quando calar, derivadas dos limiares que já
  existem — 3 dias
- Preferências e opt-out por tipo — 2 dias

**Risco: médio.** O ganho da tese aqui é real, mas horário ainda é delicado: um
push às 3h da manhã é ruim mesmo quando o conteúdo está certo.

---

### 3.3 Previsões

**Trabalho: 2–3 semanas. Relógio: 4+ semanas — só o tempo diz se acertou.**

Mesma tese, projetada para frente: **do histórico dela, com incerteza
declarada.**

**A diferença estrutural em relação ao que existe.** Hoje o motor descreve o
passado, e o erro é visível na hora — a conta está certa ou errada. Previsão só é
verificável depois:

| | Descrição (existe) | Previsão (novo) |
|---|---|---|
| Erro aparece | Na hora, para você | Depois, para a mãe |
| Testável offline | Sim | Só contra histórico real |
| Custo do erro | Frase estranha | Perda de confiança |
| Silêncio | 3 estados | Precisa de faixa, não de ponto |

**Duas regras não negociáveis:**

1. **Faixa, nunca ponto.** "Entre 13h e 14h", não "às 13h30". Ponto está errado
   quase sempre, e a tentação de mostrá-lo porque fica bonito na tela é a
   maneira mais rápida de queimar a credibilidade que o insight construiu.
2. **Descrever, não prescrever.** "O próximo sono provavelmente começa entre 13h
   e 14h" é lido por uma mãe cansada como "devo colocar para dormir às 13h30". Se
   o bebê não dormir, ela conclui que falhou — culpa por interpretação, que
   nenhuma varredura de texto pega.

**E o backtesting não é opcional:** prever o dia N com dados até N-1, sobre
histórico real, e medir o erro. Sem isso não se publica previsão nenhuma. É
também o motivo de este bloco vir depois dos outros — ele precisa de semanas de
dado acumulado para ter o que testar.

**Risco: médio-alto**, pela leitura que a mãe faz, não pela matemática.

---

### 3.4 Monitoramento ampliado

**Trabalho: 3–4 semanas. Relógio: ~zero.**

Com a tese no centro, este bloco muda de natureza: **não é paridade de
funcionalidades com o concorrente, é o que alimenta os outros três.** Cada tipo
novo é um eixo a mais sobre o qual a Ninna pode falar da Liz com a Liz. O
assistente responde sobre o que existe registrado; a superfície de consulta
cresce automaticamente com cada tipo.

São os 14 restantes — e **esta tabela lista 13**.

> ⚠️ **Corrigido em 12/08/2026, depois de os 13 estarem em produção.** A frase
> dizia 14, os quatro grupos somavam 13, e o que faltava era **Habilidade**. Ela
> existe na lista de 20 tipos do `CLAUDE.md` e sumiu daqui — provavelmente porque
> não coube em nenhum dos quatro grupos, que é o sintoma, não a causa.
>
> A `docs/proposta-14-tipos.md` herdou a tabela sem conferir a soma, e o bloco
> inteiro foi construído sobre ela. Nenhum teste pegaria isso: os treze tipos
> estão certos, e "falta um" não é uma afirmação sobre código.
>
> **Habilidade não é o décimo quarto item de uma fila** — é decisão de outra
> natureza, e está no fim desta seção.

| Grupo | Tipos | O que exige além da tabela |
|---|---|---|
| Eventos simples | Banho, Passeio, Leitura, Atividade | Horário e duração. ~1 dia cada |
| Alimentação | Comida, Hidratação, Extração | Vocabulário fechado; cruzam com o motor |
| Saúde | Medicação, Vitamina, Vacina | **Dose e horário.** Erro é dano. Confirmação em duas etapas e histórico não editável |
| Crescimento | Peso, Altura, Circunferência | Série temporal, não evento. Gráfico com referência clínica rotulada (§0) |

**Peso e altura são onde a distinção do §0 vira código.** A tela de Evolução
mostra a linha da Liz sobre a referência tracejada da OMS — que é o que o
protótipo já previa, o que o pediatra usa e o que a mãe já viu na caderneta.
Isso é referência clínica rotulada, e passa.

O que **não** passa é a Ninna narrar a curva: nenhuma frase com *abaixo*,
*acima*, *esperado*, *adequado* ou percentil em texto. O texto continua sendo
comparação dela com ela — *"ganhou 340 g desde a última pesagem"*. A distância
entre desenhar a referência e escrever uma frase sobre ela é de uma linha de
código, e é toda a diferença entre a Ninna e o concorrente.

Vale a mesma nota sobre **vacina**: no instante em que o app disser "a próxima é
a de 4 meses", ele passou de registro para orientação de saúde. Não é
impossível, mas é decisão consciente, e provavelmente com fonte citada (PNI) em
vez de tabela própria.

**Três pré-requisitos antes do primeiro tipo novo:**

1. `registro/[tipo].tsx` (473 linhas) vira formulário guiado por schema — 4 dias,
   e paga a si mesmo no quinto tipo;
2. `registros.ts` (770 linhas) vira genérico — 3 dias;
3. 4–6 migrations novas, cada uma com RLS e cascata — e **cada mudança de policy
   obriga a rodar o `teste-rls-delete.mjs` (§11.4), que hoje está bloqueado**.

**Risco: baixo**, exceto medicação, vacina e a curva de crescimento.

---

### Habilidade — o tipo que ficou, e por que ele não é "o último da fila"

**Aberto em 12/08/2026, com os outros 13 em produção.**

Marco de desenvolvimento — sorriu, sentou, engatinhou, primeira palavra. Ele é
o lugar mais tentador do produto inteiro para a tese quebrar, e o risco não está
em nenhuma frase: **está na lista.**

Todo app concorrente mostra os marcos como uma sequência com idade esperada. No
instante em que a Ninna desenha uma lista de habilidades, a mãe lê um checklist —
e o que ela vê marcado é o que a filha já fez, e o que ela vê em branco é o que a
filha **ainda não** fez. A comparação com a norma acontece na cabeça dela, sem o
app escrever uma palavra. É o risco N8 sem precisar de deriva de copy.

Isso o separa dos outros 19: eles registram algo que aconteceu, e a lista de
opções é vocabulário. Aqui a lista de opções **é** a norma.

**Três desenhos possíveis, e eles são produtos diferentes:**

| | O que é | O que custa | O que arrisca |
|---|---|---|---|
| **Memória** | Texto livre + data: "o que ela fez pela primeira vez". Sem lista, sem sugestão | ~1 dia, e cabe no schema de hoje | Nada da tese. Também não responde "está na hora?" |
| **Monitoramento** | Vocabulário fechado de marcos, com referência rotulada e desenhada, nunca narrada | Mesma conversa da curva da OMS | É o §0 inteiro. Precisa de fonte citada e de decisão consciente |
| **Nenhum dos dois** | Habilidade sai da lista de 20 | Zero | Perde uma coisa que a mãe quer guardar |

**O que a diferença revela:** o valor de "monitoramento" para a mãe é
exatamente a comparação que a Ninna decidiu não fazer. Um checklist sem idade
esperada não serve para nada; com idade esperada, é o concorrente.

Já "memória" é legítimo, barato e compatível — mas é outra coisa. É guardar,
não acompanhar, e talvez nem devesse aparecer entre uma fralda e uma mamada na
Rotina.

**Decisão pendente, e ela não bloqueia nada.** Os 19 tipos estão no ar; o bloco 3
fecha sem Habilidade. Se ela for memória, entra quando houver espaço. Se for
monitoramento, vai junto com a curva de crescimento, que é a outra conversa do
§0 — e as duas merecem ser tomadas no mesmo dia, pelo mesmo raciocínio.

---

### 3.5 Painel de afiliadas — registrado em 11/08/2026, não construído

**Trabalho: 1,5–2 semanas. Relógio: —. Depende da cobrança existir.**

Escopo mínimo, um nível só, como pedido:

- link rastreável por afiliada;
- atribuição da origem no cadastro, persistida;
- comissão como percentual da assinatura que veio daquele link;
- painel com login próprio, vendo só os próprios indicados e ganhos;
- solicitação de saque, com pagamento manual no começo.

**Por que só depois da cobrança:** comissão é percentual de assinatura, e a
assinatura só existe no bloco 1 do §7. O webhook da Stripe que confirma pagamento
é o mesmo que credita a comissão — construir antes significaria construir duas
vezes.

**Onde o trabalho realmente está**, porque não é no link:

- **Atribuição que sobrevive.** `?ref=CODE` guardado antes do cadastro, colado na
  conta no momento do `signUp`. Uma tabela `afiliadas` e uma `indicacoes`.
- **Painel com login próprio.** Não é uma segunda base de auth: é a mesma do
  Supabase, com a afiliada tendo linha em `afiliadas` e uma rota que só abre para
  quem tem. Um segundo sistema de login seria o dobro do trabalho e metade da
  segurança.
- **Saque.** Tabela de solicitações, estado, e pagamento manual fora do sistema.

**Três coisas que vão morder, e que valem estar escritas antes:**

1. **A atribuição se perde no iOS, e é o R1 de novo.** A influenciadora posta, a
   mãe toca no link, não instala, volta cinco dias depois — e o Safari já limpou
   o storage. A comissão some, a afiliada reclama, e ela tem razão. Mitigar exige
   guardar a origem do lado do servidor no primeiro toque, não só no navegador.
2. **A afiliada não pode ver quem indicou.** Só contagem e valor. Nome de mãe ou
   qualquer coisa do bebê aparecendo num painel de terceiro é vazamento de dado
   sensível de criança — e o termo promete o contrário. Isso é requisito, não
   preferência de tela.
3. **Comissão é evento fiscal.** Pagamento manual adia a questão, não a resolve.
   Vale saber disso antes de a primeira afiliada acumular saldo.

**Uma nota de tom:** este é o primeiro produto da Ninna cujo público não é a mãe.
As varreduras de gênero e de linguagem de média existem para a copy que a mãe lê;
a copy do painel de afiliadas é outra audiência e outro registro. Decidir se as
regras valem lá é decisão a tomar quando o bloco começar — não herdar por
descuido nem descartar por pressa.

---

## 4. Onde a tese é difícil de sustentar

Você fez a pergunta certa, e é a única do documento que não tem resposta
confortável.

> Bebê novo com poucos registros não tem histórico próprio, e é justamente
> quando a mãe mais quer resposta.

### Primeiro: a janela é menor do que parece

O limiar de 5 registros é do **padrão**, não do assistente. A maior parte do que
uma mãe de recém-nascido pergunta não precisa de padrão nenhum:

| Registros dela | O que a Ninna já pode dizer | De onde vem |
|---:|---|---|
| 0 | Nada sobre o bebê — só ensina a registrar | — |
| **1** | "A última mamada foi às 14h20 — faz 2h40" | leitura direta |
| **2** | "Entre as duas últimas deu 3h10" | subtração |
| ~1 dia | "Hoje foram 6 mamadas e 4 trocas" | contagem |
| **3º dia** | "Ontem foram 7; hoje, até agora, 6" | comparação dela com ela |
| 5 na métrica | "Costuma pegar no sono por volta das 13h" | `padroes.ts` |
| ~15 dias | "Dormiu 40 min a mais essa semana que na passada" | o seu exemplo |
| ~20+ | Previsão com faixa | §3.3 |

**"Faz quanto tempo desde a última mamada?" é a pergunta mais frequente de mãe de
recém-nascido, e ela é respondível com UM registro.** A janela verdadeiramente
fria — em que a Ninna não tem nada dela para dizer — dura horas, não semanas.

Os dois degraus de comparação custam um dia a mais do que parece, e a razão é a
mesma nos dois: **a janela anterior precisa ter começado com o app já gravando.**
Comparar "hoje até as 17h" com "ontem até as 17h" só é honesto se ontem estava
coberto desde a meia-noite — senão faltam as mamadas da madrugada em que o app
ainda não existia, e sai "hoje teve 5, ontem teve 3", plausível e errado. Por
isso a comparação de dias abre no 3º dia, não no 2º, e a de semanas no 15º dia,
não no 14º. É o mesmo silêncio honesto do motor, um degrau acima.

Isso não é um remendo para o cold start: é reconhecer que **recall e contagem são
tão "sobre este bebê" quanto padrão**, e valem desde o primeiro toque.

### Segundo: o que fazer no degrau zero

O app já tem a resposta certa e ela se chama **frase de aprendizado** — o estado
`insuficiente`, que diz que ainda está conhecendo, sem número e sem culpa. Ela é
honesta e já passa nos testes de tom. O que muda é que ela precisa ser **útil**,
não só honesta: acompanhada do que a Ninna *consegue* fazer agora (registrar em
segundos, mostrar o que já foi registrado hoje) em vez de virar tela de espera.

Nas primeiras 48h o produto não é insight — é **memória**. Uma mãe que não dormiu
não lembra se a última mamada foi 1h ou 3h atrás, e o app que responde isso
corretamente já valeu o dia. O insight chega depois, e a tese é o que garante que
ele chega **certo** em vez de chegar rápido.

### Terceiro: a saída tentadora que eu não recomendo

A saída óbvia é pegar emprestada a estatística populacional "só na primeira
semana, só enquanto não há histórico". **É a pior hora possível para
comprometer a tese**, por dois motivos:

1. **É a primeira impressão.** A mãe julga a diferenciação nos primeiros dias.
   Se o que ela vê na semana 1 é "bebês nessa idade costumam", a Ninna é o Blumy
   com outro logo — e ela nunca chega à semana 3 para ver a diferença;
2. **É irreversível na percepção dela.** Depois de ler uma frase de média, toda
   frase seguinte fica sob suspeita de ser média também. A credibilidade da
   personalização é frágil de um jeito assimétrico: custa semanas para construir
   e uma frase para perder.

Se um dia houver conteúdo geral no app, que ele seja **explicitamente rotulado
como tal e nunca apresentado como sendo sobre a Liz** — uma seção "para saber
mais", não uma frase no card. Misturar as duas vozes é o defeito do concorrente.

### Quarto: o limite honesto, que não tem solução

**"Isso é normal?" não tem resposta a partir dos dados dela.** Nem na semana 1,
nem nunca — normalidade é, por definição, comparação com população. A tese
proíbe responder e a copy de saúde travada também.

A resposta do produto é dizer isso e apontar quem sabe:

> Eu só sei o que você registrou — não sei dizer o que é normal. Se você estiver
> preocupada, confie no seu instinto e fala com o pediatra.

**Decidido em 06/08/2026: aceito sem ressalva.** E há uma correção a fazer no
enquadramento que eu tinha dado: isto não é limitação da tese. **É regra de
segurança, e ela já estava travada antes de a tese existir** — o `CLAUDE.md`
proíbe avaliar gravidade, listar sinal de alarme, tranquilizar e alarmar, e manda
registrar e devolver a decisão à mãe. A tese e a regra de saúde chegam à mesma
resposta por caminhos independentes, o que é o melhor sinal possível de que a
resposta está certa.

Coerente, também: um produto que se recusa a fingir conhecimento que não tem é o
mesmo que se recusa a chamar média de personalização.

### Quinto: um caso de borda que vale decidir agora

Mãe de segundo filho **tem** histórico próprio — do outro filho, e o seletor de
bebê já existe. Comparar a Liz com o irmão é dado dela, mas continua sendo
comparar um bebê com outro, e "o primeiro dormia melhor" é exatamente a culpa
que as regras de tom proíbem.

Recomendo: **permitido só se ela perguntar explicitamente, nunca oferecido.**

---

## 5. Preço e margem

O Blumy ancora em **R$24,90/mês com desconto anual**. Ancoragem de concorrente
estabelecido é um teto prático: acima disso, cada real precisa ser justificado
contra um app que a mãe já conhece.

### ✅ Preço decidido em 11/08/2026

**R$24,90/mês e R$149,90/ano.** O anual veio do brand deck original, com 7 dias
grátis previstos.

**Margem por assinante, cobrando por Stripe na PWA** (4,39% = 3,99% + 0,4% de
recorrência, mais R$0,39 fixos por cobrança):

| Item | Mensal (R$24,90) | Anual (R$149,90/12) |
|---|---:|---:|
| Receita bruta | R$ 24,90 | R$ 12,49 |
| Stripe | −R$ 1,48 | −R$ 0,58 |
| Assistente — Desenho B, Opus 5 | −R$ 5,30 | −R$ 5,30 |
| Infra fixa diluída | −R$ 1,00 | −R$ 1,00 |
| **Margem** | **R$ 17,12 (69%)** | **R$ 5,61 (45%)** |

No anual a cobrança é uma só por ano, então o R$0,39 fixo dilui — é por isso que
a linha da Stripe cai tanto.

### ⚠️ O anual é 50% de desconto, e isso torna 45% o CASO BASE

R$149,90 equivalem a R$12,49/mês contra R$24,90. **Meio preço**, não os 15–20%
que um desconto anual costuma ser.

Consequência direta: o anual é a escolha racional para quase qualquer mãe que
pretenda usar o app por mais de dois meses. Então a margem que importa para
planejar **não é a de 69%** — é a de **45%**.

**O planejamento usa R$5,61 por assinante por mês.** Qualquer conta de ponto de
equilíbrio, de custo de aquisição ou de quanto a Ninna aguenta gastar sai daí, e
não do número do plano mensal.

**Decisão em aberto, registrada de propósito:** um anual de **R$239** (~20% de
desconto, R$19,92/mês) daria **~58% de margem**, ou R$11,50/assinante/mês —
**mais que o dobro**. O preço de R$149,90 foi escolhido conscientemente, e a
alternativa fica escrita aqui para que a escolha continue sendo uma escolha, e
não algo que ninguém lembra de ter decidido. Revisitar quando houver dado de
conversão real.

---

**A tabela abaixo é histórica:** ela registra o caso da LOJA (15% em vez de
Stripe), que volta a valer se um dia a venda acontecer dentro do app iOS. Os
números de receita são os do anual antigo, de R$199.

| Item | Mensal | Anual (R$199/12) |
|---|---:|---:|
| Receita bruta | R$ 24,90 | R$ 16,58 |
| Loja (15%, Small Business Program) | −R$ 3,74 | −R$ 2,49 |
| Assistente — Desenho B, Opus 5 | −R$ 5,30 | −R$ 5,30 |
| Infra fixa diluída (Supabase Pro + Resend) | −R$ 1,00 | −R$ 1,00 |
| **Margem** | **R$ 14,86 (60%)** | **R$ 7,79 (47%)** |

Com o **Desenho A** (duas idas, Opus 5) o assistente sobe para ~R$14/mês: a
margem mensal cai para ~R$6 (24%) e a anual **fica em ~R$-1 — prejuízo**. Não é
detalhe de engenharia: **a escolha entre A e B decide se o plano anual fecha.**

Três coisas que decorrem disso e precisam estar no plano desde o dia 1:

1. **Limite diário de mensagens — 30/dia no plano pago, 10/dia durante o teste
   grátis.** Sem teto, uma usuária pesada custa mais que a assinatura. E o teste
   grátis precisa do seu próprio: no teto de 30, sete dias levados ao máximo
   custam ~R$4,65, que é quase um mês inteiro da margem anual. Com 10 cai para
   ~R$1,55, e segue generoso para quem está conhecendo;
2. **A infra fixa só dilui com escala.** Supabase Pro são US$25/mês fixos —
   R$135. Com 10 assinantes isso é R$13,50 cada e a margem some. **O ponto de
   equilíbrio fica em torno de 20–30 assinantes**, e antes disso o produto opera
   no negativo. Isso é normal, mas precisa ser dito antes e não descoberto
   depois;
3. **A loja cobra 15% enquanto você faturar menos de US$1M/ano** — acima disso,
   30%. Longe daqui, mas a conta muda.

**A camada gratuita foi decidida em 11/08/2026, e é o desenho acima:** registrar,
ver a rotina e ler o insight são grátis; o assistente é pago. Paga o que custa —
ele é o único recurso com custo marginal por usuária. E grátis o que constrói o
histórico, que é o que faz o assistente valer alguma coisa quando ela chegar
nele. A fronteira mora em `src/lib/acesso.ts`, numa linha só.

---

## 6. A decisão de canal — PWA inteira primeiro, nativo por último

*Reordenado em 11/08/2026.* A versão anterior punha o canal nativo como bloco 2,
"porque o relógio é de terceiro e corre em paralelo". Invertido: **o que não se
controla vai para o fim**, e tudo que a PWA consegue fazer acontece antes.

O raciocínio que mudou: US$99, fila de revisão de dias a semanas e uma primeira
submissão que costuma ser rejeitada não são "relógio que corre de graça" — são
relógio que **bloqueia o lançamento** se estiver no caminho crítico. Fora dele,
viram o que devem ser: uma etapa que acontece enquanto mães já usam e já pagam.

**Por que a PWA aguenta ir sozinha até o fim:** ela está no ar, cobra sem
intermediário (abaixo), entrega push em iOS instalado, e é onde `expo export
--platform web` valida build desde o começo do projeto.

**Por que nativo ainda entra, só que depois:** descoberta em loja — é de lá que
vieram os 50 mil downloads do Blumy — e as integrações de sistema que a web não
tem (mais abaixo). Nada disso é pré-requisito para cobrar.

### Cobrança em PWA: o que muda

**A PWA cobra por Stripe direto, e a Apple não entra na conta.** Isso não é
contorno de regra: as regras da App Store valem para o que é vendido *dentro de
um app da loja*. Um site não é isso.

O que essa diferença vale, sobre uma assinatura de R$24,90:

| | Web (Stripe) | App Store |
|---|---:|---:|
| Taxa | ~4,4% (3,99% + 0,4% de recorrência) | 15% (Small Business) |
| Custo por assinante/mês | ~R$ 1,10 | ~R$ 3,74 |
| Revisão para lançar | nenhuma | 1 a 7 dias, com rejeição provável |
| Custo fixo anual | zero | US$ 99 |

São **R$ 2,64 por assinante por mês** de diferença, e — mais importante que o
dinheiro — **zero dependência de aprovação para começar a cobrar**.

**Pix fica para depois, e por um motivo concreto:** na Stripe ele está
[disponível apenas para empresas convidadas](https://stripe.com/br/payment-method/pix).
Pix é mais de 40% das transações online no Brasil, então isso é uma perda real
de conversão — mas não é bloqueio. Cartão recorrente funciona hoje; Pix entra
quando houver acesso, ou por outro provedor (Mercado Pago, Pagar.me, Asaas) se a
conversão pedir. **Pix Automático** (recorrência nativa em Pix) está chegando ao
mercado em 2026 e vale reavaliar então — não vale esperar.

**RevenueCat sai do caminho crítico.** O `CLAUDE.md` o escolheu para resolver
"Stripe puro não serve para assinatura dentro do app iOS", e isso continua
verdade — **para o app iOS**, que agora é o último bloco. Para a PWA, Stripe
Billing direto é menos peça e menos abstração. RevenueCat volta à mesa quando o
nativo entrar, e hoje ele também cobre web, então dá para unificar depois sem
refazer.

**E o nativo herda a cobrança da web, em vez de reabri-la.** O padrão é o de
Netflix e Spotify: assina no site, entra no app. O app da loja não vende nada,
então a exigência de IAP não se aplica. O custo desse padrão é real e precisa
ser planejado: na maior parte das jurisdições, a Apple proíbe o app de **linkar
ou mencionar** a compra externa — a tela de assinatura vira "entre com sua
conta", sem explicar onde assinar.

### O que é tecnicamente impossível em PWA

Não "pior": inexistente. Nenhum truque de front-end resolve — não há API.

1. **Live Activity / Dynamic Island.** O cronômetro de sono correndo na tela de
   bloqueio. É a perda mais dolorosa para este produto em particular: "Dormindo
   há 40 min" visível sem abrir nada é exatamente o que uma mãe quer às 3h.
2. **Widgets** de tela inicial ou de bloqueio.
3. **Apple Health / Health Connect.** Nenhuma leitura ou escrita de peso, altura
   ou sono no repositório de saúde do sistema.
4. **Siri e Atalhos** — "Ei Siri, registrar mamada". O mesmo para App Actions no
   Android.
5. **Web Bluetooth no iOS.** O Safari não implementa. Balança inteligente, berço
   conectado ou qualquer periférico ficam de fora no iPhone (no Android Chrome
   funcionam).
6. **Notificação local agendada.** Sem `Background Sync` e sem execução em
   segundo plano no iOS, **toda** notificação precisa partir do servidor. Isso
   não impede o bloco 3.2 — ele já foi desenhado com agendador — mas elimina o
   lembrete que dispara sem rede.
7. **Push sem instalar.** Continua exigindo "Adicionar à Tela de Início", que é
   o R1 inteiro.
8. **Share Target** — receber conteúdo compartilhado de outros apps no iOS.

Os itens 1, 3 e 5 são os que um dia justificam o nativo sozinhos. Nenhum deles
justifica atrasar cobrança.

**O que nativo custa — o código é o barato:**

| Item | Trabalho | Relógio |
|---|---|---|
| Conta Apple Developer (US$99/ano) | 1h | **dias a semanas** |
| Conta Google Play (US$25) | 1h | dias |
| `eas.json`, IDs, ícones e splash nativos | 2 dias | — |
| Primeiro build EAS que passa | 2–4 dias | — |
| RevenueCat + produtos nas duas lojas | 4 dias | dias |
| Privacy labels / Data Safety — dado de saúde de criança | 2 dias | — |
| TestFlight | 1 dia | 1–2 dias por build |
| **Primeira revisão da App Store** | — | **1 a 7 dias, e a primeira costuma ser rejeitada** |

**Total isolado: 2–3 semanas de trabalho + 1–3 semanas de relógio**, quase todo
de terceiro. Comece a conta da Apple assim que possível — é relógio puro e não
custa nada deixar correndo em paralelo.

---

## 7. Cronograma

**A ordem mudou duas vezes, e por razões diferentes.** Primeiro a tese subiu o
assistente de último para primeiro. Agora o canal nativo desce de segundo para
último: o que não se controla sai do caminho crítico.

| # | Bloco | Trabalho | Relógio | Por que aqui |
|---|---|---:|---:|---|
| 0 | Fechar o que está aberto | 1 sem | DNS | Semeador, SMTP (§11.2), projeto antigo, tela do assistente |
| 1 | **Cobrança por Stripe** | 1 sem | — | O assistente tem custo marginal; cada dia grátis no ar é dinheiro saindo |
| 1c | **Virada para a conta live** | 1 dia | ⚠️ **aprovado em 12/08/2026, com pendência de conta em aberto** | Não é meio dia nem é "trocar de modo": troca de CONTA — detalhe abaixo |
| 1b | Painel de afiliadas (§3.5) | 1,5–2 sem | — | ✅ **etapas 1–4 provadas ponta a ponta em 12/08/2026** (link → comissão → painel). Falta a etapa 5, o saque — ver abaixo |
| 2 | Refatorar registro (schema-driven) | 1,5 sem | — | Bloqueia o bloco 3 e paga a si mesmo no quinto tipo |
| 3 | ~~Monitoramento ampliado~~ | — | — | ✅ **FEITO em 11–12/08/2026.** 19 tipos no ar e conferidos no navegador. Falta Habilidade, que não é o último da fila — ver o fim do §3.4 |
| 4 | Notificações (Web Push) | 2–3 sem | 1 sem | Funciona em PWA instalada; o agendador é o mesmo que o nativo usaria |
| 5 | Previsões | 2–3 sem | 4+ sem | Precisa do histórico acumulado pelos blocos 2–3 para o backtesting ter o que testar |
| 6 | **Canal nativo** | 2–3 sem | 1–3 sem | Último, e em paralelo a mães já usando e já pagando |

**PWA completa e cobrando: ~12 semanas**, ou ~14 com o painel de afiliadas.
Cobrando a partir da **semana 2**.

O nativo soma 2–3 semanas de trabalho depois disso, mas o relógio dele deixa de
importar — ninguém fica esperando.

### ⚠️ ONDE A COBRANÇA MORA HOJE: um SANDBOX, que não é o modo teste da conta

Descoberto em 12/08/2026. **Custou uma hora**, com o app funcionando o tempo
todo — e o sintoma foi o pior tipo: o painel abre, responde, e mostra "Adicione
seu primeiro cliente de teste", como se o checkout nunca tivesse rodado.

| Onde | Id da conta | O que tem |
|---|---|---|
| **Sandbox "Área restrita de ninna"** | `acct_1U3FllPcpMk0DJ4d` | **tudo**: produtos, os dois preços, o endpoint `ninna-assinaturas`, os clientes |
| Conta `ninna`, modo teste | `acct_1U3FlcB5ktEdfFnD` | **nada**: zero clientes, zero produtos, zero endpoints |
| Conta `ninna`, modo live | o mesmo `acct_1U3FlcB5ktEdfFnD` | a conta de verdade, ainda por montar |

**Os dois ids diferem numa letra só, depois de `1U3Fl`** — o sandbox tem `ll`, a
conta tem `lc`. Lidos rápido, são o mesmo id. Foi exatamente isso que custou a
hora: a `STRIPE_API_KEY` sempre apontou para o sandbox, e a tela aberta era a da
conta.

**Como conferir sem depender de tela** — a chave carrega o id dentro dela:

```
sk_test_51 U3FllPcpMk0DJ4d ...   →   acct_1U3FllPcpMk0DJ4d
           └──── o id ────┘
```

Se o id embutido na chave não for o id na URL do painel, você está olhando o
lugar errado. É a regra nº 1 do `CLAUDE.md` aplicada à Stripe: **confere pelo
servidor, não pela tela.** E o comando que fecha a dúvida em um passo:

```
curl.exe -s https://api.stripe.com/v1/account -u "<chave>:"
```

Ele devolve o `id` e o `settings.dashboard.display_name` da conta a que a chave
pertence. Não há como discordar disso.

### ⚠️ Bloco 1c — APROVADO em 12/08/2026, com pendência de conta em aberto

**Aprovado no mesmo dia do envio.** Categoria **Software**, descrição como SaaS
de assinatura para acompanhamento de rotina de bebês — **sem linguagem de
saúde**, que era a redação certa: descrever o produto como saúde convida uma
análise mais longa e uma categoria de risco que a Ninna não é.

O que a Stripe devolve sobre a conta:

```
charges_enabled: true · payouts_enabled: true · details_submitted: true
capabilities: card_payments, boleto_payments, transfers — todas active
country BR · default_currency brl · statement_descriptor "NINNA BR"
repasse: daily, delay_days 30
```

**Mas não está liberado.** O painel mostra uma faixa vermelha:

> Vários recursos pausados — Uma tarefa obrigatória está vencida. Conclua-a para
> habilitar os recursos de sua conta.

Enquanto essa tarefa não for concluída, "aprovado" não quer dizer "cobra". O que
ela pede ainda não foi lido.

Dois detalhes que vieram junto e mudam decisão: **boleto está ativo** (o checkout
não oferece — é decisão em aberto, não limitação), e o **repasse tem 30 dias de
atraso**, o que por acaso empata com a carência da afiliada (`010`).

#### ⚠️ A virada troca de CONTA, não de modo

Este bloco dizia *"recriar produto e preços em modo live"*, assumindo que era o
mesmo lugar mudando de chave. **É premissa errada**, e a tabela acima explica por
quê: sandbox e conta são ambientes separados, com dados, chaves e endpoints
próprios. O modo teste da conta de verdade **nunca foi montado** — não há de onde
copiar "só mudando o modo".

Por isso o relógio subiu de 0,5 para 1 dia. **O que falta:**

1. **Concluir a tarefa vencida da conta** — é o único item com relógio de
   terceiro, e é o que decide se o resto adianta;
2. **Recriar produto e preços na conta `ninna`.** Vale a pena montar o **modo
   teste dela primeiro** e repetir o teste ponta a ponta lá, antes do live: é o
   ensaio que separa "o preço novo está errado" de "o live está errado". Os
   `price_id` entram por secret, não por commit — eles saíram do código de
   propósito, e é isso que faz a virada não ser um deploy;
3. **Criar o endpoint de webhook**, com os mesmos **6 eventos** — os 5 de
   assinatura mais `invoice.paid`, que entrou em 12/08/2026 com a comissão de
   afiliadas. O `whsec_` é outro: o do sandbox não atende ninguém fora dele;
4. **Trocar os quatro secrets no Supabase** — e conferir com
   `npx supabase secrets list`, não pela tela. O digest ali é SHA-256 do valor,
   então dá para provar que a chave trocada é a chave certa sem lê-la;
5. **Conferir a primeira fatura em BRL** — moeda, imposto e o descritivo que
   aparece na fatura do cartão dela. Descritivo errado vira contestação, e
   contestação de R$24,90 custa mais que R$24,90.

Os meios de pagamento são configuração por ambiente; Pix entra sem tocar em
código, porque `payment_method_types` ficou de fora de propósito (ver o
comentário na `assinatura/index.ts`).

**Enquanto isso, nada bloqueia.** O app segue cobrando no sandbox, e o único
custo de demorar é o assistente rodando sem receita.

### Bloco 1c — por que a virada tem linha própria na tabela

*A lista do que falta está acima. Aqui fica só o argumento de por que ela existe
separada — que é o que some primeiro quando a fila é lida com pressa.*

Meio dia de trabalho não mereceria uma linha. Este merece, e a razão é a mesma do
D3: **item pequeno que não tem data some da fila**, e reaparece no pior dia
possível. O D3b — o e-mail — ficou aberto desde o começo por exatamente isso.

E o argumento ficou mais forte em 12/08/2026, não mais fraco. A estimativa de
meio dia dizia "trocar quatro secrets" porque assumia que virar era trocar de
**modo** dentro da mesma conta. Não é: tudo roda num **sandbox**, e a conta de
verdade está vazia. O item parecia pequeno porque estava mal entendido — que é
precisamente como item pequeno some da fila e volta grande.

**Fazer isto no dia do lançamento é o erro.** Se a tarefa vencida da conta travar,
o lançamento trava junto — e aí a pressa leva ao atalho, que é ir ao ar apontando
para o sandbox "só pra ver": cobrando ninguém, e parecendo que cobra.

**Uma consequência de calendário que vale explicitar:** a conta Apple custa
US$99/ano e o relógio começa na compra, não no uso. Abri-la três meses antes do
bloco 6 desperdiça um quarto dela. Comprar quando o bloco 6 começar.

**Três avisos que continuam valendo:** o bloco 7 tem relógio irredutível
(backtesting precisa de semanas de dado real); a velocidade do beta não se
repete; e a estimativa não inclui suporte, bug de produção e a próxima ideia —
que é o que o `BETA.md` inteiro existia para conter.

---

## 8. O que o beta atual vira

**O ambiente de qualidade da tese.** Nem descartado, nem "fase 1".

Morre: o prazo de 21 dias e a data de 25/08; a fila P8–P13 e os degraus de corte;
o beta como validação de demanda — o mercado já respondeu.

Sobrevive, e vale mais agora do que valia:

- **as regras travadas**, que são a tese escrita antes de ter nome: nunca compara
  bebês, silêncio honesto, copy de saúde, substantivo em vez de adjetivo;
- **os testes que as defendem** — e eles ganham um irmão: uma varredura de
  "linguagem de média" no molde do `teste-copy-telas.ts`, em duas famílias:
  conteúdo populacional (`bebês de X meses`, `para a idade`, `média para a
  idade`) e julgamento sobre referência (`abaixo/acima do esperado`, `adequado`,
  `percentil`). Ela varre **texto**, não rótulo de gráfico — "referência OMS" num
  eixo é o uso permitido do §0. Se a tese é o produto, ela merece o mesmo tipo de
  teste que o gênero tem;
- **os §11.x como procedimento permanente**, não checklist de piloto;
- **o `BETA.md` como registro.** Perde precedência sobre o `CLAUDE.md`; vira
  histórico do raciocínio por trás de cada decisão travada.

**Sobre a E1:** recomendo manter uma usuária real, e só uma, com escopo mudado.
Ela deixa de validar demanda e passa a ser a única fonte de histórico real — que
é o que destrava o backtesting da previsão meses antes, e o que testa o
assistente ancorado contra perguntas que ninguém consegue inventar de cabeça.

Se ela continuar, três coisas mudam já:

1. **O termo vira versão 2 e o aceite é recolhido de novo.** A versão 1 promete
   apagar tudo em 25/08 por padrão, e isso deixou de ser verdade — é a regra que
   está escrita em `docs/embaixadora/README.md`;
2. o prazo de exclusão de 2 dias continua, agora sem data de fim;
3. **§11.4 continua bloqueando** — o `teste-rls-delete.mjs` segue preso no
   autoconfirm, e com mais tabelas chegando ele fica mais necessário, não menos.

---

## 8-bis. SQL de migração vence — e o vencimento nasce com o arquivo

**Registrado em 12/08/2026, depois de dois arquivos vencerem em três dias.**

SQL de migração é escrito para um **estado do banco**, não para o banco. Quando o
estado muda, o arquivo não deixa de funcionar — ele passa a fazer a coisa errada
com sucesso. E é isso que o torna perigoso: um script que quebra manda um erro,
um script vencido devolve `INSERT 0 5` e vai embora.

Os dois casos, e eles falham em direções opostas:

| Arquivo | O que fazia | O que passou a fazer |
|---|---|---|
| `reversao/passo-4-…` | Devolvia registros de `registros` para as cinco tabelas antigas | Deixava para trás, **em silêncio**, todo Banho, Passeio, Leitura e Atividade — tipos sem tabela antiga para onde voltar |
| `backfill/passo-3-…` | Copiava das antigas para `registros`, com `do update` para recolher edições | **Desfazia** toda edição feita em `registros` desde a virada, reescrevendo com dado velho |

O primeiro perdia registro novo; o segundo destrói registro existente. Nenhum dos
dois emite erro.

### A regra

> **Todo SQL escrito para um estado do banco nasce com prazo de validade, no
> mesmo commit em que é escrito — com DATA e com GATILHO, os dois.**

**Data** porque o gatilho pode não ser notado. **Gatilho** porque a data quase
sempre é generosa demais: a reversão tinha prazo até 25/08 e venceu em 12/08, no
dia em que o primeiro tipo novo subiu — treze dias antes, e foi o gatilho que
disparou.

**No dia, apagar. Não renomear.** Uma pasta chamada `reversao-vencida-em-…`
continua sendo uma pasta chamada `reversao` para quem está com pressa às 3h da
manhã, que é exatamente a pessoa que a abriria. O histórico do git é onde
arquivo de emergência vencido deve morar: perto de quem procura, longe de quem
tem pressa.

**E cuidado com o par.** O `backfill/passo-4` era inócuo — rodá-lo hoje não faria
nada. Isso quase o salvou da lista, e é justamente o argumento contra: os dois
tinham nome de par, e quem roda um tende a rodar o outro. Arquivo inofensivo ao
lado de arquivo perigoso é um convite, não uma exceção.

**O que NÃO vence:** a `005_registros.sql`, porque ela descreve um evento que
aconteceu uma vez, e o arquivo gerado de restrições, porque ele descreve o
**estado desejado** e é idempotente. A diferença é essa: SQL que descreve uma
transição vence; SQL que descreve um estado, não.

---

## 9. Riscos

| # | Risco | Estado | Mitigação |
|---|---|---|---|
| N1 | Custo por usuária do assistente | **Reduzido** pela ancoragem (R$5,30/mês no Desenho B com Opus 5) | Limite diário desde o dia 1; Desenho B como padrão |
| N2 | Assistente responde sobre saúde | **Resolvido pela arquitetura** — não existe consulta que responda | Validador de ancoragem + resposta fixa de fora-de-escopo |
| N3 | Rejeição na App Store | **Reduzido** — assistente que só lê dado da própria usuária é defensável | Recusa de saúde implementada antes de submeter |
| N4 | Previsão lida como prescrição | Aberto | Faixa em vez de ponto; backtesting antes de publicar |
| N5 | Notificação vira interrupção | **Reduzido** — sem avisos genéricos, sobra pouco para incomodar | Só notifica com lastro no padrão dela; regra de horário |
| N6 | Escopo aberto | Aberto | Este documento é a nova fonte de escopo — e precisa de uma seção "Depois da v1" que seja respeitada |
| N7 | Dose de medicação errada | Aberto | Confirmação em duas etapas; histórico não editável |
| **N8** | **Deriva da tese** — uma frase de média entra "só dessa vez" | **Novo, e é o principal** | Varredura automatizada de linguagem de média, no molde dos testes que já existem |
| **N9** | **Referência clínica virando frase** — a curva rotulada é permitida (§0); narrá-la não é | **Novo** (§3.4) | Varredura de palavra de julgamento (*abaixo/acima/esperado/adequado/percentil*) no texto sobre crescimento |
| **N10** | **Ponto de equilíbrio em ~20–30 assinantes** | **Novo** (§5) | Saber disso antes; não confundir prejuízo inicial com produto ruim |

---

## 10. O que eu recomendo

1. **Fechar o aberto e cobrar pela PWA.** ~2 semanas até o assistente no ar com
   assinatura por Stripe, sem depender de aprovação de ninguém;
2. **NÃO abra a conta da Apple ainda.** A recomendação anterior era o contrário,
   e estava errada: US$99/ano começam a contar na compra, e o bloco nativo é o
   último. Abrir agora desperdiça um quarto da anuidade esperando;
3. **Desenho B do assistente** (motor responde, `copyInsight.ts` narra, modelo só
   interpreta a pergunta). É o que faz o plano anual fechar — e permite usar o
   modelo mais capaz por menos do que o mais barato custava no chat aberto;
4. **Escreva a varredura de linguagem de média junto com o bloco 1**, não depois,
   nas duas famílias do §8 — conteúdo populacional e julgamento sobre referência.
   A segunda importa mais desde que a curva foi permitida: é a fronteira do §0
   virando teste. A tese só sobrevive se algo automatizado a defender — é a lição
   do `teste-copy-telas.ts`, que só existiu depois de uma violação ir a produção;
5. **Mantenha uma usuária real** com termo versão 2.

**Não recomendo:**

1. **Os quatro blocos em paralelo.** Dois são dominados por risco de produto, e
   risco de produto não se resolve com mais frentes abertas;
2. **Estatística populacional na janela fria** (§4). É a primeira impressão, e é
   onde a diferenciação é julgada;
3. **Previsão sem backtesting.** A forma mais rápida de gastar a confiança que o
   insight construiu;
4. **Narrar a curva de crescimento.** Desenhar a referência da OMS é permitido e
   esperado (§0); escrever "a Liz está abaixo do esperado" é o oposto do produto,
   e a distância entre as duas coisas é de uma linha de código;
5. **Abandonar a disciplina do `BETA.md` junto com o cronograma dele.** O que fez
   o beta funcionar não foi o prazo — foi o escopo travado e o hábito de escrever
   por que cada decisão foi tomada.

---

## 11. O que eu preciso de você

1. **Existe camada gratuita?** Registro grátis + assistente pago é o desenho que
   melhor casa com a tese, mas é decisão de negócio (§5);
2. **A E1 continua?** Decide se `docs/embaixadora/` vira versão 2 ou vai para
   arquivo — e ela é a única fonte de histórico real para o bloco 7;
3. **Qual é a v1?** ~7 semanas (assistente + loja + assinatura) ou 4–6 meses (os
   quatro blocos). As duas respostas são legítimas; só não podem ser a mesma;
4. ~~**A tese vale mesmo quando dói?**~~ — **respondida em 06/08/2026.** "Isso é
   normal?" continua sem resposta, por regra de segurança já travada (§4). E a
   curva de crescimento **não** era o dilema que eu tinha descrito: a distinção
   entre conteúdo e referência clínica rotulada resolve o caso e está no §0, como
   parte da tese e não como exceção — exatamente para o N8 não usar o percentil
   como precedente.
