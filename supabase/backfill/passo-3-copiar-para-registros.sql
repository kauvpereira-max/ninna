-- Ninna — passo 3 da migração: copiar as 5 tabelas antigas para `registros`
--
-- Plano completo: docs/plano-migracao-registros.md
-- O caminho de volta: supabase/reversao/passo-4-voltar-para-as-tabelas-antigas.sql
--
-- ------------------------------------------------------------------
-- ESTE ARQUIVO RODA MAIS DE UMA VEZ, E DE PROPÓSITO
--
-- Ele é o passo 3 (a primeira cópia) E o passo 4½ (o repasse, imediatamente
-- antes da virada do código). O `id` original vai junto, então cada linha tem o
-- mesmo `id` dos dois lados e rodar de novo copia só o que falta.
--
-- ------------------------------------------------------------------
-- ⚠️ SÓ ENQUANTO AS TABELAS ANTIGAS FOREM A FONTE DA VERDADE
--
-- Aqui o conflito de `id` é resolvido com `do update`, não `do nothing`. A
-- diferença não é estilo — é o que decide se o repasse recolhe edição, ou só
-- inserção.
--
-- Enquanto o código antigo está no ar, NADA escreve em `registros`. Então
-- reescrever a linha inteira a partir da tabela antiga é sempre certo, e é o
-- único jeito de o repasse alcançar:
--
--   · um sono que começou antes da cópia e foi encerrado depois (`ended_at`
--     deixou de ser nulo, e o `id` não mudou);
--   · um registro editado pela mãe depois da cópia (editar existe desde o
--     bloco 2, e `do nothing` deixaria a edição para trás em silêncio).
--
-- Depois que o código novo subir, esta regra se inverte e este arquivo deixa de
-- servir: aí quem tem a versão mais nova é `registros`, e reescrevê-la a partir
-- da tabela antiga desfaria o trabalho da mãe. Para aquele momento existe o
-- outro arquivo, com `do nothing`:
--
--     supabase/backfill/passo-4-repassar-depois-da-virada.sql
--
-- A regra, numa linha: **`do update` enquanto as antigas mandam, `do nothing`
-- depois que deixam de mandar.**
--
-- ------------------------------------------------------------------
-- ORDEM
--
-- Pré-voo, depois uma tabela de cada vez, conferindo antes de seguir. Não há
-- dependência entre as cinco: parar no meio deixa estado incompleto, que se
-- resolve rodando o resto.
--
-- Reverter, em qualquer ponto: `delete from registros;` ou `drop table registros;`


-- ============================================================
-- 0 · PRÉ-VOO — rodar imediatamente antes, toda vez
-- ============================================================
--
-- As 97 linhas de ontem não são as 97 de hoje. Um registro novo com `side` nulo
-- faz o insert inteiro parar no meio, e é melhor descobrir isso aqui.
--
-- Esperado: zero em todas as colunas `viola_`. As colunas `aviso_` podem ter
-- valor — elas não impedem nada, só dizem o que esperar.
--
-- ⚠️ `symptom` e `probable_reason` NÃO têm check na tabela antiga, e passam a
--    ter em `registros`. São as duas colunas onde uma violação é plausível de
--    verdade — em especial o slug aposentado 'irritability', que existiu e é
--    recusado pelo vocabulário novo. Se ele aparecer, a resposta NÃO é apagar a
--    linha: é somar o valor ao vocabulário e regerar a 005.

select
  (select count(*) from feeding_records
     where type = 'breast' and side is null)                     as viola_amamentar_sem_side,
  (select count(*) from feeding_records
     where type = 'bottle' and bottle_type is null)              as viola_mamadeira_sem_bottle_type,
  (select count(*) from feeding_records
     where type = 'bottle' and amount_ml is null)                as viola_mamadeira_sem_amount_ml,
  (select count(*) from feeding_records
     where amount_ml is not null and amount_ml not between 5 and 500)
                                                                 as viola_amount_ml_fora_da_faixa,
  (select count(*) from feeding_records
     where duration_seconds is not null
       and duration_seconds not between 60 and 10800)            as viola_duration_fora_da_faixa,
  (select count(*) from diaper_records
     where content is null or content not in ('pee', 'poop', 'both'))
                                                                 as viola_fralda_content,
  (select count(*) from mood_records
     where mood is null
        or mood not in ('happy', 'calm', 'crying', 'sleepy', 'agitated', 'irritated'))
                                                                 as viola_humor_mood,
  (select count(*) from mood_records
     where probable_reason is not null
       and probable_reason not in ('hunger', 'sleep', 'diaper', 'colic', 'holding', 'unknown'))
                                                                 as viola_humor_motivo,
  (select count(*) from symptom_records
     where symptom is null
        or symptom not in ('fever', 'runny_nose', 'cough', 'vomit',
                           'diarrhea', 'colic', 'rash', 'other')) as viola_sintoma_symptom,
  (select count(*) from symptom_records
     where intensity is not null
       and intensity not in ('mild', 'moderate', 'high'))         as viola_sintoma_intensidade,
  (select count(*) from sleep_records where ended_at is null)     as aviso_sono_em_aberto,
  (select count(*) from diaper_records where color is not null)   as aviso_fralda_com_cor;


-- ============================================================
-- 1 · Amamentação e mamadeira → registros
-- ============================================================
--
-- `jsonb_strip_nulls` é o que faz isto funcionar: sem ele, uma amamentação
-- carregaria "amount_ml": null, e chave PRESENTE com valor nulo passa no
-- `dados ? 'amount_ml'` sem passar no vocabulário. Chave ausente e chave nula
-- são estados diferentes, e só um deles é "não informado".

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select
  f.id,
  f.baby_id,
  case when f.type = 'bottle' then 'mamadeira' else 'amamentar' end,
  f.started_at,
  null,
  jsonb_strip_nulls(jsonb_build_object(
    'side',             f.side,
    'duration_seconds', f.duration_seconds,
    'amount_ml',        f.amount_ml,
    'bottle_type',      f.bottle_type
  )),
  f.notes,
  f.created_at
from feeding_records f
on conflict (id) do update set
  baby_id     = excluded.baby_id,
  tipo        = excluded.tipo,
  ocorrido_em = excluded.ocorrido_em,
  terminou_em = excluded.terminou_em,
  dados       = excluded.dados,
  notes       = excluded.notes,
  created_at  = excluded.created_at;

-- Conferência 1a — contagem e extremos.
-- Esperado: origem = destino nas três duplas.
select
  (select count(*) from feeding_records)                                    as origem,
  (select count(*) from registros where tipo in ('amamentar', 'mamadeira')) as destino,
  (select min(started_at) from feeding_records)                             as origem_min,
  (select min(ocorrido_em) from registros
     where tipo in ('amamentar', 'mamadeira'))                              as destino_min,
  (select max(started_at) from feeding_records)                             as origem_max,
  (select max(ocorrido_em) from registros
     where tipo in ('amamentar', 'mamadeira'))                              as destino_max;

-- Conferência 1b — igualdade de CONTEÚDO, nos dois sentidos.
-- Esperado: nenhuma linha. Contagem igual com conteúdo trocado passaria em 1a.
select 'origem sem par no destino' as sentido, x.* from (
  select f.id, f.baby_id,
         case when f.type = 'bottle' then 'mamadeira' else 'amamentar' end as tipo,
         f.started_at as ocorrido_em, f.side, f.duration_seconds,
         f.amount_ml, f.bottle_type, f.notes, f.created_at
  from feeding_records f
  except
  select r.id, r.baby_id, r.tipo, r.ocorrido_em,
         r.dados->>'side', (r.dados->>'duration_seconds')::int,
         (r.dados->>'amount_ml')::int, r.dados->>'bottle_type', r.notes, r.created_at
  from registros r where r.tipo in ('amamentar', 'mamadeira')
) x
union all
select 'destino sem par na origem', y.* from (
  select r.id, r.baby_id, r.tipo, r.ocorrido_em,
         r.dados->>'side' as side, (r.dados->>'duration_seconds')::int as duration_seconds,
         (r.dados->>'amount_ml')::int as amount_ml, r.dados->>'bottle_type' as bottle_type,
         r.notes, r.created_at
  from registros r where r.tipo in ('amamentar', 'mamadeira')
  except
  select f.id, f.baby_id,
         case when f.type = 'bottle' then 'mamadeira' else 'amamentar' end,
         f.started_at, f.side, f.duration_seconds,
         f.amount_ml, f.bottle_type, f.notes, f.created_at
  from feeding_records f
) y;


-- ============================================================
-- 2 · Sono → registros
-- ============================================================
--
-- O único que preenche `terminou_em`, e o único sem `notes` na origem —
-- `sleep_records` não tem a coluna. Sono ainda aberto entra aberto, e é
-- exatamente a linha que o `do update` do repasse existe para alcançar depois.

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select s.id, s.baby_id, 'sono', s.started_at, s.ended_at, '{}'::jsonb, null, s.created_at
from sleep_records s
on conflict (id) do update set
  baby_id     = excluded.baby_id,
  tipo        = excluded.tipo,
  ocorrido_em = excluded.ocorrido_em,
  terminou_em = excluded.terminou_em,
  dados       = excluded.dados,
  notes       = excluded.notes,
  created_at  = excluded.created_at;

-- Conferência 2a. Esperado: origem = destino, inclusive os em aberto.
select
  (select count(*) from sleep_records)                              as origem,
  (select count(*) from registros where tipo = 'sono')              as destino,
  (select count(*) from sleep_records where ended_at is null)       as origem_abertos,
  (select count(*) from registros
     where tipo = 'sono' and terminou_em is null)                   as destino_abertos,
  (select min(started_at) from sleep_records)                       as origem_min,
  (select min(ocorrido_em) from registros where tipo = 'sono')      as destino_min,
  (select max(started_at) from sleep_records)                       as origem_max,
  (select max(ocorrido_em) from registros where tipo = 'sono')      as destino_max;

-- Conferência 2b. Esperado: nenhuma linha.
select 'origem sem par no destino' as sentido, x.* from (
  select s.id, s.baby_id, s.started_at as ocorrido_em, s.ended_at as terminou_em, s.created_at
  from sleep_records s
  except
  select r.id, r.baby_id, r.ocorrido_em, r.terminou_em, r.created_at
  from registros r where r.tipo = 'sono'
) x
union all
select 'destino sem par na origem', y.* from (
  select r.id, r.baby_id, r.ocorrido_em, r.terminou_em, r.created_at
  from registros r where r.tipo = 'sono'
  except
  select s.id, s.baby_id, s.started_at, s.ended_at, s.created_at
  from sleep_records s
) y;


-- ============================================================
-- 3 · Fralda → registros
-- ============================================================
--
-- `color` vem junto, mesmo o app nunca tendo escrito nela: migração não é lugar
-- de decidir que um dado não importa. Ela não tem check em `registros` e não
-- atrapalha nenhum — e a reversão a devolve para a coluna de onde veio.

insert into registros
  (id, baby_id, tipo, ocorrido_em, terminou_em, dados, notes, created_at)
select
  d.id, d.baby_id, 'fralda', d.recorded_at, null,
  jsonb_strip_nulls(jsonb_build_object('content', d.content, 'color', d.color)),
  d.notes, d.created_at
from diaper_records d
on conflict (id) do update set
  baby_id     = excluded.baby_id,
  tipo        = excluded.tipo,
  ocorrido_em = excluded.ocorrido_em,
  terminou_em = excluded.terminou_em,
  dados       = excluded.dados,
  notes       = excluded.notes,
  created_at  = excluded.created_at;

-- Conferência 3a.
select
  (select count(*) from diaper_records)                            as origem,
  (select count(*) from registros where tipo = 'fralda')           as destino,
  (select min(recorded_at) from diaper_records)                    as origem_min,
  (select min(ocorrido_em) from registros where tipo = 'fralda')   as destino_min,
  (select max(recorded_at) from diaper_records)                    as origem_max,
  (select max(ocorrido_em) from registros where tipo = 'fralda')   as destino_max;

-- Conferência 3b. Esperado: nenhuma linha.
select 'origem sem par no destino' as sentido, x.* from (
  select d.id, d.baby_id, d.content, d.color, d.recorded_at as ocorrido_em, d.notes, d.created_at
  from diaper_records d
  except
  select r.id, r.baby_id, r.dados->>'content', r.dados->>'color',
         r.ocorrido_em, r.notes, r.created_at
  from registros r where r.tipo = 'fralda'
) x
union all
select 'destino sem par na origem', y.* from (
  select r.id, r.baby_id, r.dados->>'content' as content, r.dados->>'color' as color,
         r.ocorrido_em, r.notes, r.created_at
  from registros r where r.tipo = 'fralda'
  except
  select d.id, d.baby_id, d.content, d.color, d.recorded_at, d.notes, d.created_at
  from diaper_records d
) y;


-- ============================================================
-- 4 · Humor → registros
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
on conflict (id) do update set
  baby_id     = excluded.baby_id,
  tipo        = excluded.tipo,
  ocorrido_em = excluded.ocorrido_em,
  terminou_em = excluded.terminou_em,
  dados       = excluded.dados,
  notes       = excluded.notes,
  created_at  = excluded.created_at;

-- Conferência 4a.
select
  (select count(*) from mood_records)                             as origem,
  (select count(*) from registros where tipo = 'humor')           as destino,
  (select min(recorded_at) from mood_records)                     as origem_min,
  (select min(ocorrido_em) from registros where tipo = 'humor')   as destino_min,
  (select max(recorded_at) from mood_records)                     as origem_max,
  (select max(ocorrido_em) from registros where tipo = 'humor')   as destino_max;

-- Conferência 4b. Esperado: nenhuma linha.
select 'origem sem par no destino' as sentido, x.* from (
  select m.id, m.baby_id, m.mood, m.probable_reason,
         m.recorded_at as ocorrido_em, m.notes, m.created_at
  from mood_records m
  except
  select r.id, r.baby_id, r.dados->>'mood', r.dados->>'probable_reason',
         r.ocorrido_em, r.notes, r.created_at
  from registros r where r.tipo = 'humor'
) x
union all
select 'destino sem par na origem', y.* from (
  select r.id, r.baby_id, r.dados->>'mood' as mood,
         r.dados->>'probable_reason' as probable_reason,
         r.ocorrido_em, r.notes, r.created_at
  from registros r where r.tipo = 'humor'
  except
  select m.id, m.baby_id, m.mood, m.probable_reason, m.recorded_at, m.notes, m.created_at
  from mood_records m
) y;


-- ============================================================
-- 5 · Sintoma → registros
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
on conflict (id) do update set
  baby_id     = excluded.baby_id,
  tipo        = excluded.tipo,
  ocorrido_em = excluded.ocorrido_em,
  terminou_em = excluded.terminou_em,
  dados       = excluded.dados,
  notes       = excluded.notes,
  created_at  = excluded.created_at;

-- Conferência 5a.
select
  (select count(*) from symptom_records)                            as origem,
  (select count(*) from registros where tipo = 'sintoma')           as destino,
  (select min(recorded_at) from symptom_records)                    as origem_min,
  (select min(ocorrido_em) from registros where tipo = 'sintoma')   as destino_min,
  (select max(recorded_at) from symptom_records)                    as origem_max,
  (select max(ocorrido_em) from registros where tipo = 'sintoma')   as destino_max;

-- Conferência 5b. Esperado: nenhuma linha.
select 'origem sem par no destino' as sentido, x.* from (
  select s.id, s.baby_id, s.symptom, s.intensity,
         s.recorded_at as ocorrido_em, s.notes, s.created_at
  from symptom_records s
  except
  select r.id, r.baby_id, r.dados->>'symptom', r.dados->>'intensity',
         r.ocorrido_em, r.notes, r.created_at
  from registros r where r.tipo = 'sintoma'
) x
union all
select 'destino sem par na origem', z.* from (
  select r.id, r.baby_id, r.dados->>'symptom' as symptom,
         r.dados->>'intensity' as intensity,
         r.ocorrido_em, r.notes, r.created_at
  from registros r where r.tipo = 'sintoma'
  except
  select s.id, s.baby_id, s.symptom, s.intensity, s.recorded_at, s.notes, s.created_at
  from symptom_records s
) z;


-- ============================================================
-- 6 · O que o insert não alcança: a linha APAGADA depois da cópia
-- ============================================================
--
-- Copiar de novo recolhe o que entrou e o que mudou. O que ele não recolhe é o
-- que SAIU: um registro apagado pela mãe depois da cópia continua em
-- `registros`, e depois da virada ela veria voltar um registro que apagou.
--
-- ⚠️ SÓ ANTES DA VIRADA. Depois que o código novo subir, todo registro criado
--    em `registros` é órfão por definição — e este delete apagaria justamente
--    os registros novos da mãe.
--
-- A cláusula `created_at <= max(origem)` é a rede embaixo disso: registro
-- nascido depois da virada tem `created_at` maior que qualquer linha da tabela
-- antiga (que parou de crescer), então ele fica de fora mesmo se este bloco
-- rodar na hora errada. A rede erra para o lado seguro: pode deixar um órfão
-- para trás, nunca apagar um registro vivo. Órfão que sobra aparece na
-- conferência 7 abaixo.

-- 6a · Primeiro OLHAR. Esperado: nenhuma linha, no caminho normal.
select r.id, r.tipo, r.ocorrido_em, r.created_at
from registros r
where not exists (select 1 from feeding_records f where f.id = r.id)
  and not exists (select 1 from sleep_records   s where s.id = r.id)
  and not exists (select 1 from diaper_records  d where d.id = r.id)
  and not exists (select 1 from mood_records    m where m.id = r.id)
  and not exists (select 1 from symptom_records y where y.id = r.id);

-- 6b · Só se 6a devolveu linha, e só antes da virada.
delete from registros r
where not exists (select 1 from feeding_records f where f.id = r.id)
  and not exists (select 1 from sleep_records   s where s.id = r.id)
  and not exists (select 1 from diaper_records  d where d.id = r.id)
  and not exists (select 1 from mood_records    m where m.id = r.id)
  and not exists (select 1 from symptom_records y where y.id = r.id)
  and r.created_at <= greatest(
        (select max(created_at) from feeding_records),
        (select max(created_at) from sleep_records),
        (select max(created_at) from diaper_records),
        (select max(created_at) from mood_records),
        (select max(created_at) from symptom_records)
      );


-- ============================================================
-- 7 · CONFERÊNCIA FINAL
-- ============================================================
--
-- Esperado: `total` = `soma_das_cinco`, e `orfaos` = 0.

select
  (select count(*) from registros)          as total,
  (select count(*) from feeding_records)
  + (select count(*) from sleep_records)
  + (select count(*) from diaper_records)
  + (select count(*) from mood_records)
  + (select count(*) from symptom_records)  as soma_das_cinco,
  (select count(*) from registros r
     where not exists (select 1 from feeding_records f where f.id = r.id)
       and not exists (select 1 from sleep_records   s where s.id = r.id)
       and not exists (select 1 from diaper_records  d where d.id = r.id)
       and not exists (select 1 from mood_records    m where m.id = r.id)
       and not exists (select 1 from symptom_records y where y.id = r.id))
                                            as orfaos;

-- E a distribuição, que é o que se olha de relance:
select tipo, count(*) from registros group by tipo order by tipo;
