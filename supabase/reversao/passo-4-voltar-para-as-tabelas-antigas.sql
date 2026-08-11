-- Ninna — reversão do passo 4 da migração para `registros`
--
-- ⏳ VENCE EM 25/08/2026, ou no dia em que o primeiro tipo novo entrar em
--    producao — o que vier primeiro. Depois disso este arquivo NAO e um caminho
--    valido: as cinco consultas rodam com sucesso e deixam para tras, em
--    silencio, todo registro de tipo que nao tem tabela antiga.
--    No vencimento, apagar ou renomear para reversao-vencida-em-25-08-2026/.
--
-- ⚠️ ESTE ARQUIVO EXISTE PARA NÃO SER ESCRITO NA HORA.
--    Consulta improvisada no momento em que algo deu errado é a pior hora de
--    escrever SQL: pressa, medo de perder dado, e ninguém para revisar.
--    Escrito em 11/08/2026, antes de o passo 4 rodar.
--
-- ------------------------------------------------------------------
-- QUANDO USAR
--
-- Só depois do passo 4 (o app já lendo e gravando em `registros`) e só se a
-- decisão for voltar. O `git revert` devolve o código às tabelas antigas em
-- minutos; o que ele NÃO devolve são os registros que a mãe criou depois da
-- virada, que nasceram em `registros` e não existem nas tabelas antigas.
--
-- É este arquivo que os traz de volta.
--
-- ------------------------------------------------------------------
-- POR QUE ISTO É SEGURO DE RODAR DUAS VEZES
--
-- O backfill do passo 3 carrega o `id` original para `registros.id`. Isso torna
-- as duas direções idempotentes: cada consulta abaixo insere só o que ainda não
-- existe do outro lado, comparando por `id`.
--
-- Rodar duas vezes não duplica. Rodar por engano antes de precisar não faz nada.
--
-- ------------------------------------------------------------------
-- ORDEM
--
-- Uma consulta de cada vez, conferindo a contagem entre elas. Não há dependência
-- entre as cinco, então parar no meio não deixa estado inconsistente — deixa
-- estado incompleto, que é diferente e recuperável rodando o resto.

-- ============================================================
-- 1 · Amamentação e mamadeira → feeding_records
-- ============================================================

insert into feeding_records
  (id, baby_id, type, side, duration_seconds, amount_ml, bottle_type, started_at, notes, created_at)
select
  r.id,
  r.baby_id,
  case when r.tipo = 'mamadeira' then 'bottle' else 'breast' end,
  r.dados->>'side',
  (r.dados->>'duration_seconds')::int,
  (r.dados->>'amount_ml')::int,
  r.dados->>'bottle_type',
  r.ocorrido_em,
  r.notes,
  r.created_at
from registros r
where r.tipo in ('amamentar', 'mamadeira')
  and not exists (select 1 from feeding_records f where f.id = r.id);

-- ============================================================
-- 2 · Sono → sleep_records
-- ============================================================
--
-- `terminou_em` volta para `ended_at`. Sono ainda em aberto volta em aberto.

insert into sleep_records (id, baby_id, started_at, ended_at, created_at)
select r.id, r.baby_id, r.ocorrido_em, r.terminou_em, r.created_at
from registros r
where r.tipo = 'sono'
  and not exists (select 1 from sleep_records s where s.id = r.id);

-- ============================================================
-- 3 · Fralda → diaper_records
-- ============================================================
--
-- `color` existe na tabela antiga e o app nunca escreveu. O backfill do passo 3
-- carrega mesmo assim, e aqui ele volta — migração não é lugar de decidir que um
-- dado não importa.

insert into diaper_records (id, baby_id, content, color, recorded_at, notes, created_at)
select r.id, r.baby_id, r.dados->>'content', r.dados->>'color', r.ocorrido_em, r.notes, r.created_at
from registros r
where r.tipo = 'fralda'
  and not exists (select 1 from diaper_records d where d.id = r.id);

-- ============================================================
-- 4 · Humor → mood_records
-- ============================================================

insert into mood_records (id, baby_id, mood, probable_reason, notes, recorded_at, created_at)
select r.id, r.baby_id, r.dados->>'mood', r.dados->>'probable_reason', r.notes, r.ocorrido_em, r.created_at
from registros r
where r.tipo = 'humor'
  and not exists (select 1 from mood_records m where m.id = r.id);

-- ============================================================
-- 5 · Sintoma → symptom_records
-- ============================================================

insert into symptom_records (id, baby_id, symptom, intensity, notes, recorded_at, created_at)
select r.id, r.baby_id, r.dados->>'symptom', r.dados->>'intensity', r.notes, r.ocorrido_em, r.created_at
from registros r
where r.tipo = 'sintoma'
  and not exists (select 1 from symptom_records s where s.id = r.id);

-- ============================================================
-- CONFERÊNCIA — o que ficou de fora
-- ============================================================
--
-- Esperado: nenhuma linha. Cada linha que aparecer é um registro que existe em
-- `registros` e não voltou — e o `motivo` diz por quê.
--
-- select r.id, r.tipo, r.ocorrido_em,
--        case
--          when r.tipo not in ('amamentar','mamadeira','sono','fralda','humor','sintoma')
--            then 'tipo sem tabela antiga — nasceu depois do bloco 3'
--          else 'não casou nenhuma consulta acima'
--        end as motivo
-- from registros r
-- where not exists (select 1 from feeding_records f where f.id = r.id)
--   and not exists (select 1 from sleep_records s where s.id = r.id)
--   and not exists (select 1 from diaper_records d where d.id = r.id)
--   and not exists (select 1 from mood_records m where m.id = r.id)
--   and not exists (select 1 from symptom_records y where y.id = r.id);
--
-- ⚠️ O caso do "tipo sem tabela antiga" é real e não tem solução por SQL: se a
--    reversão acontecer DEPOIS de os 14 tipos novos entrarem, esses registros não
--    têm para onde voltar. É mais uma razão para a reversão do passo 4 ter prazo
--    curto — dias, não semanas.
