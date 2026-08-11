-- Ninna — o segundo repasse, DEPOIS de o código novo subir
--
-- Plano completo: docs/plano-migracao-registros.md
-- O primeiro repasse (antes da virada): passo-3-copiar-para-registros.sql
--
-- ------------------------------------------------------------------
-- O QUE ESTE ARQUIVO RECOLHE
--
-- A janela entre o último repasse e o deploy fazer efeito — dois ou três
-- minutos. Um registro criado exatamente aí nasceu numa tabela antiga que o
-- código novo não lê mais. São essas linhas, e só essas.
--
-- ------------------------------------------------------------------
-- POR QUE `do nothing` AQUI, E `do update` LÁ
--
-- A regra inteira em uma linha: **`do update` enquanto as tabelas antigas são a
-- fonte da verdade, `do nothing` depois que deixam de ser.**
--
-- Depois da virada, quem tem a versão mais nova de uma linha é `registros`. Um
-- sono que atravessou o deploy e foi encerrado pela mãe logo depois tem
-- `terminou_em` preenchido em `registros` e `ended_at` ainda nulo na tabela
-- antiga, que ninguém mais escreve. `do update` devolveria o sono ao estado
-- aberto — desfazendo, em silêncio, o que a mãe acabou de fazer.
--
-- `do nothing` não tem esse modo de falha: linha que já existe fica como está.
-- E como o que este repasse busca são linhas NOVAS, que ainda não têm par,
-- `do nothing` faz o trabalho inteiro.
--
-- ------------------------------------------------------------------
-- ⚠️ NÃO EXISTE RECONCILIAÇÃO DE EXCLUSÃO AQUI
--
-- O bloco 6 do arquivo do passo 3 (apagar de `registros` o que sumiu da origem)
-- é proibido depois da virada: a partir do deploy, todo registro novo da mãe é
-- órfão das tabelas antigas por definição.
--
-- ------------------------------------------------------------------
-- ORDEM
--
-- Rodar as cinco, depois a conferência. O normal é as cinco não fazerem nada —
-- `INSERT 0 0` cinco vezes é o desfecho esperado, não um sinal de erro.


-- ============================================================
-- 1 · Amamentação e mamadeira
-- ============================================================

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select
  f.id, f.baby_id,
  case when f.type = 'bottle' then 'mamadeira' else 'amamentar' end,
  f.started_at, null,
  jsonb_strip_nulls(jsonb_build_object(
    'side',             f.side,
    'duration_seconds', f.duration_seconds,
    'amount_ml',        f.amount_ml,
    'bottle_type',      f.bottle_type
  )),
  f.notes, f.created_at
from feeding_records f
on conflict (id) do nothing;


-- ============================================================
-- 2 · Sono
-- ============================================================

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select s.id, s.baby_id, 'sono', s.started_at, s.ended_at, '{}'::jsonb, null, s.created_at
from sleep_records s
on conflict (id) do nothing;


-- ============================================================
-- 3 · Fralda
-- ============================================================

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select
  d.id, d.baby_id, 'fralda', d.recorded_at, null,
  jsonb_strip_nulls(jsonb_build_object('content', d.content, 'color', d.color)),
  d.notes, d.created_at
from diaper_records d
on conflict (id) do nothing;


-- ============================================================
-- 4 · Humor
-- ============================================================

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select
  m.id, m.baby_id, 'humor', m.recorded_at, null,
  jsonb_strip_nulls(jsonb_build_object(
    'mood', m.mood, 'probable_reason', m.probable_reason
  )),
  m.notes, m.created_at
from mood_records m
on conflict (id) do nothing;


-- ============================================================
-- 5 · Sintoma
-- ============================================================

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select
  y.id, y.baby_id, 'sintoma', y.recorded_at, null,
  jsonb_strip_nulls(jsonb_build_object(
    'symptom', y.symptom, 'intensity', y.intensity
  )),
  y.notes, y.created_at
from symptom_records y
on conflict (id) do nothing;


-- ============================================================
-- CONFERÊNCIA — o que ficou para trás
-- ============================================================
--
-- Esperado: nenhuma linha. Cada linha é um registro que existe numa tabela
-- antiga e não tem par em `registros` — ou seja, um registro que a mãe criou e
-- que o app novo não mostraria.

select 'feeding_records' as origem, f.id, f.started_at as quando
  from feeding_records f
  where not exists (select 1 from registros r where r.id = f.id)
union all
select 'sleep_records', s.id, s.started_at
  from sleep_records s
  where not exists (select 1 from registros r where r.id = s.id)
union all
select 'diaper_records', d.id, d.recorded_at
  from diaper_records d
  where not exists (select 1 from registros r where r.id = d.id)
union all
select 'mood_records', m.id, m.recorded_at
  from mood_records m
  where not exists (select 1 from registros r where r.id = m.id)
union all
select 'symptom_records', y.id, y.recorded_at
  from symptom_records y
  where not exists (select 1 from registros r where r.id = y.id);
