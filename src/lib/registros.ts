// Acesso às tabelas de registro (feeding_records, sleep_records, diaper_records,
// mood_records, symptom_records).
// Diferente de `babies`, aqui não vai user_id no insert: a policy dessas tabelas é
// `for all using (exists ... babies.user_id = auth.uid())`, ou seja, o vínculo com o
// dono vem do baby_id. Mandar user_id quebraria — a coluna nem existe.

import { supabase } from './supabase';
import { formatarDuracaoMin, formatarMomento, minutosEntre } from './horario';
import { paginar, type CursorRegistro, type Pagina } from './paginacao';

export type { CursorRegistro } from './paginacao';
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

/**
 * Tipo do app → tabela do banco. Amamentar e mamadeira caem na mesma tabela: quem
 * separa os dois é a coluna `type`, não a tabela.
 */
const TABELA: Record<TipoRegistro, string> = {
  amamentar: 'feeding_records',
  mamadeira: 'feeding_records',
  fralda: 'diaper_records',
  sono: 'sleep_records',
  humor: 'mood_records',
  sintoma: 'symptom_records',
};

/** Coluna que ancora o registro na linha do tempo — varia por tabela. */
const COLUNA_TEMPO: Record<TipoRegistro, 'started_at' | 'recorded_at'> = {
  amamentar: 'started_at',
  mamadeira: 'started_at',
  fralda: 'recorded_at',
  sono: 'started_at',
  humor: 'recorded_at',
  sintoma: 'recorded_at',
};

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

export type OpcoesListagem = {
  /** Início da janela. Null = sem limite inferior (é o que a Home usa). */
  desde?: Date | null;
  /** Quantos registros por página. */
  limite?: number;
  /** Null na primeira página; depois, o `proximoCursor` da anterior. */
  cursor?: CursorRegistro | null;
  /** Null ou lista vazia = todos os tipos. */
  tipos?: TipoRegistro[] | null;
  agora?: Date;
};

export type PaginaRegistros = Pagina<RegistroRecente>;

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

/**
 * Apaga um registro de vez — hard delete, sem `deleted_at`.
 *
 * Soft delete complicaria a promessa de exclusão do termo LGPD (linha marcada
 * continua sendo dado guardado) sem nenhum ganho no beta, já que não existe
 * "desfazer".
 *
 * ATENÇÃO ao `.select()`: quando a RLS barra a linha, o PostgREST **não devolve
 * erro**. O `delete` simplesmente não casa nada, e a resposta volta com sucesso e
 * zero linhas. Sem o `.select()` pra contar o que saiu, a tela diria "apagado"
 * para um registro que continua no banco — que é exatamente o cenário que o teste
 * de RLS de duas contas precisa detectar.
 *
 * `apagado: false` com `error: null` é o caso legítimo de nada ter casado: a mãe
 * tocou duas vezes, ou apagou o mesmo registro noutro aparelho. O estado desejado
 * já está lá, então não é erro pra ela — mas fica no log, porque pela interface
 * ela só enxerga os próprios registros e isso não deveria acontecer.
 */
export async function apagarRegistro(
  tipo: TipoRegistro,
  id: string
): Promise<{ apagado: boolean; error: string | null }> {
  const { data, error } = await supabase.from(TABELA[tipo]).delete().eq('id', id).select('id');

  if (error) {
    console.warn(`[registros] falha ao apagar ${tipo}:`, error.message);
    return { apagado: false, error: 'Não consegui apagar esse registro agora. Tenta de novo em instantes.' };
  }

  const apagado = (data ?? []).length > 0;
  if (!apagado) {
    console.warn(
      `[registros] delete de ${tipo} ${id} não casou nenhuma linha — ` +
        'já tinha sido apagado, ou a RLS barrou.'
    );
  }
  return { apagado, error: null };
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

/** Uma linha do registro aberto: "Lado" / "Peito esquerdo". */
export type CampoDetalhe = { rotulo: string; valor: string };

/**
 * Registro aberto na tela de detalhe. Os `campos` já vêm rotulados em PT-BR daqui:
 * a tela não conhece slug nenhum, e o vocabulário continua morando num lugar só.
 */
export type DetalheRegistro = {
  id: string;
  tipo: TipoRegistro;
  ocorridoEm: string;
  resumo: string;
  emAndamento: boolean;
  campos: CampoDetalhe[];
  notas: string | null;
};

function camposDe(tipo: TipoRegistro, linha: any, agora: Date): CampoDetalhe[] {
  const campos: CampoDetalhe[] = [];
  const push = (rotulo: string, valor: string | null | undefined) => {
    if (valor) campos.push({ rotulo, valor });
  };

  if (tipo === 'amamentar') {
    const r = linha as FeedingRecord;
    push('Lado', r.side ? LADO[r.side] : null);
    push(
      'Duração',
      r.duration_seconds ? formatarDuracaoMin(Math.round(r.duration_seconds / 60)) : null
    );
    push('Início', formatarMomento(r.started_at, agora));
  } else if (tipo === 'mamadeira') {
    const r = linha as FeedingRecord;
    push('Quantidade', r.amount_ml ? `${r.amount_ml} ml` : null);
    push('Tipo de leite', r.bottle_type ? LEITE[r.bottle_type] : null);
    push('Início', formatarMomento(r.started_at, agora));
  } else if (tipo === 'sono') {
    const r = linha as SleepRecord;
    push('Começou', formatarMomento(r.started_at, agora));
    if (r.ended_at) {
      push('Terminou', formatarMomento(r.ended_at, agora));
      push('Duração', formatarDuracaoMin(minutosEntre(r.started_at, r.ended_at)));
    } else {
      push('Terminou', 'ainda dormindo');
      push('Até agora', formatarDuracaoMin(minutosEntre(r.started_at, agora)));
    }
  } else if (tipo === 'fralda') {
    const r = linha as DiaperRecord;
    push('Conteúdo', FRALDA[r.content]);
    push('Quando', formatarMomento(r.recorded_at, agora));
  } else if (tipo === 'humor') {
    const r = linha as MoodRecord;
    push('Estado', rotular(HUMORES, r.mood) ?? r.mood);
    // 'unknown' vira frase, não "Não sei" pendurado num rótulo de motivo.
    push(
      'Motivo provável',
      r.probable_reason === 'unknown'
        ? 'não identificado'
        : rotular(MOTIVOS_HUMOR, r.probable_reason)
    );
    push('Quando', formatarMomento(r.recorded_at, agora));
  } else if (tipo === 'sintoma') {
    const r = linha as SymptomRecord;
    push('Sintoma', rotular([...SINTOMAS, ...SINTOMAS_APOSENTADOS], r.symptom) ?? r.symptom);
    push('Intensidade', rotular(INTENSIDADES, r.intensity));
    push('Quando', formatarMomento(r.recorded_at, agora));
  }

  return campos;
}

/**
 * Busca um registro só, pra tela de detalhe.
 *
 * `maybeSingle` em vez de `single`: registro apagado noutro aparelho volta como
 * `data: null` sem virar exceção, e a tela mostra "esse registro não está mais
 * aqui" em vez de um erro genérico.
 */
export async function buscarRegistro(
  tipo: TipoRegistro,
  id: string,
  agora: Date = new Date()
): Promise<Resultado<DetalheRegistro | null>> {
  const { data, error } = await supabase
    .from(TABELA[tipo])
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn(`[registros] falha ao buscar ${tipo}:`, error.message);
    return { data: null, error: 'Não consegui abrir esse registro agora.' };
  }
  if (!data) return { data: null, error: null };

  const emAndamento = tipo === 'sono' && (data as SleepRecord).ended_at === null;

  const resumo =
    tipo === 'sono'
      ? resumirSono(data as SleepRecord, agora)
      : tipo === 'fralda'
        ? FRALDA[(data as DiaperRecord).content]
        : tipo === 'humor'
          ? resumirHumor(data as MoodRecord)
          : tipo === 'sintoma'
            ? resumirSintoma(data as SymptomRecord)
            : resumirAlimentacao(data as FeedingRecord);

  return {
    data: {
      id: data.id,
      tipo,
      ocorridoEm: data[COLUNA_TEMPO[tipo]],
      resumo,
      emAndamento,
      campos: camposDe(tipo, data, agora),
      // Sono é a única tabela sem coluna `notes`.
      notas: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null,
    },
    error: null,
  };
}

/** Quais tabelas precisam ser consultadas pra atender os tipos pedidos. */
function tabelasPara(tipos: TipoRegistro[] | null | undefined): {
  alimentacao: 'ambos' | 'breast' | 'bottle' | null;
  sono: boolean;
  fralda: boolean;
  humor: boolean;
  sintoma: boolean;
} {
  const todos = !tipos || tipos.length === 0;
  const tem = (t: TipoRegistro) => todos || tipos!.includes(t);

  const peito = tem('amamentar');
  const mamadeira = tem('mamadeira');

  return {
    // Uma tabela só pros dois. Pedindo só um deles, o filtro vai na coluna `type` —
    // sem isso "carregar mais" de amamentação traria mamadeira junto.
    alimentacao: peito && mamadeira ? 'ambos' : peito ? 'breast' : mamadeira ? 'bottle' : null,
    sono: tem('sono'),
    fralda: tem('fralda'),
    humor: tem('humor'),
    sintoma: tem('sintoma'),
  };
}

/**
 * Uma página da lista unificada, da mais recente pra mais antiga.
 *
 * COMO A PAGINAÇÃO FUNCIONA COM 5 TABELAS
 *
 * Cada tabela devolve suas `limite + 1` linhas mais recentes que ainda estão
 * atrás do cursor. A união dessas fatias contém, com certeza, as `limite` linhas
 * mais recentes da união inteira — é o argumento do merge de k listas ordenadas:
 * a i-ésima linha do resultado global não pode estar além da i-ésima posição de
 * nenhuma tabela isolada.
 *
 * Por isso não dá pra paginar cada tabela por conta própria: cinco cursores
 * independentes andam em velocidades diferentes e "carregar mais" traria janelas
 * de tempo desalinhadas por tipo — a mãe veria sono de terça ao lado de mamada de
 * domingo.
 *
 * O `+1` também é quem responde `temMais` sem consulta extra: sobrou candidato
 * além do limite, há mais; não sobrou, nenhuma tabela chegou a ser truncada e a
 * janela acabou.
 *
 * Se uma das buscas falhar, devolve o que deu certo e ainda assim reporta o erro —
 * some com um pedaço da lista, não com a lista inteira. `data` e `error` são
 * independentes de propósito: lista vazia e falha de rede são estados diferentes,
 * e a tela precisa dizer coisas diferentes pra cada um.
 */
export async function listarRegistros(
  babyId: string,
  opcoes: OpcoesListagem = {}
): Promise<Resultado<PaginaRegistros>> {
  const { desde = null, limite = 8, cursor = null, tipos = null, agora = new Date() } = opcoes;

  const alvo = tabelasPara(tipos);
  const teto = limite + 1;

  // Uma consulta por tabela, todas com a mesma janela e o mesmo cursor.
  function consultar(tabela: string, coluna: 'started_at' | 'recorded_at') {
    let q = supabase.from(tabela).select('*').eq('baby_id', babyId);
    if (desde) q = q.gte(coluna, desde.toISOString());
    // `lte` e não `lt`: o cursor pode ter empatado no instante com outra linha, e
    // essas empatadas precisam vir pra serem desempatadas por id aqui no cliente.
    if (cursor) q = q.lte(coluna, cursor.ocorridoEm);
    return q.order(coluna, { ascending: false }).limit(teto);
  }

  const vazio = { data: null, error: null } as const;

  const [alimentacao, sono, fralda, humor, sintoma] = await Promise.all([
    alvo.alimentacao
      ? (() => {
          const q = consultar('feeding_records', 'started_at');
          return alvo.alimentacao === 'ambos'
            ? q
            : q.eq('type', alvo.alimentacao === 'breast' ? 'breast' : 'bottle');
        })()
      : vazio,
    alvo.sono ? consultar('sleep_records', 'started_at') : vazio,
    alvo.fralda ? consultar('diaper_records', 'recorded_at') : vazio,
    alvo.humor ? consultar('mood_records', 'recorded_at') : vazio,
    alvo.sintoma ? consultar('symptom_records', 'recorded_at') : vazio,
  ]);

  const falhas = [alimentacao.error, sono.error, fralda.error, humor.error, sintoma.error].filter(
    Boolean
  );
  falhas.forEach((erro) => console.warn('[registros] falha ao listar:', erro?.message));

  const candidatos: RegistroRecente[] = [
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

  return {
    data: paginar(candidatos, limite, cursor),
    error: falhas.length > 0 ? ERRO_LISTAR : null,
  };
}

/**
 * Os últimos registros do bebê, sem janela e sem paginação — o que a Home consome.
 *
 * Assinatura preservada de propósito: `listarRegistros` nasceu debaixo dela, não no
 * lugar dela. Os defaults reproduzem exatamente a chamada antiga (sem `desde`, sem
 * `cursor`, todos os tipos), então a Home não muda de comportamento nem de código.
 */
export async function listarRegistrosRecentes(
  babyId: string,
  limite: number = 8,
  agora: Date = new Date()
): Promise<Resultado<RegistroRecente[]>> {
  const { data, error } = await listarRegistros(babyId, { limite, agora });
  return { data: data.registros, error };
}
