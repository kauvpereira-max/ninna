-- Ninna — schema inicial (Fase 2 do roadmap técnico)
-- Rodar isso inteiro no SQL Editor do painel do Supabase (Project > SQL Editor > New query)

-- ============================================================
-- BEBÊS
-- ============================================================
create table babies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  birth_date date not null,
  sex text check (sex in ('F', 'M')),
  premature boolean default false,
  weeks_early int, -- preenchido só se premature = true, usado pra idade corrigida
  weight_at_birth_g int,
  height_at_birth_cm numeric,
  created_at timestamptz default now()
);

alter table babies enable row level security;

create policy "usuário vê só os próprios bebês"
  on babies for select using (auth.uid() = user_id);
create policy "usuário cria bebê pra si mesmo"
  on babies for insert with check (auth.uid() = user_id);
create policy "usuário edita só os próprios bebês"
  on babies for update using (auth.uid() = user_id);
create policy "usuário apaga só os próprios bebês"
  on babies for delete using (auth.uid() = user_id);

-- ============================================================
-- AMAMENTAÇÃO / MAMADEIRA (registro unificado de alimentação)
-- ============================================================
create table feeding_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies not null,
  type text not null check (type in ('breast', 'bottle')),
  side text check (side in ('left', 'right', 'both')), -- só pra breast
  duration_seconds int, -- só pra breast
  amount_ml int, -- só pra bottle
  bottle_type text check (bottle_type in ('breast_milk', 'formula')), -- só pra bottle
  started_at timestamptz not null,
  notes text,
  created_at timestamptz default now()
);

alter table feeding_records enable row level security;

create policy "acesso via posse do bebê"
  on feeding_records for all using (
    exists (select 1 from babies where babies.id = feeding_records.baby_id and babies.user_id = auth.uid())
  );

create index idx_feeding_baby_time on feeding_records (baby_id, started_at desc);

-- ============================================================
-- SONO
-- ============================================================
create table sleep_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies not null,
  started_at timestamptz not null,
  ended_at timestamptz, -- null enquanto o sono está em andamento
  created_at timestamptz default now()
);

alter table sleep_records enable row level security;

create policy "acesso via posse do bebê"
  on sleep_records for all using (
    exists (select 1 from babies where babies.id = sleep_records.baby_id and babies.user_id = auth.uid())
  );

create index idx_sleep_baby_time on sleep_records (baby_id, started_at desc);

-- ============================================================
-- FRALDA
-- ============================================================
create table diaper_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies not null,
  content text not null check (content in ('pee', 'poop', 'both')),
  color text, -- hex ou nome da cor, opcional
  recorded_at timestamptz not null,
  notes text,
  created_at timestamptz default now()
);

alter table diaper_records enable row level security;

create policy "acesso via posse do bebê"
  on diaper_records for all using (
    exists (select 1 from babies where babies.id = diaper_records.baby_id and babies.user_id = auth.uid())
  );

create index idx_diaper_baby_time on diaper_records (baby_id, recorded_at desc);

-- ============================================================
-- HUMOR
-- ============================================================
create table mood_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies not null,
  mood text not null check (mood in ('happy', 'irritated', 'crying', 'sleepy', 'calm', 'agitated')),
  probable_reason text,
  notes text,
  recorded_at timestamptz not null,
  created_at timestamptz default now()
);

alter table mood_records enable row level security;

create policy "acesso via posse do bebê"
  on mood_records for all using (
    exists (select 1 from babies where babies.id = mood_records.baby_id and babies.user_id = auth.uid())
  );

create index idx_mood_baby_time on mood_records (baby_id, recorded_at desc);

-- ============================================================
-- SINTOMA
-- ============================================================
create table symptom_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies not null,
  symptom text not null, -- 'fever', 'runny_nose', 'irritability' ou texto livre
  intensity text check (intensity in ('mild', 'moderate', 'high')),
  notes text,
  recorded_at timestamptz not null,
  created_at timestamptz default now()
);

alter table symptom_records enable row level security;

create policy "acesso via posse do bebê"
  on symptom_records for all using (
    exists (select 1 from babies where babies.id = symptom_records.baby_id and babies.user_id = auth.uid())
  );

create index idx_symptom_baby_time on symptom_records (baby_id, recorded_at desc);

-- ============================================================
-- PADRÕES CALCULADOS (motor de personalização — Fase 3, ainda não preenchido por código)
-- ============================================================
create table baby_patterns (
  baby_id uuid primary key references babies,
  avg_sleep_time numeric, -- hora do dia em formato decimal (0-24), calculado por média circular
  avg_feeding_interval_min int,
  avg_sleep_duration_min int,
  confidence_score int default 0, -- nº de registros usados no cálculo
  last_calculated_at timestamptz
);

alter table baby_patterns enable row level security;

create policy "acesso via posse do bebê"
  on baby_patterns for all using (
    exists (select 1 from babies where babies.id = baby_patterns.baby_id and babies.user_id = auth.uid())
  );
