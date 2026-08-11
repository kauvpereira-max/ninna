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
//
// Uma tabela para os seis tipos, e para os catorze que faltam — espelha
// `supabase/migrations/005_registros.sql`, que por sua vez é GERADA do
// `registroSchema.ts`. Mexer no vocabulário abaixo sem regerar a migration
// quebra o `teste-registros-sql.ts`.
//
// Não existe coluna user_id: a RLS é `for all using (...)` com join em babies,
// então o baby_id correto já basta pro insert passar.
//
// As cinco tabelas antigas (feeding_records e companhia) continuam no banco até
// a `006`, mas o app não as lê nem escreve nelas desde o bloco 3 — por isso os
// tipos delas saíram daqui. Tipo de tabela que ninguém consulta é documentação
// que envelhece sem ninguém notar.
// ============================================================

export type LadoSeio = 'left' | 'right' | 'both';
export type TipoLeite = 'breast_milk' | 'formula';
export type ConteudoFralda = 'pee' | 'poop' | 'both';
export type Humor = 'happy' | 'irritated' | 'crying' | 'sleepy' | 'calm' | 'agitated';
export type Intensidade = 'mild' | 'moderate' | 'high';

export type Registro = {
  id: string;
  baby_id: string;
  /**
   * A união em si mora no `registroSchema.ts` (`TipoRegistro`), que é quem gera
   * o `check` desta coluna. Aqui fica `string` de propósito: este arquivo
   * descreve a FORMA da linha, e importar de lá inverteria a direção — o schema
   * é que importa os vocabulários daqui.
   */
  tipo: string;
  /** Ancora o registro na linha do tempo. Substituiu started_at/recorded_at. */
  ocorrido_em: string;
  /** Fim do evento, quando ele tem duração. Null no sono ainda em andamento. */
  terminou_em: string | null;
  /**
   * O que varia por tipo, com vocabulário garantido por `check` condicionado ao
   * tipo. As chaves possíveis são os `coluna` dos campos do schema: `side`,
   * `duration_seconds`, `amount_ml`, `bottle_type`, `content`, `mood`,
   * `probable_reason`, `symptom`, `intensity` — e `color`, que só existe nas
   * fralda migradas e que o app nunca escreveu.
   */
  dados: Record<string, unknown>;
  /** Texto livre da mãe. Coluna, e não chave no `dados`: não tem vocabulário. */
  notes: string | null;
  created_at: string;
  /**
   * Colunas GERADAS a partir do `dados`, para o `check` de faixa ficar legível e
   * o número ser somável em SQL. Não se escreve nelas — o Postgres recalcula.
   */
  duration_seconds: number | null;
  amount_ml: number | null;
};
