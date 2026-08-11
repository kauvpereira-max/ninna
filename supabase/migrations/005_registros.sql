-- Ninna — migration 005: a tabela de eventos
--
-- ⚠️ ARQUIVO GERADO. Não edite à mão.
--    npx tsx scripts/gerar-registros-sql.ts > supabase/migrations/005_registros.sql
--    O teste-registros-sql.ts reprova se este arquivo divergir do schema.
--
-- Decisão e alternativas: docs/decisao-tabela-de-registros.md
--
-- POR QUE UMA TABELA E NÃO DEZENOVE
--
-- Com uma tabela por tipo, esquecer o RLS numa das 19 não quebra nada visível: a
-- tabela fica legível e gravável por qualquer usuária autenticada, e o app da
-- dona funciona igual. Aqui existe uma policy só, e não há como esquecê-la.
--
-- O QUE SUBSTITUI OS CHECK DE COLUNA
--
-- Eles não se perdem: viram check de tabela condicionados ao tipo, e são gerados
-- a partir do mesmo vocabulário que o app usa. O que o Postgres garantia, ele
-- continua garantindo — a diferença é que a regra passou a ter uma origem só.

create table registros (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies on delete cascade not null,

  -- O tipo é coluna de verdade, com check: é por ele que tudo se filtra, e é o
  -- único campo cuja integridade não pode depender do app.
  tipo text not null check (tipo in ('amamentar', 'mamadeira', 'fralda', 'sono', 'humor', 'sintoma')),

  -- Ancora o registro na linha do tempo. Substitui started_at/recorded_at.
  ocorrido_em timestamptz not null,

  -- Fim do evento, quando ele tem duração. Não é o sono puxando a colcha:
  -- Extração, Atividade, Passeio e Leitura também têm começo e fim.
  terminou_em timestamptz,

  -- O que varia por tipo. Vocabulário fechado, garantido pelos check abaixo.
  dados jsonb not null default '{}',

  -- Texto livre da mãe. Coluna, e não chave no jsonb: não tem vocabulário para
  -- checar e é consultado por presença.
  notes text,

  created_at timestamptz default now(),

  duration_seconds int generated always as ((dados->>'duration_seconds')::int) stored,
  amount_ml int generated always as ((dados->>'amount_ml')::int) stored,

  constraint faixa_duration_seconds check (
    duration_seconds is null or duration_seconds between 60 and 10800
  ),

  constraint faixa_amount_ml check (
    amount_ml is null or amount_ml between 5 and 500
  ),

  constraint vocab_amamentar_side check (
    tipo <> 'amamentar' or dados->>'side' in ('left', 'right', 'both')
  ),

  constraint exige_amamentar_side check (
    tipo <> 'amamentar' or dados ? 'side'
  ),

  constraint exige_mamadeira_amount_ml check (
    tipo <> 'mamadeira' or dados ? 'amount_ml'
  ),

  constraint vocab_mamadeira_bottle_type check (
    tipo <> 'mamadeira' or dados->>'bottle_type' in ('breast_milk', 'formula')
  ),

  constraint exige_mamadeira_bottle_type check (
    tipo <> 'mamadeira' or dados ? 'bottle_type'
  ),

  constraint vocab_fralda_content check (
    tipo <> 'fralda' or dados->>'content' in ('pee', 'poop', 'both')
  ),

  constraint exige_fralda_content check (
    tipo <> 'fralda' or dados ? 'content'
  ),

  constraint vocab_humor_mood check (
    tipo <> 'humor' or dados->>'mood' in ('happy', 'calm', 'crying', 'sleepy', 'agitated', 'irritated')
  ),

  constraint exige_humor_mood check (
    tipo <> 'humor' or dados ? 'mood'
  ),

  constraint vocab_humor_probable_reason check (
    tipo <> 'humor' or dados->>'probable_reason' is null or dados->>'probable_reason' in ('hunger', 'sleep', 'diaper', 'colic', 'holding', 'unknown')
  ),

  constraint vocab_sintoma_symptom check (
    tipo <> 'sintoma' or dados->>'symptom' in ('fever', 'runny_nose', 'cough', 'vomit', 'diarrhea', 'colic', 'rash', 'other')
  ),

  constraint exige_sintoma_symptom check (
    tipo <> 'sintoma' or dados ? 'symptom'
  ),

  constraint vocab_sintoma_intensity check (
    tipo <> 'sintoma' or dados->>'intensity' is null or dados->>'intensity' in ('mild', 'moderate', 'high')
  )
);

alter table registros enable row level security;

-- Uma policy, uma tabela. O modo de falha silencioso da opção A não existe aqui.
create policy "acesso via posse do bebê"
  on registros for all using (
    exists (select 1 from babies where babies.id = registros.baby_id and babies.user_id = auth.uid())
  );

-- A lista unificada: uma consulta, ordenação e cursor no banco. Deixa de ser
-- merge de k listas no cliente porque deixa de haver k listas.
create index idx_registros_baby_tempo on registros (baby_id, ocorrido_em desc);

-- A mesma lista filtrada por tipo, e as leituras do motor.
create index idx_registros_baby_tipo_tempo on registros (baby_id, tipo, ocorrido_em desc);

-- Sono em aberto: a Home procura por isto a cada carga.
create index idx_registros_em_aberto on registros (baby_id)
  where terminou_em is null;

comment on table registros is
  'Eventos de rotina do bebê. Uma linha por registro, o que varia por tipo mora em dados.';

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- Esperado: rls_ligada = true, policies = 1, indices = 4 (3 + a chave primária),
-- e restricoes = o número de check gerados acima.
--
-- select
--   (select relrowsecurity from pg_class where relname = 'registros') as rls_ligada,
--   (select count(*) from pg_policy where polrelid = 'registros'::regclass) as policies,
--   (select count(*) from pg_indexes where tablename = 'registros') as indices,
--   (select count(*) from pg_constraint where conrelid = 'registros'::regclass
--      and contype = 'c') as restricoes;
