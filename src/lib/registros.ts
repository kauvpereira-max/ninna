// Acesso às tabelas de registro (feeding_records, sleep_records, diaper_records,
// mood_records, symptom_records).
// Diferente de `babies`, aqui não vai user_id no insert: a policy dessas tabelas é
// `for all using (exists ... babies.user_id = auth.uid())`, ou seja, o vínculo com o
// dono vem do baby_id. Mandar user_id quebraria — a coluna nem existe.

import { supabase } from './supabase';
import { formatarDuracaoMin, minutosEntre } from './horario';
import type {
  ConteudoFralda,
  DiaperRecord,
  FeedingRecord,
  Humor,
  Intensidade,
  LadoSeio,
  MoodRecord,
  NovaAmamentacao,
  NovaFralda,
  NovaMamadeira,
  NovoHumor,
  NovoSintoma,
  SleepRecord,
  SymptomRecord,
  TipoLeite,
} from '../types/database';

// Mesmo formato de retorno de src/lib/babies.ts: erro nunca sobe como exceção,
// vem como frase pronta pra mostrar pra mãe.
type Resultado<T> = { data: T; error: string | null };

const ERRO_SALVAR = 'Não consegui salvar esse registro agora. Tenta de novo em instantes.';
const ERRO_LISTAR = 'Não consegui buscar os últimos registros agora.';

/** Os 6 atalhos da Home. Vale também como parâmetro da rota /registro/[tipo]. */
export type TipoRegistro = 'amamentar' | 'mamadeira' | 'fralda' | 'sono' | 'humor' | 'sintoma';

export const TIPOS_REGISTRO: TipoRegistro[] = [
  'amamentar',
  'mamadeira',
  'fralda',
  'sono',
  'humor',
  'sintoma',
];

export function ehTipoRegistro(valor: string | undefined): valor is TipoRegistro {
  return TIPOS_REGISTRO.includes(valor as TipoRegistro);
}

// ============================================================
// VOCABULÁRIO FECHADO
// O que a mãe toca são rótulos em PT-BR; o que vai pro banco são estes slugs.
// Manter fechado é o que deixa o dado agregável pro motor de personalização.
// ============================================================

/**
 * Rótulos de humor são SUBSTANTIVOS, nunca adjetivos: `sex` é nullable e o app
 * não sabe o gênero do bebê. "Agitação", nunca "agitado(a)".
 */
export const HUMORES: { value: Humor; label: string }[] = [
  { value: 'happy', label: 'Alegria' },
  { value: 'calm', label: 'Tranquilidade' },
  { value: 'crying', label: 'Choro' },
  { value: 'sleepy', label: 'Com sono' },
  { value: 'agitated', label: 'Agitação' },
  { value: 'irritated', label: 'Incômodo' },
];

/**
 * Motivo provável do humor. 'unknown' ("Não sei") é resposta de primeira classe:
 * a mãe não precisa ter explicação pro que o bebê sente.
 */
export const MOTIVOS_HUMOR: { value: string; label: string }[] = [
  { value: 'hunger', label: 'Fome' },
  { value: 'sleep', label: 'Sono' },
  { value: 'diaper', label: 'Fralda' },
  { value: 'colic', label: 'Cólica' },
  { value: 'holding', label: 'Colo' },
  { value: 'unknown', label: 'Não sei' },
];

/**
 * A coluna `symptom` não tem check no banco, mas o app trata como se tivesse:
 * texto livre nunca entra aqui. Os 3 primeiros vêm da convenção comentada na
 * migration; o resto é o que mais aparece em bebê. 'other' guarda a descrição
 * da mãe em `notes`.
 */
export const SINTOMAS: { value: string; label: string }[] = [
  { value: 'fever', label: 'Febre' },
  { value: 'runny_nose', label: 'Coriza' },
  { value: 'cough', label: 'Tosse' },
  { value: 'vomit', label: 'Vômito' },
  { value: 'diarrhea', label: 'Diarreia' },
  { value: 'colic', label: 'Cólica' },
  { value: 'rash', label: 'Manchas na pele' },
  { value: 'other', label: 'Outro' },
];

/**
 * Fora dos chips, mas ainda com rótulo: 'irritability' saiu da lista porque colide
 * com o humor 'irritated' ("Incômodo") — irritação é humor, não sintoma. O banco não
 * foi tocado, então registro antigo continua legível na lista.
 */
const SINTOMAS_APOSENTADOS: { value: string; label: string }[] = [
  { value: 'irritability', label: 'Irritação' },
];

export const INTENSIDADES: { value: Intensidade; label: string }[] = [
  { value: 'mild', label: 'Leve' },
  { value: 'moderate', label: 'Moderada' },
  { value: 'high', label: 'Forte' },
];

/** Linha já pronta pra lista "Últimos registros" — as 5 tabelas normalizadas num formato só. */
export type RegistroRecente = {
  id: string;
  tipo: TipoRegistro;
  /** Instante que ancora o registro na linha do tempo (started_at / recorded_at). */
  ocorridoEm: string;
  /** Frase curta, ex.: "Peito esquerdo · 12 min". */
  resumo: string;
  /** Só o sono sem ended_at — a Home oferece encerrar. */
  emAndamento: boolean;
};

// ============================================================
// ESCRITA
// ============================================================

export async function criarAmamentacao(
  babyId: string,
  dados: NovaAmamentacao
): Promise<Resultado<FeedingRecord | null>> {
  const { data, error } = await supabase
    .from('feeding_records')
    .insert({ ...dados, baby_id: babyId, type: 'breast' })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao salvar amamentação:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as FeedingRecord, error: null };
}

export async function criarMamadeira(
  babyId: string,
  dados: NovaMamadeira
): Promise<Resultado<FeedingRecord | null>> {
  const { data, error } = await supabase
    .from('feeding_records')
    .insert({ ...dados, baby_id: babyId, type: 'bottle' })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao salvar mamadeira:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as FeedingRecord, error: null };
}

export async function criarFralda(
  babyId: string,
  dados: NovaFralda
): Promise<Resultado<DiaperRecord | null>> {
  const { data, error } = await supabase
    .from('diaper_records')
    .insert({ ...dados, baby_id: babyId })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao salvar fralda:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as DiaperRecord, error: null };
}

export async function criarHumor(
  babyId: string,
  dados: NovoHumor
): Promise<Resultado<MoodRecord | null>> {
  const { data, error } = await supabase
    .from('mood_records')
    .insert({ ...dados, baby_id: babyId })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao salvar humor:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as MoodRecord, error: null };
}

export async function criarSintoma(
  babyId: string,
  dados: NovoSintoma
): Promise<Resultado<SymptomRecord | null>> {
  const { data, error } = await supabase
    .from('symptom_records')
    .insert({ ...dados, baby_id: babyId })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao salvar sintoma:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as SymptomRecord, error: null };
}

/**
 * Abre um sono em andamento: ended_at fica null até a mãe encerrar.
 *
 * Recusa se já houver um sono aberto — dois registros correndo ao mesmo tempo
 * sujariam o cálculo de duração média do motor de personalização.
 */
export async function iniciarSono(
  babyId: string,
  startedAt: string
): Promise<Resultado<SleepRecord | null>> {
  const emAndamento = await supabase
    .from('sleep_records')
    .select('id')
    .eq('baby_id', babyId)
    .is('ended_at', null)
    .limit(1);

  if (emAndamento.error) {
    console.warn('[registros] falha ao checar sono em andamento:', emAndamento.error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  if ((emAndamento.data ?? []).length > 0) {
    return {
      data: null,
      error: 'Ainda tem um sono correndo — encerra ele na Home antes de começar outro.',
    };
  }

  const { data, error } = await supabase
    .from('sleep_records')
    .insert({ baby_id: babyId, started_at: startedAt, ended_at: null })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao iniciar sono:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as SleepRecord, error: null };
}

/**
 * Fecha o sono em andamento. `is('ended_at', null)` evita reescrever a hora de fim de um
 * sono que já foi encerrado noutro aparelho — nesse caso não casa linha nenhuma, e isso
 * não é erro: o estado desejado já está lá, então volta sem mensagem.
 */
export async function encerrarSono(
  sonoId: string,
  endedAt: string = new Date().toISOString()
): Promise<Resultado<SleepRecord | null>> {
  const { data, error } = await supabase
    .from('sleep_records')
    .update({ ended_at: endedAt })
    .eq('id', sonoId)
    .is('ended_at', null)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[registros] falha ao encerrar sono:', error.message);
    return { data: null, error: 'Não consegui encerrar esse sono agora. Tenta de novo em instantes.' };
  }
  return { data: (data as SleepRecord) ?? null, error: null };
}

// ============================================================
// LEITURA
// ============================================================

const LADO: Record<LadoSeio, string> = {
  left: 'Peito esquerdo',
  right: 'Peito direito',
  both: 'Os dois peitos',
};

const LEITE: Record<TipoLeite, string> = {
  breast_milk: 'leite materno',
  formula: 'fórmula',
};

const FRALDA: Record<ConteudoFralda, string> = {
  pee: 'Xixi',
  poop: 'Cocô',
  both: 'Xixi e cocô',
};

function rotular(lista: { value: string; label: string }[], valor: string | null): string | null {
  if (!valor) return null;
  // Registro antigo com valor fora da lista não some da tela: cai no próprio slug.
  return lista.find((item) => item.value === valor)?.label ?? valor;
}

function resumirAlimentacao(r: FeedingRecord): string {
  if (r.type === 'bottle') {
    const leite = r.bottle_type ? ` de ${LEITE[r.bottle_type]}` : '';
    return r.amount_ml ? `${r.amount_ml} ml${leite}` : `Mamadeira${leite}`;
  }

  const lado = r.side ? LADO[r.side] : 'Peito';
  if (!r.duration_seconds) return lado;
  return `${lado} · ${formatarDuracaoMin(Math.round(r.duration_seconds / 60))}`;
}

/**
 * Texto do sono ainda aberto. A Home recalcula isso num tick local, então é aqui que
 * mora a regra — abaixo de 2 minutos não vale falar em duração, o sono mal começou.
 */
export function resumirSonoEmAndamento(startedAt: string, agora: Date = new Date()): string {
  const minutos = minutosEntre(startedAt, agora);
  if (minutos < 2) return 'Dormindo agora';
  return `Dormindo há ${formatarDuracaoMin(minutos)}`;
}

function resumirSono(r: SleepRecord, agora: Date): string {
  if (!r.ended_at) return resumirSonoEmAndamento(r.started_at, agora);
  return `${formatarDuracaoMin(minutosEntre(r.started_at, r.ended_at))} de sono`;
}

function resumirHumor(r: MoodRecord): string {
  const humor = rotular(HUMORES, r.mood) ?? r.mood;
  const motivo = rotular(MOTIVOS_HUMOR, r.probable_reason);
  if (!motivo) return humor;
  // 'unknown' vira "motivo não identificado", não "por Não sei".
  if (r.probable_reason === 'unknown') return `${humor} · motivo não identificado`;
  return `${humor} · ${motivo.toLowerCase()}`;
}

function resumirSintoma(r: SymptomRecord): string {
  // Em 'other' a descrição da mãe está em notes — é ela que diz alguma coisa na lista.
  const nome =
    r.symptom === 'other' && r.notes?.trim()
      ? r.notes.trim()
      : rotular([...SINTOMAS, ...SINTOMAS_APOSENTADOS], r.symptom) ?? r.symptom;
  const intensidade = rotular(INTENSIDADES, r.intensity);
  if (!intensidade) return nome;
  return `${nome} · ${intensidade.toLowerCase()}`;
}

/**
 * Junta as 5 tabelas numa lista só, da mais recente pra mais antiga.
 * Se uma das buscas falhar, devolve o que deu certo e ainda assim reporta o erro —
 * some com um pedaço da lista, não com a lista inteira.
 */
export async function listarRegistrosRecentes(
  babyId: string,
  limite: number = 8,
  agora: Date = new Date()
): Promise<Resultado<RegistroRecente[]>> {
  const [alimentacao, sono, fralda, humor, sintoma] = await Promise.all([
    supabase
      .from('feeding_records')
      .select('*')
      .eq('baby_id', babyId)
      .order('started_at', { ascending: false })
      .limit(limite),
    supabase
      .from('sleep_records')
      .select('*')
      .eq('baby_id', babyId)
      .order('started_at', { ascending: false })
      .limit(limite),
    supabase
      .from('diaper_records')
      .select('*')
      .eq('baby_id', babyId)
      .order('recorded_at', { ascending: false })
      .limit(limite),
    supabase
      .from('mood_records')
      .select('*')
      .eq('baby_id', babyId)
      .order('recorded_at', { ascending: false })
      .limit(limite),
    supabase
      .from('symptom_records')
      .select('*')
      .eq('baby_id', babyId)
      .order('recorded_at', { ascending: false })
      .limit(limite),
  ]);

  const falhas = [alimentacao.error, sono.error, fralda.error, humor.error, sintoma.error].filter(
    Boolean
  );
  falhas.forEach((erro) => console.warn('[registros] falha ao listar:', erro?.message));

  const linhas: RegistroRecente[] = [
    ...((alimentacao.data ?? []) as FeedingRecord[]).map((r) => ({
      id: r.id,
      tipo: (r.type === 'bottle' ? 'mamadeira' : 'amamentar') as TipoRegistro,
      ocorridoEm: r.started_at,
      resumo: resumirAlimentacao(r),
      emAndamento: false,
    })),
    ...((sono.data ?? []) as SleepRecord[]).map((r) => ({
      id: r.id,
      tipo: 'sono' as TipoRegistro,
      ocorridoEm: r.started_at,
      resumo: resumirSono(r, agora),
      emAndamento: r.ended_at === null,
    })),
    ...((fralda.data ?? []) as DiaperRecord[]).map((r) => ({
      id: r.id,
      tipo: 'fralda' as TipoRegistro,
      ocorridoEm: r.recorded_at,
      resumo: FRALDA[r.content],
      emAndamento: false,
    })),
    ...((humor.data ?? []) as MoodRecord[]).map((r) => ({
      id: r.id,
      tipo: 'humor' as TipoRegistro,
      ocorridoEm: r.recorded_at,
      resumo: resumirHumor(r),
      emAndamento: false,
    })),
    ...((sintoma.data ?? []) as SymptomRecord[]).map((r) => ({
      id: r.id,
      tipo: 'sintoma' as TipoRegistro,
      ocorridoEm: r.recorded_at,
      resumo: resumirSintoma(r),
      emAndamento: false,
    })),
  ];

  linhas.sort((a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime());

  return {
    data: linhas.slice(0, limite),
    error: falhas.length > 0 ? ERRO_LISTAR : null,
  };
}
