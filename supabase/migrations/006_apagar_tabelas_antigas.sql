-- Ninna — migration 006: apagar as cinco tabelas antigas de registro
--
-- ⚠️ ESTE É O ÚNICO PASSO IRREVERSÍVEL DO PLANO DE MIGRAÇÃO.
--    NÃO RODAR SEM O DUMP FEITO E CONFERIDO. Ver o roteiro no fim do arquivo.
--
-- ------------------------------------------------------------------
-- POR QUE ELA TEM O NÚMERO 006 E CHEGA DEPOIS DA 011
--
-- O número está reservado desde 11/08/2026 — aparece no plano de migração, no
-- `CLAUDE.md` e em vários commits. A `007` nasceu com esse número justamente
-- para não tomar o lugar dela (ver o cabeçalho da `007`).
--
-- Migration fora de ordem cronológica é estranho de ver, e é o menor dos males:
-- renumerar seria corrigir referências em três documentos e confundir alguém
-- daqui a seis meses.
--
-- ------------------------------------------------------------------
-- O QUE CAI JUNTO, E O QUE NÃO EXISTE
--
-- Levantado em 15/08/2026, arquivo por arquivo:
--
-- | Depende das 5? | |
-- |---|---|
-- | FK apontando PARA elas | **nenhuma** — as 7 FKs do schema apontam para `babies` |
-- | view                   | nenhuma existe no projeto |
-- | function / trigger     | nenhuma as toca. O gatilho da `007` é sobre `registros` |
-- | código do app          | zero referências em `app/`, `src/lib/`, `functions/` |
--
-- Cai junto, automaticamente, sem precisar de comando: 5 policies
-- "acesso via posse do bebê", 5 índices `idx_*_baby_time`, 5 FKs
-- `*_baby_id_fkey` e os `check` de coluna.
--
-- ------------------------------------------------------------------
-- ⚠️ SEM `CASCADE`, E ISSO É A PROTEÇÃO
--
-- `drop table ... cascade` levaria junto qualquer coisa que dependesse delas —
-- em silêncio. O levantamento diz que não há nada, mas o levantamento é de um
-- dia e o banco é de agora.
--
-- Sem `cascade`, se apareceu uma dependência que ninguém viu, o comando FALHA em
-- vez de apagar a dependência junto. Falhar aqui custa uma mensagem de erro;
-- acertar por sorte custa uma tabela que ninguém sabia que existia.

begin;

-- ------------------------------------------------------------------
-- A trava: não apagar a origem se o destino estiver vazio
-- ------------------------------------------------------------------
--
-- As 97 linhas foram copiadas em 11/08/2026 (passo 3 do plano). Este bloco
-- recusa o `drop` se `registros` não tiver pelo menos elas.
--
-- É a regra 2 aplicada a uma migration: sem isto, rodar este arquivo num banco
-- onde a cópia falhou, ou num projeto errado, apagaria os originais **com
-- sucesso** e sem nada avisar. A conferência tem que estar do lado de dentro,
-- porque quem roda o arquivo às 23h não vai reler o roteiro.
--
-- 97 é piso, não igualdade: `registros` só cresceu desde então.

do $$
declare
  n bigint;
begin
  select count(*) into n from registros;
  if n < 97 then
    raise exception
      'ABORTADO: `registros` tem % linhas, menos que as 97 copiadas em 11/08/2026. '
      'A cópia não está aqui — não apagar a origem.', n;
  end if;
  raise notice 'registros tem % linhas. Seguindo com o drop.', n;
end $$;

-- ------------------------------------------------------------------
-- O drop
-- ------------------------------------------------------------------
--
-- `if exists` para o arquivo poder ser rodado duas vezes sem erro — o que
-- acontece quando alguém não tem certeza se já rodou. Segunda execução é um
-- no-op, não um estrago.

drop table if exists feeding_records;
drop table if exists sleep_records;
drop table if exists diaper_records;
drop table if exists mood_records;
drop table if exists symptom_records;

commit;

-- ------------------------------------------------------------------
-- CONFERÊNCIA, depois de rodar
-- ------------------------------------------------------------------
--
-- 1 · As cinco sumiram? Esperado: zero linhas.
--
-- select tablename from pg_tables
-- where schemaname = 'public'
--   and tablename in ('feeding_records','sleep_records','diaper_records',
--                     'mood_records','symptom_records');
--
-- 2 · O que sobrou no schema? Esperado: babies, baby_patterns, assistant_usage,
--     assinaturas, registros, afiliadas, indicacoes, comissoes, saques.
--
-- select tablename from pg_tables where schemaname = 'public' order by 1;
--
-- 3 · `registros` continua inteira?
--
-- select tipo, count(*) from registros group by tipo order by 1;
--
-- ------------------------------------------------------------------
-- ⚠️ ESTA MIGRATION NÃO VENCE, E O DUMP VENCE
--
-- Ela descreve uma TRANSIÇÃO, então pela regra 4 do `CLAUDE.md` nasceria com
-- prazo. Mas `drop table if exists` num banco onde as tabelas já sumiram é um
-- no-op — ela não passa a "fazer a coisa errada com sucesso", que é o dano
-- contra o qual a regra 4 existe. Fica como registro histórico.
--
-- **O que vence é o dump.** Ele contém dado de rotina de bebê e existe só para
-- a janela em que este arquivo pode ter apagado algo errado.
--
--     APAGAR C:\ninna-backup\ninna-<data>-antes-do-006.sql EM 15/09/2026
--
-- Registrado no `CLAUDE.md`, não aqui: este arquivo é sobre o banco, e quem
-- vier ler o lembrete daqui a um mês não vem por uma migration.
