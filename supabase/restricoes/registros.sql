-- Ninna — restrições de `registros`, geradas do registroSchema.ts
--
-- ⚠️ ARQUIVO GERADO. Não edite à mão.
--    npx tsx scripts/gerar-registros-sql.ts > supabase/restricoes/registros.sql
--    O teste-registros-sql.ts reprova se este arquivo divergir do schema.
--
-- ------------------------------------------------------------------
-- É SEGURO RODAR QUANTAS VEZES FOR PRECISO
--
-- Cada restrição é derrubada e recriada, e cada coluna gerada entra com
-- `if not exists`. O arquivo descreve o ESTADO DESEJADO, não um passo — rodá-lo
-- num banco que já está certo não muda nada.
--
-- É isso que faz somar um tipo de registro ser UMA edição: mexe no
-- `registroSchema.ts`, regera este arquivo, roda no SQL Editor.
--
-- A criação da tabela mora na `005_registros.sql`, que está congelada. Ela
-- aconteceu uma vez e não volta a acontecer.
--
-- ------------------------------------------------------------------
-- ⚠️ DUAS COISAS QUE ELE NÃO FAZ
--
-- 1. Não muda a expressão de coluna gerada que já existe: `add column if not
--    exists` pula em silêncio sem comparar a fórmula. Trocar a fórmula é
--    migration à mão, com `drop column`, e reescreve a tabela.
--
-- 2. Não apaga restrição que saiu do schema. A conferência do rodapé lista o que
--    está no banco e não foi gerado aqui — leftover não some sozinho, mas para
--    de ser invisível.

-- ============================================================
-- COLUNAS GERADAS
-- ============================================================
--
-- O número sai do `dados` e vira inteiro de verdade: indexável, somável em SQL,
-- e com faixa checável. É o campo que o motor lê.

alter table registros add column if not exists duration_seconds int generated always as ((dados->>'duration_seconds')::int) stored;
alter table registros add column if not exists amount_ml int generated always as ((dados->>'amount_ml')::int) stored;

-- ============================================================
-- O TIPO
-- ============================================================
--
-- A única coluna cuja integridade não pode depender do app: é por ela que tudo
-- se filtra. O `drop` do nome automático limpa o check inline da 005.

alter table registros drop constraint if exists registros_tipo_check;
alter table registros drop constraint if exists tipo_conhecido;
alter table registros add  constraint tipo_conhecido check (
  tipo in ('amamentar', 'mamadeira', 'fralda', 'sono', 'humor', 'sintoma', 'banho', 'passeio', 'leitura', 'atividade')
);

-- ============================================================
-- FAIXAS NUMÉRICAS
-- ============================================================

alter table registros drop constraint if exists faixa_duration_seconds;
alter table registros add  constraint faixa_duration_seconds check (
  duration_seconds is null or duration_seconds between 60 and 10800
);

alter table registros drop constraint if exists faixa_amount_ml;
alter table registros add  constraint faixa_amount_ml check (
  amount_ml is null or amount_ml between 5 and 500
);

-- ============================================================
-- VOCABULÁRIO E CAMPOS OBRIGATÓRIOS, POR TIPO
-- ============================================================
--
-- O que o Postgres garantia com `check` de coluna ele continua garantindo. A
-- diferença é que a regra passou a ter uma origem só.

alter table registros drop constraint if exists vocab_amamentar_side;
alter table registros add  constraint vocab_amamentar_side check (
  tipo <> 'amamentar' or dados->>'side' in ('left', 'right', 'both')
);

alter table registros drop constraint if exists exige_amamentar_side;
alter table registros add  constraint exige_amamentar_side check (
  tipo <> 'amamentar' or dados ? 'side'
);

alter table registros drop constraint if exists exige_mamadeira_amount_ml;
alter table registros add  constraint exige_mamadeira_amount_ml check (
  tipo <> 'mamadeira' or dados ? 'amount_ml'
);

alter table registros drop constraint if exists vocab_mamadeira_bottle_type;
alter table registros add  constraint vocab_mamadeira_bottle_type check (
  tipo <> 'mamadeira' or dados->>'bottle_type' in ('breast_milk', 'formula')
);

alter table registros drop constraint if exists exige_mamadeira_bottle_type;
alter table registros add  constraint exige_mamadeira_bottle_type check (
  tipo <> 'mamadeira' or dados ? 'bottle_type'
);

alter table registros drop constraint if exists vocab_fralda_content;
alter table registros add  constraint vocab_fralda_content check (
  tipo <> 'fralda' or dados->>'content' in ('pee', 'poop', 'both')
);

alter table registros drop constraint if exists exige_fralda_content;
alter table registros add  constraint exige_fralda_content check (
  tipo <> 'fralda' or dados ? 'content'
);

alter table registros drop constraint if exists vocab_humor_mood;
alter table registros add  constraint vocab_humor_mood check (
  tipo <> 'humor' or dados->>'mood' in ('happy', 'calm', 'crying', 'sleepy', 'agitated', 'irritated')
);

alter table registros drop constraint if exists exige_humor_mood;
alter table registros add  constraint exige_humor_mood check (
  tipo <> 'humor' or dados ? 'mood'
);

alter table registros drop constraint if exists vocab_humor_probable_reason;
alter table registros add  constraint vocab_humor_probable_reason check (
  tipo <> 'humor' or dados->>'probable_reason' is null or dados->>'probable_reason' in ('hunger', 'sleep', 'diaper', 'colic', 'holding', 'unknown')
);

alter table registros drop constraint if exists vocab_sintoma_symptom;
alter table registros add  constraint vocab_sintoma_symptom check (
  tipo <> 'sintoma' or dados->>'symptom' in ('fever', 'runny_nose', 'cough', 'vomit', 'diarrhea', 'colic', 'rash', 'other')
);

alter table registros drop constraint if exists exige_sintoma_symptom;
alter table registros add  constraint exige_sintoma_symptom check (
  tipo <> 'sintoma' or dados ? 'symptom'
);

alter table registros drop constraint if exists vocab_sintoma_intensity;
alter table registros add  constraint vocab_sintoma_intensity check (
  tipo <> 'sintoma' or dados->>'intensity' is null or dados->>'intensity' in ('mild', 'moderate', 'high')
);

alter table registros drop constraint if exists vocab_atividade_activity;
alter table registros add  constraint vocab_atividade_activity check (
  tipo <> 'atividade' or dados->>'activity' in ('tummy_time', 'sunbath', 'play', 'music', 'massage', 'other')
);

alter table registros drop constraint if exists exige_atividade_activity;
alter table registros add  constraint exige_atividade_activity check (
  tipo <> 'atividade' or dados ? 'activity'
);

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- 1 · As restrições esperadas estão todas lá?
--     Esperado: 18 linhas, nenhuma com faltando = true.
--
-- select nome, not exists (
--          select 1 from pg_constraint
--          where conrelid = 'registros'::regclass and conname = nome
--        ) as faltando
-- from unnest(array['tipo_conhecido', 'faixa_duration_seconds', 'faixa_amount_ml', 'vocab_amamentar_side', 'exige_amamentar_side', 'exige_mamadeira_amount_ml', 'vocab_mamadeira_bottle_type', 'exige_mamadeira_bottle_type', 'vocab_fralda_content', 'exige_fralda_content', 'vocab_humor_mood', 'exige_humor_mood', 'vocab_humor_probable_reason', 'vocab_sintoma_symptom', 'exige_sintoma_symptom', 'vocab_sintoma_intensity', 'vocab_atividade_activity', 'exige_atividade_activity']) as nome
-- order by faltando desc, nome;
--
-- 2 · Sobrou alguma que o schema não declara mais?
--     Esperado: nenhuma linha. Cada uma que aparecer é regra que o TypeScript
--     esqueceu e o banco continua aplicando — ver o aviso do cabeçalho.
--
-- select conname
-- from pg_constraint
-- where conrelid = 'registros'::regclass
--   and contype = 'c'
--   and conname <> all (array['tipo_conhecido', 'faixa_duration_seconds', 'faixa_amount_ml', 'vocab_amamentar_side', 'exige_amamentar_side', 'exige_mamadeira_amount_ml', 'vocab_mamadeira_bottle_type', 'exige_mamadeira_bottle_type', 'vocab_fralda_content', 'exige_fralda_content', 'vocab_humor_mood', 'exige_humor_mood', 'vocab_humor_probable_reason', 'vocab_sintoma_symptom', 'exige_sintoma_symptom', 'vocab_sintoma_intensity', 'vocab_atividade_activity', 'exige_atividade_activity']);
