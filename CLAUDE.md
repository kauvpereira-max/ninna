@AGENTS.md

# Ninna — contexto do projeto

App de acompanhamento de rotina de bebê para mães de primeira viagem. Concorrente
de referência: **Blumy** — PT-BR nativo, R$24,90/mês, 50 mil downloads desde
10/2025.

## A tese, que é o produto inteiro

> **Tudo que a Ninna diz sai dos registros daquele bebê.**
> A comparação é da Liz com a Liz, nunca da Liz com a média.

O concorrente fala estatística populacional com o nome do bebê colado por cima —
"bebês nessa idade costumam dormir X". Soa personalizado e não é, e a mãe percebe
porque o número não bate com a filha dela.

Isso não é uma aspiração: é o que o código faz e o que os testes defendem. Antes
de escrever qualquer frase que a mãe leia, o teste é sempre o mesmo:

> A frase fala do bebê dela, ou fala de uma média com o nome dela colado?

**A única exceção, e ela é parte da regra, não ressalva:** referência clínica
**rotulada** é permitida — a curva da OMS tracejada atrás da linha do bebê, como
na caderneta. Ela é *desenhada, nunca narrada*; sempre atribuída à fonte; a Ninna
não deriva conclusão dela (nada de percentil em texto, nem *abaixo*, *acima*,
*esperado*, *adequado*); e vale só onde a referência já faz parte do cuidado
formal — crescimento e vacina, nunca sono ou mamada. Detalhe em `PRODUTO.md` §0.

## ⚠️ A fonte de escopo é o `PRODUTO.md`, não o `BETA.md`

O beta fechado de 21 dias **acabou como desenho**. O mercado validou a categoria
e o piloto deixou de ser validação de demanda.

- **`PRODUTO.md`** — fonte de escopo vigente. A fila de trabalho está no §7.
- **`BETA.md`** — histórico. Perdeu precedência, mas **as regras travadas dele
  continuam valendo**: tom de voz, copy de saúde, silêncio honesto, e os §11.x
  como procedimento permanente (rodar `teste-rls-delete.mjs` depois de qualquer
  mexida em policy, por exemplo).

Ordem atual, resumida: PWA inteira primeiro, canal nativo por último. Cobrança
por Stripe direto na web — sem taxa de loja e sem revisão.

## As regras que emergiram, e valem para qualquer sessão

Cada uma custou um incidente real. Estão aqui para não custar de novo. A 2b é
irmã da 2 — mesma família, ângulo diferente — e por isso não virou nº 4.

### 1. Configuração de painel se confere pelo servidor, nunca pela tela

Com as duas caixinhas marcadas no painel do Supabase, o servidor devolveu
`external.email: false` e `mailer_autoconfirm: false` — nada tinha sido salvo.
Sair da página sem clicar em **Save** descarta sem avisar. No projeto anterior o
mesmo item passou batido três vezes.

Antes de dar qualquer configuração de painel como feita:

```
curl.exe -s "https://<ref>.supabase.co/auth/v1/settings" -H "apikey: <anon>"
```

Vale para tudo que mora no painel e não no repositório: allow-list de redirect,
SMTP, secrets (`npx supabase secrets list`), migrations (consulta de conferência).

### 2. Teste que não falha quando o código quebra não é teste

Asserção **negativa** passa vazia quando a premissa some. Aconteceu duas vezes:

- o `teste-copy-telas` varreu 111 trechos achando que varria as telas — o
  extrator engolia código no ramo do JSX, e a violação real estava dentro do que
  ele pulava;
- o `teste-assistente` deu ok em "não avalia gravidade" e "não responde
  conhecimento geral" enquanto a função devolvia **a frase de erro** nas três
  perguntas. Nenhum texto proibido aparece numa mensagem de erro.

Duas consequências práticas, e as duas já estão no código:

- **toda varredura se prova antes de varrer** — casos que ela TEM que reprovar e
  casos que ela não pode confundir (`provarExtrator`, `DEVE_REPROVAR`,
  `DEVE_PASSAR`);
- **toda asserção sobre conteúdo confirma primeiro que houve conteúdo**
  (`respondeuDeVerdade` no `teste-assistente.mjs`).

### 2b. A variante: rigor no runtime errado não é cobertura

Um teste pode ser rigoroso, falhar de verdade quando o código quebra, e ainda
assim ser **estruturalmente cego** para a falha que chega — porque roda no lugar
errado.

O `teste-assistente.mjs` prova modelo, ancoragem e barreira de saúde com rigor.
Ele roda no Node, e **Node não faz preflight de CORS**. As funções `assinatura` e
`assistente` começavam com `if (req.method !== 'POST') return 405`, então
reprovavam o `OPTIONS` e o navegador cancelava o POST antes de enviá-lo. Do lado
da mãe: "não consegui abrir a tela de pagamento". Do lado do log: nenhum erro da
Stripe, porque o corpo da função nunca rodou — só `OPTIONS → 405` e nenhum POST.

Três perguntas, então, e não uma:

1. este teste falha quando o código quebra? (regra 2)
2. este teste roda onde a falha mora? (regra 2b)
3. este teste **roda**? (regra 2c)

O que a nº 2 cobre e a nº 1 não: CORS, service worker, `expo export` vs Metro,
iOS instalado vs aba do Safari, Deno vs Node. `expo export --platform web` já
está na lista de fechamento de bloco por essa razão — é o único que exercita o
empacotamento real.

Para as funções, a prova mora em `curl` contra o que está no ar, **com controle**:
preflight de origem conhecida volta 204 **com** `Allow-Origin`, e de origem
desconhecida volta 204 **sem** ele. Sem o segundo caso, `*` passaria pelo
primeiro e a lista de origens não estaria provada.

### 2c. A terceira irmã: teste que não roda também não defende nada

A 2 é sobre teste que passa vazio. A 2b é sobre teste rigoroso no runtime
errado. Esta é sobre o caso que não ocorre a ninguém, porque parece cedo demais
para dar errado: **o teste nem carrega.**

Em 12/08/2026, o `teste-registro-schema` estourava com `ERR_MODULE_NOT_FOUND`
antes da primeira asserção — e estava assim desde `ae86d1b`, quando o
`src/theme/categorias.ts` nasceu, no bloco 3. Duas causas empilhadas, as duas a
mesma convenção violada:

- `import { colors } from './tokens'`, sem a extensão `.ts` que Node e Deno
  exigem e só o Metro perdoa;
- `import { Ionicons }` como valor, arrastando o `@expo/vector-icons` inteiro
  para dentro do Node — quando ele só aparece em `keyof typeof
  Ionicons.glyphMap`, ou seja, posição de tipo. Virou `import type`.

O que torna isso diferente das outras duas: **o `tsc` passou o tempo todo**,
porque para o TypeScript `'./tokens'` resolve. E o `expo export` também, porque
o Metro resolve. Os três do fechamento de bloco existem justamente porque cada
um enxerga o que os outros não enxergam — e aqui só o segundo enxergou.

E o dano não é o teste quebrado: é que o `CLAUDE.md` afirmava, nesse período,
que aquele teste defendia "o que cada tipo pergunta, grava e mostra". A
afirmação esteve falsa por vários commits e ninguém tinha como saber.

> Suíte que não é rodada inteira não é suíte — é uma lista de arquivos.
> Rodar todos, e ler o resultado de cada um, faz parte de fechar bloco.

### 3. Push a cada bloco fechado, não acumulado

Dez commits ficaram parados localmente durante a migração. O sintoma apareceu
como "a aba nova não apareceu no app" — e o diagnóstico começou pelo lado errado
(build, cache) porque ninguém suspeita do óbvio.

`git push` faz parte de fechar um bloco, junto com `tsc`, os testes e o
`expo export`.

**E os três são um conjunto — nenhum substitui outro.** Um commit rodou os
testes e o deploy, pulou o `tsc`, e o tipo quebrado só apareceu **dois commits
depois**, num contexto que não tinha nada a ver. Cada um enxerga o que os outros
não enxergam:

- `tsc` — o que não compila em lugar nenhum;
- os testes — o que compila e responde a coisa errada;
- `expo export` — o que compila, responde certo, e não empacota.

"Os testes passaram" não é fechar bloco. Os três, sempre, e depois o push.

### 4. SQL de migração vence, e o vencimento nasce com o arquivo

Ele é escrito para um **estado do banco**. Quando o estado muda, o arquivo não
quebra — ele passa a fazer a coisa errada **com sucesso**, e some sem erro.

> Todo SQL escrito para um estado nasce com prazo, no mesmo commit — com **data**
> (o gatilho pode não ser notado) e **gatilho** (a data é sempre generosa demais).
> No dia, **apagar, não renomear**: `reversao-vencida-em-…` continua sendo
> `reversao` para quem está com pressa. O histórico do git basta.

Custou dois arquivos em três dias, falhando em direções opostas — um perdia
registro novo, o outro desfazia edição existente com dado velho. Os dois casos e
o corolário do "nome de par" estão no `PRODUTO.md` §8-bis.

**O que não vence:** SQL que descreve um ESTADO e é idempotente (o
`supabase/restricoes/registros.sql`). Só vence o que descreve uma transição.

## Onde está a fonte da verdade

> ### ⚠️ O protótipo vence — decidido em 13/08/2026
>
> `docs/design-do-prototipo.md` é a **autoridade visual**. Onde ele divergir do
> `tokens.ts` ou deste arquivo, **ele vence**.
>
> O procedimento não é seguir calado: **avise a divergência e siga o protótipo.**
> Pare e pergunte só se algo nele for impossível (a fonte não existe, o PNG não
> foi exportado) ou perigoso.
>
> Isso já mudou uma regra deste arquivo — a do coral, abaixo — e vai mudar
> outras. Regra de design que sobrevive a um protótipo novo por inércia é regra
> que ninguém reviu.

- **Design system:** `src/theme/tokens.ts` — os valores; a autoridade é o
  protótipo acima
- **Fontes:** Fredoka (títulos) e Nunito Sans (corpo), em `assets/fonts/`
- **Escopo e cronograma:** `PRODUTO.md`
- **Procedimentos de banco e painel:** `BETA.md` §11.x
- **Pacote da embaixadora:** `docs/embaixadora/`

## Decisões já tomadas — não reabrir sem necessidade

- **20 tipos de registro** — 19 no ar e CONFERIDOS NO NAVEGADOR em 12/08/2026
  (atalhos, tela "Mais", campo decimal com vírgula, confirmação da medicação,
  ausência do editar em saúde, e a frase de comparação de peso); falta só **Habilidade**,
  que não é o último da fila e sim decisão de produto em aberto (PRODUTO.md §3.4,
  "Habilidade — o tipo que ficou"): a LISTA de marcos é a norma, e mostrá-la é a
  comparação acontecendo sem o app escrever uma palavra. Os 20: Amamentação, Mamadeira,
  Fralda, Sono, Banho, Comida, Hidratação, Extração, Medicação, Vitamina,
  Sintoma, Humor, Peso, Altura, Circunferência, Atividade, Passeio, Leitura,
  Vacina, Habilidade
- **Vigilância se marca por BORDA E CHIP, nunca por superfície.**

  O estado de atenção é fundo claro `#FFF6F3` com borda `#E88A7D`, mais o chip
  pulsante. O card em repouso é `#FDF4F1` com borda `#EFD5CD`. **Não existe
  superfície escura no app.**

  Isso mudou em 13/08/2026, e a mudança é do protótipo. A redação anterior dizia
  que "coral + superfície escura" eram exclusivos do card de monitoramento — e o
  protótipo desenha esse mesmo card CLARO. Mantida a regra velha, ela ficaria
  sem sujeito: o único lugar que usava fundo escuro deixou de usá-lo.

  Consequência que foi executada junto, e não deixada para depois: os tokens
  `noiteBg`, `noiteSurface`, `noiteTexto` e `noitePrimaria` saíram. Token sem
  consumidor é convite a alguém "aproveitar que já existe".

- **O coral tem dois papéis e dois hexes, e a regra é sobre o `#E15C42`.**

  `coral500` (`#E15C42`) é **vigilância**: timer correndo, alerta. Significa
  "está acontecendo agora", e por isso não entra em decoração nem em onboarding.

  `coralAcao` (`#F4796B`) é **ação**: o "+" do grid de atalhos. Outro hex, outro
  papel, escolha do designer — não é vigilância vazando para enfeite.

  A redação de antes proibia "coral em botão comum" e era ambígua nos dois
  sentidos: proibia o `#F4796B`, que o protótipo quer, e não cobria o timer
  correndo, que É vigilância num botão.
- A aba Ninna é item **igual aos outros** na tab bar — mesmo tamanho, mesma
  linha. Nunca botão flutuante elevado com `position: absolute` (bug já
  corrigido antes)
- **Cobrança:** Stripe direto na PWA (~4,4%, sem revisão de loja). RevenueCat
  continua sendo a resposta certa **para venda dentro do app iOS**, que é o
  último bloco — quando o nativo entrar, ele herda a assinatura da web em vez de
  reabri-la (padrão Netflix/Spotify)
- Tom de voz: acolhedor, nunca clínico, nunca compara bebês, nunca usa culpa

## Status atual

**Em produção:** `ninna-sigma.vercel.app`, PWA instalável, falando com o projeto
Supabase `hzjcimgutccsfrxuuhrl` em **sa-east-1 (São Paulo)**.

⚠️ **A cobrança roda num SANDBOX da Stripe, não no modo teste da conta.** O
sandbox "Área restrita de ninna" é `acct_1U3FllPcpMk0DJ4d`; a conta `ninna` é
`acct_1U3FlcB5ktEdfFnD` e o modo teste dela está **vazio**. Os ids diferem numa
letra depois de `1U3Fl` — o sandbox tem `ll`, a conta tem `lc` —, e olhar o lugar
errado custou uma hora em
12/08/2026 — o painel abre, funciona, e diz "adicione seu primeiro cliente". A
chave carrega o id: `sk_test_51<ID>…` → `acct_1<ID>`.

E o corolário, que custou um registro errado no mesmo dia: **pendência de sandbox
não é pendência de conta.** A faixa vermelha "Vários recursos pausados" era do
sandbox, pedindo o representante fictício que a própria Stripe preenche
("Mark Andrews"); a conta real mostra 0 ação necessária. As duas telas são quase
idênticas — mesmo layout, mesma faixa, mesma cor —, e a **única** diferença
confiável é o `acct_` na URL. Detalhe no `PRODUTO.md` §7, "Onde a cobrança mora
hoje".

### O motor e a copy — o núcleo da tese

- `src/lib/padroes.ts` — três métricas sobre *este* bebê: intervalo entre
  mamadas, duração e horário médio da soneca. Média **circular** (23h e 1h dão
  0h, não meio-dia), soneca separada de noite (início entre 19h e 6h = noite), e
  hora local sempre, com fuso por parâmetro. Três estados de confiança:
  `suficiente`, `insuficiente` e `nao_se_aplica` — este último é métrica que a
  conta acerta e que **não descreve nada** (sonecas às 9h, 13h e 16h30 têm média
  em meio-dia e meia, hora em que o bebê não dorme). Ela sai de cena em silêncio,
  sem virar frase de aprendizado.
- `src/lib/copyInsight.ts` — número vira frase. Cobre o card **e** as respostas
  do assistente (recall, contagem, comparação). Sem adjetivo avaliativo, sem
  gênero, sem linguagem de painel. A faixa de confiança muda o *hedge*, não o
  conteúdo.

### O assistente ancorado

Não é chat sobre bebês: é **linguagem natural sobre os registros dela**. A
pergunta vira consulta; o motor devolve número; a frase sai do `copyInsight.ts`.
O modelo faz **uma** coisa — escolher a consulta.

- `src/lib/consultas.ts` — a superfície: 7 consultas em 6 famílias, cada uma
  declarando no manifesto `SUPERFICIE` o que responde, o que exige e o que faz
  sem dado. `interpretar()` é a fronteira: o que não couber exatamente na união
  de tipos não vira consulta. `gramaticaParaModelo()` gera prompt e schema daqui,
  para gramática e superfície não divergirem.
- `src/lib/ancoragem.ts` — prova que a frase não inventou magnitude: gera as
  formas em que cada número pode aparecer escrito, remove todas do texto, e
  reprova se sobrar algarismo ou palavra de número. Valida **magnitude, não
  rótulo**.
- `supabase/functions/assistente/index.ts` — Edge Function. A chave da API mora
  lá, nunca no bundle; os registros são lidos com o **JWT dela**, então a RLS
  vale dentro da função; e o teto diário é escrito com `service_role`, sem policy
  de insert, para o cliente não zerar o próprio contador.
- `app/(tabs)/ninna.tsx` — a tela. A conversa **não é guardada**, e isso é
  arquitetura: o servidor manda ao modelo só a pergunta, nunca o histórico.

**A barreira de saúde é estrutural, não exortativa.** "38,5 e não mama, o que eu
faço?" não vira consulta porque **não existe** `avaliarGravidade()`. A pergunta
cai em `fora_de_escopo` e recebe texto fixo. Verificado ponta a ponta contra o
modelo real, e o `teste-assistente.mjs` confere isso a cada rodada.

Modelo: `claude-opus-5`, `effort: low`, pensamento ligado. `fallbacks` **não** é
usado de propósito — recusa aqui é o desfecho desejado, e rotear para outro
modelo seria procurar quem responda o que a Ninna decidiu não responder.

### Os 6 registros, o seletor de bebê e a autenticação

- `app/registro/[tipo].tsx` — rota única, modal, criar e editar (`?id=`).
  Registrar é ação de segundos
- `src/lib/registroSchema.ts` — a declaração de cada tipo num lugar só: campos,
  validação, resumo e detalhe. É dele que sai a migration `005`
- `src/lib/registros.ts` — escrita e leitura de `registros`, a tabela única, e o
  vocabulário fechado (`HUMORES`, `MOTIVOS_HUMOR`, `SINTOMAS`, `INTENSIDADES`):
  a mãe toca rótulo PT-BR, o banco recebe slug
- `app/bebes/` — seletor com bebê ativo persistido em AsyncStorage
- `(auth)` completo, incluindo reset de senha
- Roteamento em 3 vias no `app/_layout.tsx`: sem sessão → `(auth)`; com sessão e
  sem bebê → `(onboarding)`; com os dois → `(tabs)`

### Banco

Cinco migrations, todas aplicadas e conferidas no projeto de São Paulo:

- `001` — 7 tabelas com RLS
- `002` — cascata de exclusão. **8 chaves** em `CASCADE` (as 7 dela mais a da
  `003`). É o que faz a promessa de exclusão do termo LGPD ser executável
- `003` — `assistant_usage`, o teto diário do assistente
- `004` — `assinaturas`
- `005` — **`registros`**, a tabela de eventos: uma linha por registro, o que
  varia por tipo mora em `dados` (jsonb). É **gerada** do `registroSchema.ts`
  por `scripts/gerar-registros-sql.ts` — o vocabulário tem uma origem só

**As 5 tabelas antigas ainda existem, e o app não as toca desde 11/08/2026.** As
97 linhas foram copiadas para `registros` (passo 3), e o `drop` é uma migration
própria, `006`, dias depois — nunca no mesmo dia. O plano inteiro, incluindo o
que foi apagado e por quê: `docs/plano-migracao-registros.md`.

## Os testes, e o que cada um defende

Todos puros, rodando no Node sem banco — exceto os quatro últimos:

- `teste-padroes.ts` — o motor, incluindo 3 mutações que **têm** que quebrar
- `teste-copy-insight.ts` — toda frase possível do card contra 9 proibições
- `teste-copy-telas.ts` — varredura de **gênero** em toda a copy do app
- `teste-linguagem-media.ts` — varredura da **tese**: conteúdo populacional e
  julgamento sobre referência. É o risco N8, a deriva
- `teste-copy-saude.ts` — as duas frases de saúde: uma promessa, duas aberturas
- `teste-consultas.ts` — superfície, ancoragem, narração e gramática
- `teste-registro-schema.ts` — o que cada tipo pergunta, grava e mostra; e onde
  cada campo vai parar (coluna de verdade ou chave do `dados`)
- `teste-registros-sql.ts` — reprova se a `005` divergir do gerador
- `teste-horario.ts`, `teste-paginacao.ts`
- `teste-rls-delete.mjs` — contra o banco real. Prova que A não apaga registro de
  B, e que medicação recusa edição no banco (gatilho da `007`) enquanto fralda
  continua editável — o controle que impede um gatilho genérico de quebrar o
  encerrar sono. **Obrigatório depois de qualquer mexida em policy ou gatilho**
- `teste-motor-banco.ts` — o motor contra a massa semeada
- `teste-lista-banco.ts` — a lista paginada contra o **PostgREST**, não contra um
  array. Metade do cursor desceu para o banco no bloco 3, e Node não tem
  PostgREST: é regra 2b. Cria o empate de instante que a massa não tem e apaga no
  `finally`
- `teste-assistente.mjs` — ponta a ponta contra a Edge Function e o modelo.
  **Custa dinheiro** (3 chamadas por rodada) e escreve em produção

`scripts/varredura.ts` é o extrator compartilhado das duas varreduras de copy —
duas cópias divergiriam na primeira correção que só uma recebesse.

## Convenções que valem para escrever código aqui

- **Módulo puro roda em três lugares**: app, Node dos testes e Deno da Edge
  Function. Por isso `consultas.ts` declara a união de tipos por conta própria em
  vez de importar de `registros.ts` — o empacotador do Supabase segue
  `import type` **antes** de apagá-lo, e subiu o `registros.ts` inteiro (com
  Supabase e AsyncStorage) para produção, com aviso em vez de erro. A trava
  contra deriva mora em `registros.ts`, que é o lado que pode importar os dois
- **Import de runtime dentro de `src/lib` leva extensão `.ts`** — Node e Deno
  exigem; o Metro aceita. `allowImportingTsExtensions` já está ligado
- Data e horário são **máscara** (`DD/MM/AAAA`, `HH:MM`), não picker nativo — o
  `@react-native-community/datetimepicker` quebra o `expo export --platform web`,
  que é como este projeto valida build
- `sex` é nullable: **nunca** artigo de gênero antes do nome ("a rotina de Liz",
  jamais "d{a/o} Liz"), nunca pronome sobre o bebê
- **Rótulo de estado é SUBSTANTIVO, nunca adjetivo flexionado**: "Agitação",
  nunca "agitado(a)". Mesma raiz da regra do `sex`
- **Coluna sem check não é convite a texto livre**: `symptom` aceita qualquer
  string no banco, mas o app só grava slug de `SINTOMAS`. Dado agregável é
  requisito do motor
- Slug aposentado continua com rótulo em `SINTOMAS_APOSENTADOS` — o banco não é
  reescrito, e registro antigo tem que seguir legível
- `src/types/database.ts` é escrito à mão — ao mexer numa migration, atualizar o
  tipo junto
- Função de `src/lib` **nunca joga exceção**: erro vira frase pronta para a mãe.
  A alternativa é tela vermelha às 3h da manhã
- Largura máxima de 480px, centralizada, em toda tela — sem isso a web estica de
  ponta a ponta

## Copy de saúde — regras travadas

Ao salvar QUALQUER sintoma, o app mostra uma linha e devolve a decisão para a
mãe:

> Anotado. Se você estiver preocupada, confie no seu instinto e fale com o
> pediatra. O Ninna acompanha, mas quem examina é ele.

**Os dois textos vivem em `src/lib/copySaude.ts`**, e a promessa que eles
compartilham é uma constante única:

> `DEVOLVE_A_DECISAO` — "Se você estiver preocupada, confie no seu instinto e
> fale com o pediatra."

As aberturas são diferentes de propósito, porque os momentos são: "Anotado."
confirma um registro; "Não consigo te ajudar com isso — eu só sei o que você
registrou." recusa. Texto único diria a coisa errada em um dos dois.

Antes disso eram dois literais soltos, já divergindo em "fale"/"fala" sem que
nada notasse. `scripts/teste-copy-saude.ts` guarda os dois: que ambos contenham
a promessa literalmente, que não virem o mesmo texto, e que nenhum cruze as
linhas abaixo.

O que essa copy **nunca** faz — vale para qualquer texto de saúde futuro:

- Nunca avalia gravidade e nunca sugere urgência ("procure agora", "corra")
- Nunca lista sinal de alarme, nunca cita temperatura, número ou faixa
- Nunca diz "provavelmente não é nada" nem "isso é normal"
- Não diagnostica, não tranquiliza e não alarma: registra, e quem decide é a mãe

## Próximos passos

**A fila está no `PRODUTO.md` §7.** Em resumo: cobrança por Stripe → painel de
afiliadas → refatorar registro (schema-driven) → os 14 tipos → notificações →
previsões → canal nativo.

## Dívidas conhecidas

- **§11.2 / D3b — fechado em 12/08/2026.** SMTP no ar pelo Resend, SPF e DKIM
  `PASS` lidos do cabeçalho entregue, DMARC publicado, e o link do reset abrindo
  `/nova-senha`. **O que sobra não é configuração:** domínio novo não tem
  reputação, e os primeiros envios podem cair no spam — a E1 precisa ser avisada
  de olhar o spam e marcar "não é spam". O R2 passa de aberto a mitigado
- `typography.caption` pede Medium (500), mas `NunitoSans-Medium.ttf` não está em
  `assets/fonts/` — está em Regular como paliativo
- `tokens.ts` cita `src/theme/fonts.ts`, que não existe (fontes carregam no
  `app/_layout.tsx`)
- As 5 tabelas antigas seguem no banco, vazias de uso mas cheias de dado, até a
  `006`. `supabase/reversao/` e `supabase/backfill/` **venceram em 12/08/2026**
  pelo gatilho do primeiro tipo novo em produção, e foram apagados — estão no
  histórico do git. Ver a regra 4 acima
- **O contador do sono pode não avançar sozinho na PWA instalada.** O limiar de
  2 min já foi corrigido (conta desde o primeiro minuto), o que encurta a janela
  de "parece travado". Sobra a hipótese do `setInterval` estrangulado pelo
  Safari, que nenhum teste de Node alcança — regra 2b. O procedimento de 3
  minutos que separa as duas está em `docs/teste-manual-tick-do-sono.md`
- **Onze imports relativos de runtime sem `.ts`** em `src/hooks/` e `src/lib/`
  (`useHistorico`, `usePadroes`, `useRegistrosRecentes`, `afiliadas`,
  `assinatura`, `assistente`, `babies`, `registros`). Não quebram nada hoje
  **porque esses módulos importam `./supabase`**, que arrasta AsyncStorage, e
  por isso nenhum teste do Node os carrega. É a mesma bomba da regra 2c com o
  pino no lugar: o dia em que alguém escrever um teste puro para `assinatura.ts`
  ou `afiliadas.ts`, ela vai parecer mistério novo em vez de dívida conhecida.
  Consertar é limpeza — commit separado, nunca de carona
- `padroes.ts` ainda chama os campos de entrada de `started_at`/`ended_at`, nomes
  das colunas que a `006` vai apagar. São o contrato do módulo puro, não do
  banco: `listarParaPadroes` e `consultas.ts` traduzem. Renomear é limpeza, e não
  se faz limpeza no mesmo commit que troca o banco de lugar
- Contas de teste vivem no banco de produção: `teste-rls-a/b@ninna-teste.dev`,
  `teste-assistente@ninna-teste.dev` e o bebê `TESTE-ASSISTENTE`. São
  reaproveitadas entre rodadas, de propósito
