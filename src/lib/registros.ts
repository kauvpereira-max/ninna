// Acesso às tabelas de registro (feeding_records, sleep_records, diaper_records,
// mood_records, symptom_records).
// Diferente de `babies`, aqui não vai user_id no insert: a policy dessas tabelas é
// `for all using (exists ... babies.user_id = auth.uid())`, ou seja, o vínculo com o
// dono vem do baby_id. Mandar user_id quebraria — a coluna nem existe.

import { supabase } from './supabase';
import { formatarDuracaoMin, formatarMomento, minutosEntre } from './horario';
import { paginar, type CursorRegistro, type Pagina } from './paginacao';
import type { TipoEvento } from './consultas';
import {
  CONTEUDOS_FRALDA,
  INTENSIDADES,
  HUMORES,
  LADOS,
  LEITES,
  MOTIVOS_HUMOR,
  SCHEMAS,
  SINTOMAS,
  SINTOMAS_APOSENTADOS,
  TIPOS_REGISTRO,
  LEITURA,
  TABELAS_DE_REGISTRO,
  linhaParaBanco,
  rotularValor,
  tipoDaLinha,
  tiposDaTabela,
  type CampoDetalhe,
  type LinhaRegistro,
  type TipoRegistro,
  type ValoresRegistro,
} from './registroSchema.ts';

export type { CursorRegistro } from './paginacao';
import type { SleepRecord } from '../types/database';

// Mesmo formato de retorno de src/lib/babies.ts: erro nunca sobe como exceção,
// vem como frase pronta pra mostrar pra mãe.
type Resultado<T> = { data: T; error: string | null };

const ERRO_SALVAR = 'Não consegui salvar esse registro agora. Tenta de novo em instantes.';
const ERRO_LISTAR = 'Não consegui buscar os últimos registros agora.';

/**
 * A declaração dos tipos mora em `registroSchema.ts` — este módulo é o lado que
 * fala com o banco. Reexportado aqui porque as telas já importavam daqui, e
 * mover o import de 6 arquivos não é o trabalho que o bloco 2 se propôs.
 */
export {
  TIPOS_REGISTRO,
  ehTipoRegistro,
  HUMORES,
  MOTIVOS_HUMOR,
  SINTOMAS,
  INTENSIDADES,
  SINTOMA_OUTRO,
  resumirSonoEmAndamento,
  type CampoDetalhe,
  type TipoRegistro,
} from './registroSchema.ts';

/**
 * Trava contra deriva com `consultas.ts`.
 *
 * Aquele módulo declara a mesma união por conta própria — ele roda também no
 * Deno da Edge Function, onde este arquivo não pode ir (importa o Supabase e o
 * AsyncStorage). A conferência mora aqui porque este lado pode importar os dois.
 * Se as duas uniões divergirem, a linha abaixo para de compilar.
 */
type SaoIguais<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _uniaoConfere: SaoIguais<TipoRegistro, TipoEvento> = true;
void _uniaoConfere;

/** Tabela e coluna de tempo saem do schema — não há segunda tabela de verdade. */
const TABELA = (tipo: TipoRegistro) => SCHEMAS[tipo].tabela;
const COLUNA_TEMPO = (tipo: TipoRegistro) => SCHEMAS[tipo].colunaTempo;

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

/**
 * Grava um registro qualquer.
 *
 * Uma função no lugar de cinco. O que variava entre elas — tabela, colunas
 * fixas, coluna de tempo, quais campos existem — está declarado no schema, e o
 * que sobra é idêntico: montar a linha, inserir, e traduzir falha em frase.
 *
 * A validação NÃO acontece aqui: quem valida é a tela, com a mesma
 * `validarRegistro` do schema, antes de chegar neste ponto. Validar de novo
 * criaria um segundo lugar para as regras discordarem — e o vocabulário fechado
 * já é garantido lá, com a frase certa ao lado do campo certo.
 *
 * Sono não passa por aqui: ele abre em aberto e tem a regra de "só um por vez",
 * que precisa consultar o banco. Ver `iniciarSono`.
 */
export async function criarRegistro(
  tipo: TipoRegistro,
  babyId: string,
  valores: ValoresRegistro,
  ocorridoEm: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABELA(tipo))
    .insert({ ...linhaParaBanco(tipo, valores, ocorridoEm), baby_id: babyId });

  if (error) {
    console.warn(`[registros] falha ao salvar ${tipo}:`, error.message);
    return { error: ERRO_SALVAR };
  }
  return { error: null };
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
      error: 'Ainda tem um sono correndo — encerra esse sono na Home antes de começar outro.',
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
  const { data, error } = await supabase.from(TABELA(tipo)).delete().eq('id', id).select('id');

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

/**
 * Registro aberto na tela de detalhe. Os `campos` já vêm rotulados em PT-BR do
 * schema: a tela não conhece slug nenhum, e o vocabulário mora num lugar só.
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

/** O que a lista e o detalhe têm em comum: uma linha crua vira registro do app. */
function normalizar(tipo: TipoRegistro, linha: LinhaRegistro, agora: Date): RegistroRecente {
  const leitura = LEITURA[tipo];
  return {
    id: String(linha.id),
    tipo,
    ocorridoEm: String(linha[SCHEMAS[tipo].colunaTempo]),
    resumo: leitura.resumir(linha, agora),
    emAndamento: leitura.emAndamento?.(linha) ?? false,
  };
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
    .from(TABELA(tipo))
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn(`[registros] falha ao buscar ${tipo}:`, error.message);
    return { data: null, error: 'Não consegui abrir esse registro agora.' };
  }
  if (!data) return { data: null, error: null };

  const linha = data as LinhaRegistro;
  const notas = linha.notes;

  return {
    data: {
      ...normalizar(tipo, linha, agora),
      campos: LEITURA[tipo].detalhar(linha, agora),
      // Sono é a única tabela sem coluna `notes`.
      notas: typeof notas === 'string' && notas.trim() ? notas.trim() : null,
    },
    error: null,
  };
}

/**
 * As linhas cruas que o motor precisa — feeding + sleep de uma janela.
 *
 * POR QUE NÃO REUSA `listarRegistros`
 *
 * A lista unificada existe pra ser mostrada: ela normaliza tudo em
 * `RegistroRecente`, e nessa normalização o `ended_at` vira o booleano
 * `emAndamento`. Para a tela isso basta ("Dormindo há 40 min"); para o motor,
 * não — sem o instante do fim não há duração de soneca. Reaproveitar aquela
 * função exigiria devolver o registro cru junto, o que engorda a lista inteira
 * pra servir a um consumidor só.
 *
 * O que É reaproveitado: o módulo, o contrato `{ data, error }`, o recorte por
 * `desde` e a regra de nunca lançar exceção. Não há caminho novo de acesso.
 *
 * Também não pagina, e é de propósito: a janela do motor é fechada em 7 dias
 * (~40 a 150 linhas), e paginar aqui só reintroduziria o problema que o D5
 * resolveu — janelas desalinhadas entre as duas tabelas. O motor precisa das
 * duas listas inteiras e alinhadas, ou de nenhuma.
 */
export type RegistrosDoMotor = {
  mamadas: { started_at: string }[];
  sonos: { started_at: string; ended_at: string | null }[];
};

export async function listarParaPadroes(
  babyId: string,
  opcoes: { desde: Date }
): Promise<Resultado<RegistrosDoMotor>> {
  const desde = opcoes.desde.toISOString();

  const [alimentacao, sono] = await Promise.all([
    supabase
      .from('feeding_records')
      .select('started_at')
      .eq('baby_id', babyId)
      .gte('started_at', desde)
      .order('started_at', { ascending: true }),
    supabase
      .from('sleep_records')
      .select('started_at, ended_at')
      .eq('baby_id', babyId)
      .gte('started_at', desde)
      .order('started_at', { ascending: true }),
  ]);

  const falha = alimentacao.error ?? sono.error;
  if (falha) console.warn('[registros] falha ao ler para o motor:', falha.message);

  // Diferente da lista, aqui falha parcial NÃO serve: um insight calculado sobre
  // metade dos dados é um número errado com cara de certeza, que é justamente o
  // R3. Sem as duas leituras, o motor não roda e o card mostra a frase de
  // aprendizado — silêncio honesto.
  if (falha) {
    return { data: { mamadas: [], sonos: [] }, error: ERRO_LISTAR };
  }

  return {
    data: {
      mamadas: (alimentacao.data ?? []) as { started_at: string }[],
      sonos: (sono.data ?? []) as { started_at: string; ended_at: string | null }[],
    },
    error: null,
  };
}

/**
 * Uma página da lista unificada, da mais recente pra mais antiga.
 *
 * COMO A PAGINAÇÃO FUNCIONA COM VÁRIAS TABELAS
 *
 * Cada tabela devolve suas `limite + 1` linhas mais recentes que ainda estão
 * atrás do cursor. A união dessas fatias contém, com certeza, as `limite` linhas
 * mais recentes da união inteira — é o argumento do merge de k listas ordenadas:
 * a i-ésima linha do resultado global não pode estar além da i-ésima posição de
 * nenhuma tabela isolada.
 *
 * Por isso não dá pra paginar cada tabela por conta própria: cursores
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
 *
 * A LISTA É POR TABELA, NÃO POR TIPO
 *
 * Antes havia uma consulta escrita à mão para cada uma das 5 tabelas, e somar um
 * tipo somava um bloco aqui. Agora as tabelas saem do schema, e o tipo de cada
 * linha volta por `tipoDaLinha` — quem grava numa tabela compartilhada se
 * distingue pela coluna fixa, que é a mesma que o insert usou.
 */
export async function listarRegistros(
  babyId: string,
  opcoes: OpcoesListagem = {}
): Promise<Resultado<PaginaRegistros>> {
  const { desde = null, limite = 8, cursor = null, tipos = null, agora = new Date() } = opcoes;

  const pedidos = !tipos || tipos.length === 0 ? TIPOS_REGISTRO : tipos;
  const teto = limite + 1;

  const buscas = TABELAS_DE_REGISTRO.map(async (tabela) => {
    const naTabela = tiposDaTabela(tabela);
    const querAqui = naTabela.filter((tipo) => pedidos.includes(tipo));
    if (querAqui.length === 0) return { data: null, error: null };

    // Tipos que dividem tabela também dividem a coluna de tempo — o schema é
    // conferido nisso pelo teste, então a primeira serve para todos.
    const coluna = SCHEMAS[naTabela[0]].colunaTempo;

    let q = supabase.from(tabela).select('*').eq('baby_id', babyId);
    if (desde) q = q.gte(coluna, desde.toISOString());
    // `lte` e não `lt`: o cursor pode ter empatado no instante com outra linha, e
    // essas empatadas precisam vir pra serem desempatadas por id aqui no cliente.
    if (cursor) q = q.lte(coluna, cursor.ocorridoEm);

    // Sem filtro quando a tabela inteira foi pedida. Pedindo só um dos tipos que
    // moram nela, o filtro vai na coluna fixa — sem isso, "carregar mais" de
    // amamentação traria mamadeira junto.
    if (querAqui.length < naTabela.length) {
      const [colunaFixa, valores] = filtroFixo(querAqui);
      if (colunaFixa) q = q.in(colunaFixa, valores);
    }

    return q.order(coluna, { ascending: false }).limit(teto);
  });

  const respostas = await Promise.all(buscas);

  const falhas = respostas.map((r) => r.error).filter(Boolean);
  falhas.forEach((erro) => console.warn('[registros] falha ao listar:', erro?.message));

  const candidatos: RegistroRecente[] = [];
  respostas.forEach((resposta, i) => {
    const tabela = TABELAS_DE_REGISTRO[i];
    for (const linha of (resposta.data ?? []) as LinhaRegistro[]) {
      const tipo = tipoDaLinha(tabela, linha);
      // Linha de um tipo que o app não conhece mais não derruba a lista: ela
      // simplesmente não aparece, e o resto continua.
      if (tipo) candidatos.push(normalizar(tipo, linha, agora));
    }
  });

  return {
    data: paginar(candidatos, limite, cursor),
    error: falhas.length > 0 ? ERRO_LISTAR : null,
  };
}

/**
 * A coluna fixa que separa tipos de uma mesma tabela, e os valores pedidos.
 *
 * Devolve `[null, []]` quando os tipos não se distinguem por uma coluna só —
 * hoje não acontece, e o dia que acontecer é melhor não filtrar do que filtrar
 * errado: lista com item a mais é visível, lista com item a menos não.
 */
function filtroFixo(tipos: TipoRegistro[]): [string | null, string[]] {
  const colunas = new Set(tipos.flatMap((t) => Object.keys(SCHEMAS[t].fixas ?? {})));
  if (colunas.size !== 1) return [null, []];

  const coluna = [...colunas][0];
  return [coluna, tipos.map((t) => SCHEMAS[t].fixas![coluna])];
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
