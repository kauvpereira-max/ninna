# Decisão pendente — uma tabela por tipo, ou uma tabela de eventos

**Status:** ✅ **DECIDIDO em 11/08/2026 — opção B**, pelo argumento da
reversibilidade assimétrica. Plano de execução: `docs/plano-migracao-registros.md`.
**Escrita em:** 11/08/2026, com o `registroSchema.ts` já pronto.

> ⚠️ **"São 14 tipos pendentes", mais abaixo, era verdade em 11/08 e não é mais.**
> Foram construídos 13 em 11–12/08 — a soma original estava errada, e o que
> faltava era **Habilidade**, hoje decisão de produto em aberto e não item de
> fila (`PRODUTO.md` §3.4). São **19 tipos no ar**.
>
> O documento fica como está: ele registra o estado em que a decisão foi tomada,
> e reescrevê-lo apagaria o motivo de ela ter sido tomada assim.

O bloco 2 terminou com o tipo de registro declarado num lugar só. Isso mudou o
custo desta decisão: hoje **as duas opções custam o mesmo no código do app**,
porque o app não conhece mais tabela nenhuma — ele conhece o schema. O que
muda é o que o **banco** passa a poder garantir, e o que fica caro perguntar.

---

## O estado de hoje

5 tabelas para 6 tipos (`feeding_records` atende amamentação e mamadeira). Cada
uma com:

- uma policy `for all using (exists (select 1 from babies where … auth.uid()))`;
- um índice `(baby_id, <coluna de tempo> desc)`;
- `check` de vocabulário nas colunas fechadas (`content in ('pee','poop','both')`).

A lista unificada é um **merge de k listas ordenadas**: cada tabela devolve
`limite + 1` linhas, e o cliente intercala. Funciona, está testado, e já exigiu
um argumento sutil para provar que a paginação não pula nem repete.

**São 14 tipos pendentes.** Na opção A isso vira ~19 tabelas.

---

## Opção A — uma tabela por tipo

Continuar o que existe: `weight_records`, `vaccine_records`, `walk_records`…

### RLS

19 policies idênticas, escritas 19 vezes. O custo não é digitar — é que
**esquecer uma não quebra nada visivelmente**. Tabela sem RLS ligada fica legível
e gravável por qualquer usuária autenticada via PostgREST, e o app da dona
funciona igual. O sintoma não aparece do lado de quem testa.

O `teste-rls-delete.mjs` prova hoje uma tabela. Para valer, ele passaria a
varrer as 19 — e essa varredura tem que ser **derivada da lista de tabelas**, não
escrita à mão, senão ela erra junto com a migration que a esqueceu.

### Índice

Um índice pequeno por tabela, cada consulta batendo só no que interessa. É o
lado forte de A: nenhuma consulta olha linha de outro tipo.

O custo é de **rede, não de banco**: a lista da Home passa a fazer até 19
requisições por página, e o `carregar mais` também. Em 4G ruim, às 3h da manhã,
isso é a diferença entre a lista aparecer e a mãe achar que o app travou.

### Motor

`listarParaPadroes` hoje lê 2 tabelas com a **mesma janela**, e o comentário no
código explica por que elas não podem ser paginadas em separado: janelas
desalinhadas dão métrica calculada sobre metade do dado — o R3, número errado com
cara de certeza. Com 19 tabelas, esse alinhamento vira invariante de N tabelas, e
cada métrica nova amplia a superfície onde ele pode falhar.

### Custo agora
Baixo e conhecido. 14 migrations, 14 entradas em `database.ts`, 14 policies, 14
índices. Nada de novo para aprender.

---

## Opção B — uma tabela de eventos

```sql
create table registros (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies not null,
  tipo text not null check (tipo in ('amamentar','mamadeira',…)),
  ocorrido_em timestamptz not null,
  terminou_em timestamptz,          -- eventos com duração
  dados jsonb not null default '{}',
  notes text,
  created_at timestamptz default now()
);
```

`terminou_em` **não é o sono puxando a colcha**: dos 14 pendentes, Extração,
Atividade, Passeio e Leitura também têm começo e fim. Evento com duração é uma
forma, não uma exceção.

### RLS

Uma policy. Uma tabela. **Não há como esquecer**, e essa é a razão mais forte de
B — é argumento de segurança, não de conforto. O modo de falha catastrófico da
opção A desaparece por construção, em vez de ser combatido por disciplina.

Custo: a subconsulta de posse passa a ser avaliada sobre uma tabela maior. Com o
índice em `baby_id` isso é ruído.

### Índice

```sql
create index on registros (baby_id, ocorrido_em desc);
create index on registros (baby_id, tipo, ocorrido_em desc);
```

A lista unificada deixa de ser merge de k listas **no cliente** e vira
`order by ocorrido_em desc limit n` **no banco**. Uma requisição por página. O
argumento sutil da paginação some porque o problema some.

Custo real: consulta que filtra por campo **dentro** do `dados` não usa esses
índices. Precisa de índice de expressão, e para criar um você precisa saber
antes qual campo. Hoje nenhuma consulta faz isso; a superfície do assistente
pergunta por tipo, dia e intervalo — nunca "todas as mamadas acima de 100 ml".

### Motor

Uma leitura, uma janela, alinhamento trivial. O R3 deixa de depender de
coordenação.

Custo: número dentro de `jsonb` precisa de cast — `(dados->>'amount_ml')::int` — e
erro de tipo migra de compilação para execução. **Mitigação:** coluna gerada e
armazenada para os poucos campos que o motor agrega, com `check` próprio:

```sql
alter table registros add column duracao_segundos int
  generated always as ((dados->>'duration_seconds')::int) stored;
```

O campo quente volta a ser inteiro de verdade, indexável e checável, sem deixar
de morar no `dados`.

### O custo que não tem mitigação boa

> **Corrigido em 11/08/2026, depois de testar no Postgres do projeto.** Esta
> seção estava mais pessimista que a realidade: o vocabulário **continua**
> garantido pelo banco, como `check` de tabela condicionado ao tipo, gerado a
> partir do schema. Ver o plano de migração. O parágrafo abaixo fica como estava
> escrito, porque era a premissa que a decisão precisava enfrentar.

**O banco perde os `check` de vocabulário.** Hoje `content in ('pee','poop','both')`
é o Postgres dizendo *isso é impossível*. Em `jsonb`, nada é impossível.

O projeto já tem exatamente um caso assim — a coluna `symptom`, sem check —, e o
`CLAUDE.md` o trata como dívida a ser gerida: *"coluna sem check não é convite a
texto livre"*. A opção B transforma **todas** as colunas em `symptom`.

A mitigação existe e é honesta, mas é mitigação: hoje toda escrita passa por
`linhaParaBanco`, que é testado e valida contra vocabulário fechado. É **um
caminho só**. O risco é o segundo caminho — script de semeadura, importação,
correção em massa — que escreve direto e não sabe das regras.

---

## Opção C — híbrida (e por que eu recomendo contra)

Manter `feeding_records` e `sleep_records` (o caminho quente do motor, já
indexado e testado) e mandar os 14 novos para `registros`.

Custo: duas formas para sempre. `listarRegistros` passa a saber das duas, o
schema ganha uma exceção permanente, e toda decisão futura começa perguntando
"esse tipo é dos antigos ou dos novos?".

É metade refatorado — parece pronto e continua cobrando na parte que sobrou.

---

## O que você não está vendo: a decisão tem prazo de validade

**Hoje o banco tem centenas de linhas e uma usuária real.** Migrar 5 tabelas para
1 é um `insert … select` de alguns minutos, com o app fora do ar por nada.

Em seis meses, com mães pagantes, a mesma migração é backfill com janela de
manutenção, plano de rollback e risco de perder registro de gente que confiou o
diário do filho ao app.

A reversibilidade é **assimétrica**:

- escolher B agora e se arrepender → volta-se a criar tabelas dedicadas para os
  tipos que precisarem, convivendo com `registros` (é a opção C, de propósito e
  não por acidente);
- escolher A agora e se arrepender → migração cara, arriscada e cada vez pior.

Escolher A hoje é, na prática, **escolher A para sempre**. Isso não torna A
errada — torna a decisão menos simétrica do que ela parece.

---

## O que cada uma torna difícil daqui a seis meses

### A, em seis meses

1. **Pergunta que cruza tipos.** "O que costuma vir antes das noites picadas?"
   exige `union` de 19 tabelas. E é justamente aí que a tese é mais forte: o
   diferencial da Ninna é padrão cruzado **deste** bebê, não estatística de
   população. A opção A encarece exatamente a pergunta que o produto existe para
   responder.
2. **A linha do tempo.** 19 requisições por página, e crescendo com o catálogo.
3. **Migration como gargalo de produto.** Somar um campo a um tipo passa a ser
   migration + `database.ts` + schema, com a disciplina de conferência pelo
   servidor em cada uma.
4. **LGPD.** A cascata tem 8 chaves hoje; teria ~20. O termo promete exclusão, e
   cada tabela nova é uma chance de esquecer um `on delete cascade` — a mesma
   classe de erro invisível do RLS esquecido.

### B, em seis meses

1. **O banco não consegue mais dizer "isso é impossível".** Todo dado torto que
   entrar, entra calado, e só aparece quando o motor calcular errado.
2. **Chave renomeada dentro do `dados` não tem forcing function.** Sem migration
   obrigando, o equivalente de `SINTOMAS_APOSENTADOS` — mas para chaves — cresce
   em silêncio e ninguém limpa.
3. **Consulta ad-hoc no SQL Editor vira ginástica de `jsonb`.** Isso não afeta o
   app; afeta você, tocando o negócio: "quantas mães registraram X semana
   passada" é uma pergunta que se faz no painel, às pressas.
4. **O TypeScript ajuda menos.** `database.ts` é escrito à mão, e a linha vira
   `Record<string, unknown>`. Parte desse custo **já foi paga** no bloco 2: a
   leitura já trabalha com `LinhaRegistro = Record<string, unknown>`, e o teste
   literal é quem segura.

---

## Recomendação

**B, com três travas — e agora, não depois.**

1. `tipo` como coluna de verdade, com `check` contra a lista conhecida. O único
   campo que precisa ser garantido pelo banco continua sendo.
2. Colunas geradas e armazenadas para os campos que o motor agrega
   (`duracao_segundos`, `quantidade_ml`), com `check` e índice próprios.
3. `teste-rls-delete.mjs` estendido para provar a tabela nova **antes** de
   qualquer dado entrar nela, e a varredura derivada da lista de tabelas.

A razão de peso não é elegância: é que **B elimina por construção o modo de
falha silencioso** (RLS ou cascata esquecida numa tabela nova entre 19), enquanto
o modo de falha que B introduz — dado torto entrando — é combatido por um caminho
único de escrita que já existe, já está testado, e acabou de ser consolidado.

E a janela para pagar barato é agora.

**O que eu faria antes de executar:** um `select count(*)` por tabela, para a
frase "centenas de linhas" ser um número, e não uma impressão minha.

> **Feito.** São **97 registros**, não centenas — errei por uma ordem de
> grandeza, e para menos. O argumento do prazo fica mais forte, não mais fraco.
