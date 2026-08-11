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

### 2 · Provar a RLS antes de qualquer dado entrar

`teste-rls-delete.mjs` estendido para incluir `registros`, e rodado com a tabela
**vazia**. A ordem importa: RLS provada com dado dentro é RLS provada tarde
demais.

A lista de tabelas do teste passa a ser **derivada**, não escrita à mão — uma
lista manual erra junto com a migration que a esqueceu.

**Verificar:** a conta A não lê, não edita e não apaga registro da conta B.

**Reverter:** nada a reverter; nenhum dado foi escrito.

---

### 3 · Backfill — cinco `insert … select`

Um por tabela, rodados **um de cada vez**, cada um conferido antes do próximo.
Antes de começar, rodar de novo a consulta de violações do passo 0.

```sql
insert into registros (baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select baby_id,
       case when type = 'bottle' then 'mamadeira' else 'amamentar' end,
       started_at, null,
       jsonb_strip_nulls(jsonb_build_object(
         'side', side, 'duration_seconds', duration_seconds,
         'amount_ml', amount_ml, 'bottle_type', bottle_type)),
       notes, created_at
from feeding_records;
```

`jsonb_strip_nulls` é o detalhe que faz a coisa funcionar: sem ele, uma
amamentação carregaria `"amount_ml": null`, e a chave **presente com valor nulo**
passa no `dados ? 'amount_ml'` sem passar no vocabulário. Chave ausente e chave
nula são estados diferentes.

Os outros quatro seguem a mesma forma. `sleep_records` é o único que preenche
`terminou_em` (de `ended_at`), e o único sem `notes`.

**Verificar depois de cada um:** `count(*)` em `registros` por `tipo` igual ao
`count(*)` da origem, e `min/max(ocorrido_em)` iguais aos da coluna de tempo
original. Um `except` nos dois sentidos entre origem e destino é o que prova
igualdade de conteúdo, não só de contagem.

**Reverter:** `delete from registros;` ou `drop table registros;`

---

### 4 · Trocar o código, com as tabelas antigas ainda no lugar

Seis lugares nomeiam tabela hoje:

| Onde | O que muda |
|---|---|
| `src/lib/registroSchema.ts` | `tabela`/`colunaTempo` por tipo saem; sobra o `tipo` |
| `src/lib/registros.ts` | `TABELA()` some; `listarRegistros` vira uma consulta |
| `src/lib/registros.ts` | `listarParaPadroes` lê uma janela só |
| `supabase/functions/assistente/index.ts` | tem o próprio mapa de tabelas |
| `scripts/semear-registros.mjs` | semeia nas 5 |
| `teste-motor-banco.ts`, `teste-assistente.mjs`, `teste-rls-delete.mjs` | idem |

Deploy em bloco: `tsc`, as 12 suítes, `expo export`, push, e as duas Edge
Functions.

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

## O que eu não sei, e não vou fingir que sei

- **O plano supõe que ninguém está usando o app durante o backfill.** Com uma
  usuária real isso se resolve escolhendo a hora; com cem, precisaria de outra
  conversa.
- **`baby_patterns` não entra nesta migração.** É cache do motor, tem chave
  própria e não guarda registro — mas nunca foi exercitada de verdade, e vale
  olhar antes de assumir que passa incólume.
- **A conferência do passo 3 por `except` compara colunas, não semântica.** Se um
  `jsonb_build_object` mapear a chave errada com o tipo certo, o `except` passa e
  o motor lê nulo. A defesa disso é a verificação no navegador do passo 4, não a
  do 3.
