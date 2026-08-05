// Tipos do banco — espelham supabase/migrations/001_schema_inicial.sql.
// Escritos à mão (o CLI do Supabase ainda não está configurado no projeto).
// Ao mexer numa migration, atualizar este arquivo junto.

export type Sexo = 'F' | 'M';

export type Baby = {
  id: string;
  user_id: string;
  name: string;
  /** Coluna `date` do Postgres — sempre no formato 'AAAA-MM-DD', sem fuso. */
  birth_date: string;
  sex: Sexo | null;
  premature: boolean;
  /** Só preenchido quando premature = true; usado pra calcular a idade corrigida. */
  weeks_early: number | null;
  weight_at_birth_g: number | null;
  height_at_birth_cm: number | null;
  created_at: string;
};

/** O que a tela de cadastro monta. `user_id` entra na camada de dados, não no formulário. */
export type NovoBebe = {
  name: string;
  birth_date: string;
  sex: Sexo | null;
  premature: boolean;
  weeks_early: number | null;
  weight_at_birth_g: number | null;
  height_at_birth_cm: number | null;
};

// ============================================================
// REGISTROS
// Nas tabelas abaixo não existe coluna user_id: a RLS é `for all using (...)`
// com join em babies, então o baby_id correto já basta pro insert passar.
// ============================================================

/** A mesma tabela guarda peito e mamadeira — a coluna `type` separa os dois. */
export type TipoAlimentacao = 'breast' | 'bottle';
export type LadoSeio = 'left' | 'right' | 'both';
export type TipoLeite = 'breast_milk' | 'formula';
export type ConteudoFralda = 'pee' | 'poop' | 'both';

export type FeedingRecord = {
  id: string;
  baby_id: string;
  type: TipoAlimentacao;
  /** Só preenchido quando type = 'breast'. */
  side: LadoSeio | null;
  /** Só preenchido quando type = 'breast'. */
  duration_seconds: number | null;
  /** Só preenchido quando type = 'bottle'. */
  amount_ml: number | null;
  /** Só preenchido quando type = 'bottle'. */
  bottle_type: TipoLeite | null;
  started_at: string;
  notes: string | null;
  created_at: string;
};

export type NovaAmamentacao = {
  side: LadoSeio;
  duration_seconds: number | null;
  started_at: string;
  notes: string | null;
};

export type NovaMamadeira = {
  amount_ml: number;
  bottle_type: TipoLeite;
  started_at: string;
  notes: string | null;
};

export type SleepRecord = {
  id: string;
  baby_id: string;
  started_at: string;
  /** Null enquanto o bebê ainda está dormindo. */
  ended_at: string | null;
  created_at: string;
};

export type DiaperRecord = {
  id: string;
  baby_id: string;
  content: ConteudoFralda;
  color: string | null;
  recorded_at: string;
  notes: string | null;
  created_at: string;
};

export type NovaFralda = {
  content: ConteudoFralda;
  recorded_at: string;
  notes: string | null;
};

export type Humor = 'happy' | 'irritated' | 'crying' | 'sleepy' | 'calm' | 'agitated';

export type MoodRecord = {
  id: string;
  baby_id: string;
  mood: Humor;
  /** Texto livre no banco; o app grava só os motivos da lista (inclusive 'unknown'). */
  probable_reason: string | null;
  notes: string | null;
  recorded_at: string;
  created_at: string;
};

export type NovoHumor = {
  mood: Humor;
  probable_reason: string | null;
  recorded_at: string;
  notes: string | null;
};

export type Intensidade = 'mild' | 'moderate' | 'high';

export type SymptomRecord = {
  id: string;
  baby_id: string;
  /**
   * A coluna não tem check — é texto livre no banco. O app só grava valores de
   * `SINTOMAS` (ver src/lib/registros.ts): dado agregável é requisito do motor de
   * personalização. Descrição da mãe vai em `notes`, com symptom = 'other'.
   */
  symptom: string;
  intensity: Intensidade | null;
  notes: string | null;
  recorded_at: string;
  created_at: string;
};

export type NovoSintoma = {
  symptom: string;
  intensity: Intensidade | null;
  recorded_at: string;
  notes: string | null;
};
