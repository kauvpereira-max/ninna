-- Ninna — migration 007: medicação, vitamina e vacina não se editam
--
-- Rodar no SQL Editor. Não toca em dado nenhum: só cria a função e o gatilho.
--
-- ⚠️ POR QUE 007 E NÃO 006
--
-- A `006` está reservada há dias para o `drop` das cinco tabelas antigas, e esse
-- número aparece no `docs/plano-migracao-registros.md`, no `CLAUDE.md` e em três
-- commits. Reaproveitá-lo aqui obrigaria a corrigir todos, e renumerar migration
-- é o tipo de mudança que parece inofensiva e confunde alguém seis meses depois.
--
-- ------------------------------------------------------------------
-- POR QUE ISTO EXISTE
--
-- Dose de medicação é a ÚNICA coisa neste app em que o erro é dano físico. E o
-- histórico não editável é o que sustenta a mãe conferindo "já dei o remédio?" —
-- um registro que se reescreve não responde essa pergunta.
--
-- O app já esconde o botão de editar nestes três tipos. Isso é regra de tela, e
-- regra de tela se contorna pela URL: o `atualizarRegistro` é genérico, e um
-- `PATCH` direto no PostgREST não passa por tela nenhuma.
--
-- ------------------------------------------------------------------
-- POR QUE GATILHO, E NÃO POLICY
--
-- Uma policy `as restrictive for update` faria quase a mesma coisa, com menos
-- código. Duas razões para o gatilho:
--
-- 1. **RLS decide QUEM, não O QUÊ.** Misturar as duas coisas na mesma camada é
--    como a policy de posse do bebê ganha uma cláusula que ninguém entende
--    depois.
-- 2. **`service_role` ignora RLS.** O webhook da Stripe e a Edge Function usam
--    service_role, e nenhum dos dois toca em `registros` hoje. "Hoje" é a
--    palavra: o gatilho vale para todo mundo, inclusive para código nosso escrito
--    com pressa daqui a um ano.
--
-- ------------------------------------------------------------------
-- ⚠️ ELE É ESPECÍFICO DOS TRÊS TIPOS, DE PROPÓSITO
--
-- A tentação era escrever "tipo imutável" como conceito e listar os tipos numa
-- tabela de configuração. Não: o gatilho nomeia os três, e a razão é concreta.
--
-- O sono é ENCERRADO por um `update` — é assim que `terminou_em` deixa de ser
-- nulo. Extração, Passeio e Atividade podem ganhar o mesmo comportamento. Um
-- gatilho genérico por "imutável" quebraria o encerrar no primeiro tipo em
-- andamento que alguém marcasse assim, e o sintoma seria a mãe não conseguindo
-- encerrar um sono às 3h da manhã.
--
-- Somar um tipo imutável é editar esta lista, conscientemente, e conferir que
-- ele não tem `terminou_em`.
--
-- ------------------------------------------------------------------
-- O QUE ELE NÃO BLOQUEIA: APAGAR
--
-- Apagar continua permitido, e é decisão. Apagar é ação deliberada, confirmada
-- em duas etapas na tela, e não deixa meia-verdade para trás. Editar troca o
-- conteúdo MANTENDO a aparência de registro conferido — e é isso que estraga a
-- conferência que estes três tipos existem para sustentar.
--
-- Registro errado de medicação se apaga e se refaz, com o horário real.

create or replace function recusar_edicao_de_saude()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Registro de % não pode ser editado. Apague e registre de novo.', old.tipo
    using errcode = 'check_violation';
end;
$$;

comment on function recusar_edicao_de_saude is
  'Gatilho de imutabilidade de medicação, vitamina e vacina. Ver 007.';

drop trigger if exists saude_nao_edita on registros;

create trigger saude_nao_edita
  before update on registros
  for each row
  -- A lista é do gatilho, não da função: quem lê `\d registros` vê quais tipos
  -- são imutáveis sem precisar abrir o corpo da função.
  when (old.tipo in ('medicacao', 'vitamina', 'vacina'))
  execute function recusar_edicao_de_saude();

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- 1 · O gatilho existe e está ligado?
--     Esperado: uma linha, `tgenabled = 'O'` (ligado, modo origem).
--
-- select tgname, tgenabled from pg_trigger
-- where tgrelid = 'registros'::regclass and not tgisinternal;
--
-- 2 · Ele RECUSA o que tem que recusar?
--     Esperado: erro `check_violation`. Se este update passar, o gatilho não
--     está fazendo nada e a conferência 1 mentiu.
--
--     ⚠️ Rode dentro de uma transação que você mesma desfaz, para não depender
--     de o gatilho funcionar para o dado não mudar:
--
-- begin;
--   update registros set notes = 'TESTE' where tipo = 'medicacao';
-- rollback;
--
-- 3 · E DEIXA passar o que tem que passar?
--     Esperado: sucesso. Sem isto, um gatilho que recusasse TUDO passaria na 2 —
--     e o encerrar sono estaria quebrado sem ninguém notar.
--
-- begin;
--   update registros set notes = 'TESTE' where tipo = 'fralda';
--   update registros set terminou_em = now() where tipo = 'sono';
-- rollback;
