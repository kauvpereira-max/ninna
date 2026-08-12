# Plano de migração — 5 tabelas → `registros`

**Decisão:** opção B, tomada em 11/08/2026 pelo argumento da reversibilidade
assimétrica. Alternativas e custos: `docs/decisao-tabela-de-registros.md`.

---

## O princípio que organiza tudo

**Nada é apagado até a verificação passar.** As 5 tabelas antigas continuam
intactas do primeiro ao último passo; `registros` nasce ao lado. O `drop` mora
numa migration própria, `006`, rodada dias depois — nunca no mesmo dia, nunca no
mesmo arquivo.

Isso torna quase todo o plano reversível por `drop table registros`, que não toca
em dado nenhum de mãe nenhuma.

---

## Passo 0 — pré-voo (feito em 11/08/2026)

### Volume real

| Tabela | Linhas | Período |
|---|---:|---|
| `feeding_records` | 43 | 05/08 – 11/08 |
| `sleep_records` | 25 | 05/08 – 11/08 |
| `diaper_records` | 24 | 05/08 – 11/08 |
| `mood_records` | 4 | 05/08 – 10/08 |
| `symptom_records` | 1 | 05/08 |
| **Total de registros** | **97** | |
| `babies` | 5 | (inclui os de teste) |

**A minha estimativa estava errada, e para menos.** Eu disse "centenas de
linhas"; são **97**, e a maior tabela tem 43. O erro é de uma ordem de grandeza —
o que **fortalece** o argumento do prazo em vez de enfraquecê-lo: o backfill é
instantâneo e cabe inteiro numa tela.

### Os dados existentes passam nos check novos?

Testado contra o banco real, uma consulta por restrição gerada:

```
0 · amamentar sem side          0 · mood fora do vocabulário
0 · mamadeira sem bottle_type   0 · probable_reason fora do vocabulário
0 · mamadeira sem amount_ml     0 · intensity fora do vocabulário
0 · amount_ml fora de 5..500    0 · symptom fora do vocabulário
0 · duration_seconds fora de 60..10800
0 · sono ainda aberto
```

**Zero violações.** Nenhuma linha existente seria recusada. Esta consulta é para
**rodar de novo** imediatamente antes do passo 3 — 97 linhas hoje não são as 97
linhas de amanhã, e um registro novo com `side` nulo faria o backfill parar no
meio.

**Duas colunas concentram o risco real:** `symptom` e `probable_reason` não têm
`check` na tabela antiga e passam a ter em `registros`. O caso concreto é o slug
aposentado `irritability` — ele existiu, `SINTOMAS_APOSENTADOS` guarda o rótulo
dele justamente para registro antigo seguir legível, e o vocabulário gerado da
005 o recusa. Se ele aparecer no pré-voo, a resposta **não** é apagar a linha: é
somar o valor ao vocabulário e regerar a migration.

---

## O que substitui os `check` de coluna

A pergunta era se a resposta honesta seria "nada substitui, a dívida fica". **Não
é.** Testado no Postgres do projeto, em sandbox derrubada em seguida:

| Garantia | Como | Testado |
|---|---|---|
| Vocabulário fechado | `check (tipo <> 'fralda' or dados->>'content' in (…))` | recusa com `23514` |
| Campo obrigatório | `check (tipo <> 'mamadeira' or dados ? 'amount_ml')` | recusa com `23514` |
| Faixa numérica | coluna `generated always as ((dados->>'amount_ml')::int) stored` + `check` | recusa com `23514` |
| Tipo numérico | a própria coluna gerada | recusa com `22P02` |

O que se perde de verdade é **menos** do que a proposta previa. Fica só uma
diferença de comportamento que vale registrar: número em formato errado é
recusado por **erro de cast** (`22P02`), não por violação de check (`23514`) — a
mensagem é mais feia, e o app nunca deve chegar lá, porque `linhaParaBanco`
produz número.

### E a divergência que isso reintroduziria

Escrever os `check` à mão devolveria o vocabulário a dois lugares — TypeScript e
SQL — exatamente o que o bloco 2 acabou de eliminar. Por isso:

- `scripts/gerar-registros-sql.ts` **gera** a migration a partir do `SCHEMAS`;
- `scripts/teste-registros-sql.ts` reprova se o arquivo divergir do gerador, e
  diz a linha e o comando para regerar.

Somar um humor sem regerar o SQL passa a quebrar o teste. É o mesmo mecanismo do
`gramaticaParaModelo()`, que gera o prompt do assistente a partir da superfície.

**Uma exceção deliberada:** campo com `quando` (o sintoma "Outro" exigindo
descrição) **não** vira check. Aquilo é regra de formulário, não invariante da
linha, e forçá-la no banco recusaria registro antigo legítimo.

---

## Os passos

### 1 · Criar a tabela — `005_registros.sql`

Roda no SQL Editor. Cria tabela vazia, RLS, policy, 3 índices e as restrições
geradas. **Não toca em nenhuma tabela existente.**

**Verificar** (a consulta está no rodapé da migration): `rls_ligada = true`,
`policies = 1`, `indices = 4`, e o número de `check` batendo com o gerado.

**Reverter:** `drop table registros;`

---

### 2 · Provar a RLS antes de qualquer dado entrar — ✅ feito em 11/08/2026

```
57/57 verificações passaram.
RLS correta em leitura, edição e exclusão — 8 casos sobre 7 tabelas.
registros: 0 linhas · nenhum bebê de teste deixado para trás
```

`teste-rls-delete.mjs` estendido para incluir `registros`, e rodado com a tabela
**vazia**. A ordem importa: RLS provada com dado dentro é RLS provada tarde
demais.

A lista de tabelas do teste passa a ser **derivada**, não escrita à mão — uma
lista manual erra junto com a migration que a esqueceu.

**Verificar:** a conta A não lê, não edita e não apaga registro da conta B — e a
conta B faz as três no que é dela, senão uma policy que negasse tudo a todos
passaria em todas as verificações negativas.

Três mudanças que ficaram no teste:

1. **Leitura vem antes de exclusão** na ordem das asserções, porque é o furo mais
   grave: apagar destrói uma linha, ler expõe a rotina de um bebê para um
   estranho. Com tabela única, expõe o diário inteiro.
2. **A lista de tabelas é lida das migrations**, não escrita à mão — e a
   cobertura virou asserção. Tabela nova com `baby_id` que ninguém acrescentou
   aos casos reprova o teste, porque é exatamente a que estaria sem RLS.
3. **`baby_patterns` entrou.** A varredura derivada o encontrou; deixá-lo de fora
   exigiria uma lista de exceções, que é a lista manual voltando pela porta dos
   fundos. Ele declara a própria chave primária (`baby_id`, não `id`), e o laço
   continua sem conhecer tabela nenhuma.

**Reverter:** nada a reverter; nenhum dado foi escrito.

---

### 3 · Backfill — cinco `insert … select` — ✅ feito em 11/08/2026

```
pré-voo: zero em todas as colunas viola_
total 97 = soma das cinco 97 · órfãos 0 · nenhuma linha apagada durante a cópia
amamentar 25 · mamadeira 18 · sono 25 · fralda 24 · humor 4 · sintoma 1
```

As cinco conferências `b` (o `except` nos dois sentidos) vieram **vazias em
ambas as direções**, que é a prova de conteúdo — contagem igual com conteúdo
trocado passaria na conferência `a` e morreria aqui.

**O arquivo:** `supabase/backfill/passo-3-copiar-para-registros.sql`. Um insert
por tabela, rodados **um de cada vez**, cada um conferido antes do próximo.
Antes de começar, o pré-voo (bloco 0 do arquivo) roda de novo as violações do
passo 0.

```sql
insert into registros (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select id, baby_id,
       case when type = 'bottle' then 'mamadeira' else 'amamentar' end,
       started_at, null,
       jsonb_strip_nulls(jsonb_build_object(
         'side', side, 'duration_seconds', duration_seconds,
         'amount_ml', amount_ml, 'bottle_type', bottle_type)),
       notes, created_at
from feeding_records
on conflict (id) do update set …;
```

**O `id` original vem junto, e é ele que muda o plano inteiro.** Com o mesmo
`id` dos dois lados, o backfill fica **idempotente**: dá pra rodar de novo, a
qualquer momento, e ele repassa só o que mudou. Isso é o que dispensa parar de
usar o app (ver abaixo) e é o que torna a reversão do passo 4 uma consulta
simples em vez de um problema.

`jsonb_strip_nulls` é o detalhe que faz a coisa funcionar: sem ele, uma
amamentação carregaria `"amount_ml": null`, e a chave **presente com valor nulo**
passa no `dados ? 'amount_ml'` sem passar no vocabulário. Chave ausente e chave
nula são estados diferentes.

Os outros quatro seguem a mesma forma. `sleep_records` é o único que preenche
`terminou_em` (de `ended_at`), e o único sem `notes`.

#### `do update`, e não `do nothing` — a correção que o passo 3 trouxe

A versão anterior deste plano dizia `on conflict (id) do nothing`, e isso deixava
duas coisas para trás em silêncio:

- **o sono encerrado depois da cópia.** Ele foi copiado em aberto; a mãe o
  encerrou; o `id` não mudou. Com `do nothing`, o repasse não olha para a linha
  de novo, e depois da virada o app mostraria um sono correndo há dois dias;
- **o registro editado depois da cópia.** Editar existe desde o bloco 2. Com
  `do nothing`, a edição fica só na tabela antiga — que ninguém vai ler de novo.

Enquanto o código antigo está no ar, **nada escreve em `registros`**. Então
reescrever a linha inteira a partir da origem é sempre certo. A regra, numa
linha, e ela se inverte no dia da virada:

> **`do update` enquanto as tabelas antigas são a fonte da verdade,
> `do nothing` depois que deixam de ser.**

#### O que nenhum insert alcança: a linha apagada

Copiar de novo recolhe o que entrou e o que mudou; não recolhe o que **saiu**.
Um registro apagado pela mãe depois da cópia continua em `registros`, e depois da
virada ela veria voltar um registro que apagou.

O bloco 6 do arquivo cuida disso — primeiro um `select` que olha, depois o
`delete`. Ele é **proibido depois da virada**, quando todo registro novo é órfão
das tabelas antigas por definição, e por isso carrega uma rede:
`created_at <= max(created_at das cinco)`. Registro nascido depois da virada tem
`created_at` maior que qualquer linha das tabelas antigas, que pararam de
crescer — então ele fica de fora mesmo se o bloco rodar na hora errada. A rede
erra para o lado seguro: pode deixar um órfão para trás, nunca apagar registro
vivo. Órfão que sobra aparece na conferência final.

**Verificar depois de cada um:** `count(*)` em `registros` por `tipo` igual ao
`count(*)` da origem, e `min/max(ocorrido_em)` iguais aos da coluna de tempo
original. Um `except` nos dois sentidos entre origem e destino é o que prova
igualdade de conteúdo, não só de contagem — contagem igual com conteúdo trocado
passaria na primeira conferência.

**Reverter:** `delete from registros;` ou `drop table registros;`

---

### 4 · Trocar o código, com as tabelas antigas ainda no lugar

**Código escrito e provado em 11/08/2026; falta o deploy.** `tsc` limpo, as 10
suítes puras verdes, `expo export` empacotando, e as três contra o banco real
passando sobre as 97 linhas migradas — inclusive o `teste-motor-banco`, que
achou os mesmos 210 min e 72 min do gabarito lendo `registros`. Isso responde,
melhor que o `except`, a dúvida do fim deste documento: o motor lê semântica, não
colunas.

Seis lugares nomeiam tabela hoje:

| Onde | O que muda |
|---|---|
| `src/lib/registroSchema.ts` | `tabela`/`colunaTempo` por tipo saem; sobra o `tipo` |
| `src/lib/registros.ts` | `TABELA()` some; `listarRegistros` vira uma consulta |
| `src/lib/registros.ts` | `listarParaPadroes` lê uma janela só |
| `supabase/functions/assistente/index.ts` | tem o próprio mapa de tabelas |
| `scripts/semear-registros.mjs` | semeia nas 5 |
| `teste-motor-banco.ts`, `teste-assistente.mjs`, `teste-rls-delete.mjs` | idem |

Foram catorze arquivos, não seis — a conta original esqueceu `paginacao.ts`,
`database.ts`, `massa-semeada.mjs`, as duas telas e o gerador de SQL.

**E apareceu um teste que faltava.** Metade da paginação desceu para o banco: o
cursor virou uma condição `or(...)` que o PostgREST interpreta, e Node não tem
PostgREST. O `teste-paginacao.ts` continuaria verde com a condição SQL errada —
regra 2b. Daí o `teste-lista-banco.ts`, que pagina o bebê semeado de ponta a
ponta e prova que nada repete nem some. Ele cria o empate de instante que a massa
não tem (o gerador sorteia horas fracionárias; a mãe digita HH:MM e empata o
tempo todo) e o apaga no `finally`.

O `lte` antigo repetia 2 registros nesse cenário. O teste exige que repita, senão
ele estaria provando uma correção que não corrigiu nada.

Deploy em bloco: `tsc`, as 13 suítes, `expo export`, push, e a Edge Function do
assistente.

**Verificar no navegador**, o que teste de Node não alcança: lista com resumos,
filtro por tipo sem vazamento, carregar mais sem repetir nem pular, detalhe dos 6
tipos, criar um de cada tipo, editar um antigo. Depois, o assistente respondendo
recall e contagem.

**Reverter:** `git revert` do commit + redeploy das funções. As tabelas antigas
continuam lá e completas, então o app volta a funcionar imediatamente.

⚠️ **O que a reversão não desfaz sozinha:** registros criados em `registros`
depois da virada ficariam órfãos. Com ~10 linhas por dia, o backfill reverso é
uma consulta — mas ela precisa estar **escrita antes**, não improvisada no
momento em que algo deu errado. Ela é o item 5 do checklist abaixo.

---

### 4½ · Os dois repasses, um de cada lado do deploy

A ordem é **repasse, deploy, repasse de novo** — e os dois repasses rodam
arquivos diferentes, porque a fonte da verdade troca de lado no meio.

| Quando | Arquivo | Conflito de `id` |
|---|---|---|
| Antes do deploy | `backfill/passo-3-copiar-para-registros.sql` | `do update` — recolhe o que entrou **e** o que mudou |
| Depois do deploy | `backfill/passo-4-repassar-depois-da-virada.sql` | `do nothing` — só o que entrou na janela |

O segundo não pode ser `do update`: depois da virada, um sono que atravessou o
deploy e foi encerrado pela mãe tem `terminou_em` em `registros` e `ended_at`
ainda nulo na tabela antiga, que ninguém mais escreve. `do update` devolveria o
sono ao estado aberto, desfazendo o que ela acabou de fazer.

O nome de cada arquivo diz quando ele vale. Foi de propósito: um arquivo só, com
dois blocos e um aviso no meio, é um arquivo em que se roda o bloco errado.

**Verificar:** `select count(*) from registros` igual à soma das cinco tabelas, e
a conferência do fim de cada arquivo sem nenhuma linha.

É este par que fecha a janela entre "copiei" e "troquei o código". O desfecho
esperado do segundo repasse é `INSERT 0 0` cinco vezes.

---

### 5 · Conviver

Alguns dias com as duas estruturas no ar, escrevendo só na nova. Sem prazo
fixo — o critério é ter passado por um ciclo real de uso, incluindo uma
madrugada e um dia de fim de semana.

---

### 6 · `006_apagar_tabelas_antigas.sql`

Migration própria, dias depois, **precedida de dump**:

```
npx supabase db dump -f backup-antes-do-006.sql
```

**Este é o único passo irreversível**, e a única defesa é o dump. Guardar fora do
repositório — ele contém dado de mãe.

---

## Checklist de reversão, por ponto de parada

| Parou em | Como volta | Perde |
|---|---|---|
| Depois do 1 | `drop table registros` | nada |
| Depois do 2 | `drop table registros` | nada |
| Depois do 3 | `drop table registros` | nada |
| Depois do 4 | `git revert` + redeploy | nada, **se** o backfill reverso rodar |
| Depois do 6 | restaurar o dump | o que entrou depois do dump |

---

## ⌛ A reversão do passo 4 VENCEU em 12/08/2026 — e foi apagada

O prazo era 25/08/2026 **ou o primeiro tipo novo em produção, o que viesse
primeiro**. Venceu pelo segundo gatilho, treze dias antes da data: Banho,
Passeio, Leitura e Atividade subiram em 12/08/2026.

`supabase/reversao/` **não existe mais**. Está no histórico do git, que é onde
arquivo de emergência vencido deve estar — perto de quem procura, longe de quem
tem pressa.

**Por que apagar, e não guardar "por via das dúvidas".** As cinco consultas dele
rodariam com sucesso hoje, e deixariam para trás, em silêncio, todo registro de
Banho, Passeio, Leitura e Atividade — tipos que não têm tabela antiga para onde
voltar. Ele não falharia; ele mentiria. E o momento em que alguém abre um arquivo
chamado "reversão" é exatamente o momento em que ninguém tem calma para ler o
cabeçalho e descobrir que ele venceu.

Foi por isso que o prazo nasceu junto com o arquivo, no mesmo commit em que ele
foi escrito. A alternativa é a que todo projeto conhece: o arquivo fica, o
cabeçalho envelhece, e um dia ele é usado.

**Depois do vencimento o caminho é outro, e é só um:** corrigir para frente.
Restaurar o dump do passo 6 (se já tiver acontecido) ou consertar o código sobre
`registros`. Voltar às cinco tabelas deixou de estar na mesa.

### ⚠️ E o `supabase/backfill/` está na mesma situação, por outra razão

O `passo-3-copiar-para-registros.sql` resolve conflito de `id` com **`do
update`** — ele reescreve a linha de `registros` a partir da tabela antiga. Isso
estava certo enquanto as antigas eram a fonte da verdade, e ele diz isso no
cabeçalho.

Hoje ele é pior que a reversão: rodá-lo desfaria toda edição feita em `registros`
desde a virada, com dado velho, sem erro nenhum. E o `passo-4` ao lado é inócuo,
o que é quase pior — os dois têm nome de par, e quem rodar um tende a rodar o
outro.

Os dois já cumpriram o que tinham a cumprir. Não há mais nada para copiar: o app
não escreve nas tabelas antigas desde 11/08/2026.

---

## Preciso parar de usar o app?

**Não** — e a razão é o `id` carregado no backfill.

| Passo | Pode usar? | Por quê |
|---|---|---|
| 1 · criar a tabela | **sim** | tabela vazia, nada existente é tocado |
| 2 · provar a RLS | **sim** | só contas de teste, na tabela vazia |
| 3 · backfill | **sim** | o que entrar durante a cópia é pego pelo repasse |
| 4½ · repasse | **sim** | é justamente o passo que recolhe o atraso |
| 4 · virada do código | **os 2–3 min do deploy** | ver abaixo |
| 5 · conviver | **sim** | normal |
| 6 · apagar as antigas | **sim** | as antigas já não são lidas há dias |

**A única janela real** é entre o repasse (4½) e o deploy fazer efeito: um
registro criado exatamente aí nasceria numa tabela antiga que o código novo não
lê mais. São dois ou três minutos, e a defesa é ordená-los — repasse, deploy,
repasse de novo. O segundo repasse é a rede embaixo do trapézio.

Na versão anterior deste plano eu supunha o app parado durante o backfill. A sua
pergunta é que produziu o `id` carregado, e com ele a suposição deixou de ser
necessária.

---

## O que eu não sei, e não vou fingir que sei
- **`baby_patterns` não entra nesta migração.** É cache do motor, tem chave
  própria e não guarda registro — mas nunca foi exercitada de verdade, e vale
  olhar antes de assumir que passa incólume.
- **A conferência do passo 3 por `except` compara colunas, não semântica.** Se um
  `jsonb_build_object` mapear a chave errada com o tipo certo, o `except` passa e
  o motor lê nulo. A defesa disso é a verificação no navegador do passo 4, não a
  do 3.
