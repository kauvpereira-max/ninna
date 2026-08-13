// Acesso à tabela `registros` — uma linha por registro, para os seis tipos.
//
// Diferente de `babies`, aqui não vai user_id no insert: a policy é
// `for all using (exists ... babies.user_id = auth.uid())`, ou seja, o vínculo com o
// dono vem do baby_id. Mandar user_id quebraria — a coluna nem existe.
//
// ------------------------------------------------------------------
// O QUE A TABELA ÚNICA MUDOU AQUI
//
// Este módulo era, em boa parte, o preço de ter cinco tabelas: a lista era um
// merge de k listas ordenadas no cliente, o motor lia duas janelas em paralelo e
// precisava alinhá-las, e cada função começava escolhendo a tabela pelo tipo.
//
// Nada disso é decisão de produto — era consequência do schema. Com uma tabela,
// ordenação, corte e cursor voltam para o banco, que é onde índice existe.

import { supabase } from './supabase';
import { formatarHora, inicioDoDiaLocal } from './horario';
import { filtroDoCursor, paginar, type CursorRegistro, type Pagina } from './paginacao';
import { TIPOS_DO_ALVO, type TipoEvento } from './consultas';
import { ehSonoNoturno } from './padroes';
import {
  CONTEUDOS_FRALDA,
  INTENSIDADES,
  HUMORES,
  LADOS,
  LEITES,
  MOTIVOS_HUMOR,
  SINTOMAS,
  SINTOMAS_APOSENTADOS,
  TIPOS_REGISTRO,
  LEITURA,
  linhaParaBanco,
  rotularValor,
  valoresDaLinha,
  tipoDaLinha,
  type CampoDetalhe,
  type LinhaRegistro,
  type TipoRegistro,
  type ValoresRegistro,
} from './registroSchema.ts';

export type { CursorRegistro } from './paginacao';
import type { Registro } from '../types/database';

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

/**
 * A tabela. Uma, e por isso uma constante e não uma função do tipo.
 *
 * O nome fica aqui em vez de repetido em nove `.from()`: renomear tabela é raro,
 * mas renomear em oito lugares e esquecer o nono é o modo normal de fazê-lo.
 */
const TABELA = 'registros';

/** Linha já pronta pra lista "Últimos registros". */
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
 * Uma função no lugar de cinco. O que variava entre elas — quais campos existem
 * e o que cada um vale — está declarado no schema, e o que sobra é idêntico:
 * montar a linha, inserir, e traduzir falha em frase.
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
    .from(TABELA)
    .insert({ ...linhaParaBanco(tipo, valores, ocorridoEm), baby_id: babyId });

  if (error) {
    console.warn(`[registros] falha ao salvar ${tipo}:`, error.message);
    return { error: ERRO_SALVAR };
  }
  return { error: null };
}

/**
 * Abre um sono em andamento: `terminou_em` fica null até a mãe encerrar.
 *
 * Recusa se já houver um sono aberto — dois registros correndo ao mesmo tempo
 * sujariam o cálculo de duração média do motor de personalização.
 *
 * O filtro por `tipo` na checagem não é decoração: `terminou_em` nulo passou a
 * ser o normal de todos os outros cinco tipos, que não têm fim nenhum. Sem ele,
 * uma fralda trocada às 3h impediria a mãe de começar um sono.
 */
export async function iniciarSono(
  babyId: string,
  startedAt: string
): Promise<Resultado<Registro | null>> {
  const emAndamento = await supabase
    .from(TABELA)
    .select('id')
    .eq('baby_id', babyId)
    .eq('tipo', 'sono')
    .is('terminou_em', null)
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
    .from(TABELA)
    .insert({
      baby_id: babyId,
      tipo: 'sono',
      ocorrido_em: startedAt,
      terminou_em: null,
      dados: {},
    })
    .select()
    .single();

  if (error) {
    console.warn('[registros] falha ao iniciar sono:', error.message);
    return { data: null, error: ERRO_SALVAR };
  }
  return { data: data as Registro, error: null };
}

/**
 * Fecha o sono em andamento. `is('terminou_em', null)` evita reescrever a hora de fim de
 * um sono que já foi encerrado noutro aparelho — nesse caso não casa linha nenhuma, e isso
 * não é erro: o estado desejado já está lá, então volta sem mensagem.
 *
 * O `eq('tipo', 'sono')` é a mesma defesa do `iniciarSono`, por outro motivo: com
 * uma tabela só, um `id` de outro tipo chegando aqui gravaria `terminou_em` numa
 * fralda. Ele não chega pela tela — mas a tela não é a única coisa que chama.
 */
export async function encerrarSono(
  sonoId: string,
  endedAt: string = new Date().toISOString()
): Promise<Resultado<Registro | null>> {
  const { data, error } = await supabase
    .from(TABELA)
    .update({ terminou_em: endedAt })
    .eq('id', sonoId)
    .eq('tipo', 'sono')
    .is('terminou_em', null)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[registros] falha ao encerrar sono:', error.message);
    return { data: null, error: 'Não consegui encerrar esse sono agora. Tenta de novo em instantes.' };
  }
  return { data: (data as Registro) ?? null, error: null };
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
  id: string
): Promise<{ apagado: boolean; error: string | null }> {
  const { data, error } = await supabase.from(TABELA).delete().eq('id', id).select('id');

  if (error) {
    console.warn('[registros] falha ao apagar:', error.message);
    return { apagado: false, error: 'Não consegui apagar esse registro agora. Tenta de novo em instantes.' };
  }

  const apagado = (data ?? []).length > 0;
  if (!apagado) {
    console.warn(
      `[registros] delete de ${id} não casou nenhuma linha — ` +
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
  /**
   * "Ganhou 340 g desde a pesagem anterior." — só o crescimento tem.
   *
   * `null` na primeira medida, e isso é o desenho: não há o que comparar, e
   * inventar uma frase seria começar mentindo. Também `null` para os dez tipos
   * que não declaram comparação.
   */
  comparacao: string | null;
};

/** O que a lista e o detalhe têm em comum: uma linha crua vira registro do app. */
function normalizar(tipo: TipoRegistro, linha: LinhaRegistro, agora: Date): RegistroRecente {
  const leitura = LEITURA[tipo];
  return {
    id: String(linha.id),
    tipo,
    ocorridoEm: String(linha.ocorrido_em),
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
 *
 * O TIPO NÃO VEM MAIS POR PARÂMETRO, e isso é ganho de correção, não economia de
 * argumento: ele vem da própria linha. Antes a rota `/detalhe/[tipo]/[id]` dizia
 * de que tipo era o registro, e a URL é digitável na web — `/detalhe/sono/<id de
 * uma fralda>` lia a linha certa e a contava como sono. Agora quem responde é o
 * banco.
 */
export async function buscarRegistro(
  id: string,
  agora: Date = new Date()
): Promise<Resultado<DetalheRegistro | null>> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();

  if (error) {
    console.warn('[registros] falha ao buscar registro:', error.message);
    return { data: null, error: 'Não consegui abrir esse registro agora.' };
  }
  if (!data) return { data: null, error: null };

  const linha = data as LinhaRegistro;
  const tipo = tipoDaLinha(linha);
  // Tipo que este app ainda não conhece: some como se não estivesse lá, em vez
  // de abrir uma tela sem resumo e sem campos.
  if (!tipo) return { data: null, error: null };

  const notas = linha.notes;

  return {
    data: {
      ...normalizar(tipo, linha, agora),
      campos: LEITURA[tipo].detalhar(linha, agora),
      // Sono é o único tipo que nunca preenche `notes`: ele não tem o campo.
      notas: typeof notas === 'string' && notas.trim() ? notas.trim() : null,
      comparacao: await compararComAnterior(tipo, linha),
    },
    error: null,
  };
}

/**
 * A frase de comparação — uma consulta a mais, e só para quem declara precisar.
 *
 * O tipo diz se compara (`LEITURA[tipo].compararComAnterior`), e só nesse caso
 * este módulo vai ao banco buscar o registro anterior. Os dez tipos que não
 * comparam não pagam consulta nenhuma: o `if` de saída é a primeira linha.
 *
 * "Anterior" é por `ocorrido_em`, não por `created_at`: a mãe pode anotar hoje a
 * pesagem da consulta de semana passada, e a comparação certa é com a medida que
 * veio antes NO TEMPO — não com a que foi digitada antes.
 *
 * Falha de rede aqui devolve `null`, e a tela simplesmente não mostra a frase. É
 * um enfeite verdadeiro: sem ele o registro continua completo, e com uma frase
 * errada ele deixaria de estar.
 */
async function compararComAnterior(
  tipo: TipoRegistro,
  linha: LinhaRegistro
): Promise<string | null> {
  const comparar = LEITURA[tipo].compararComAnterior;
  if (!comparar) return null;

  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('baby_id', String(linha.baby_id))
    .eq('tipo', tipo)
    .lt('ocorrido_em', String(linha.ocorrido_em))
    .order('ocorrido_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[registros] falha ao buscar medida anterior:', error.message);
    return null;
  }
  if (!data) return null;

  return comparar(linha, data as LinhaRegistro);
}

/**
 * As linhas cruas que o motor precisa — mamada e sono de uma janela.
 *
 * POR QUE NÃO REUSA `listarRegistros`
 *
 * A lista unificada existe pra ser mostrada: ela normaliza tudo em
 * `RegistroRecente`, e nessa normalização o fim do sono vira o booleano
 * `emAndamento`. Para a tela isso basta ("Dormindo há 40 min"); para o motor,
 * não — sem o instante do fim não há duração de soneca. Reaproveitar aquela
 * função exigiria devolver o registro cru junto, o que engorda a lista inteira
 * pra servir a um consumidor só.
 *
 * Também não pagina, e é de propósito: a janela do motor é fechada em 7 dias
 * (~40 a 150 linhas), e paginar aqui reintroduziria o problema que o D5
 * resolveu. O motor precisa das listas inteiras, ou de nenhuma.
 *
 * ------------------------------------------------------------------
 * UMA JANELA, E ISSO APAGA UMA CLASSE DE ERRO
 *
 * Eram duas consultas em paralelo, uma por tabela, e a falha parcial precisava
 * ser tratada à mão: metade dos dados produz um número errado com cara de
 * certeza, que é o risco R3. Agora é uma leitura só — ou vem tudo, ou não vem
 * nada, e não existe estado intermediário para alguém esquecer de tratar.
 *
 * ------------------------------------------------------------------
 * OS NOMES `started_at` E `ended_at` SOBREVIVEM AQUI, DE PROPÓSITO
 *
 * Eles são o contrato de ENTRADA do `padroes.ts`, que é puro e não conhece
 * banco nenhum — `consultas.ts` monta a mesma forma a partir dos eventos do
 * assistente (ver o `doAlvo` de lá). Renomeá-los seria mexer no módulo mais
 * testado do projeto para ganhar consistência de nome, e a hora de fazer isso
 * não é a mesma em que se troca o banco de lugar.
 */
export type RegistrosDoMotor = {
  mamadas: { started_at: string }[];
  sonos: { started_at: string; ended_at: string | null }[];
};

export async function listarParaPadroes(
  babyId: string,
  opcoes: { desde: Date }
): Promise<Resultado<RegistrosDoMotor>> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('tipo, ocorrido_em, terminou_em')
    .eq('baby_id', babyId)
    .in('tipo', ['amamentar', 'mamadeira', 'sono'])
    .gte('ocorrido_em', opcoes.desde.toISOString())
    .order('ocorrido_em', { ascending: true });

  if (error) {
    console.warn('[registros] falha ao ler para o motor:', error.message);
    // O motor não roda com meia leitura: o card mostra a frase de aprendizado,
    // que é silêncio honesto, em vez de um número calculado sobre um pedaço.
    return { data: { mamadas: [], sonos: [] }, error: ERRO_LISTAR };
  }

  const linhas = (data ?? []) as {
    tipo: string;
    ocorrido_em: string;
    terminou_em: string | null;
  }[];

  return {
    data: {
      mamadas: linhas
        .filter((l) => l.tipo === 'amamentar' || l.tipo === 'mamadeira')
        .map((l) => ({ started_at: l.ocorrido_em })),
      sonos: linhas
        .filter((l) => l.tipo === 'sono')
        .map((l) => ({ started_at: l.ocorrido_em, ended_at: l.terminou_em })),
    },
    error: null,
  };
}

/**
 * Uma página da lista unificada, da mais recente pra mais antiga.
 *
 * UMA CONSULTA, E O CURSOR DESCE PARA O BANCO
 *
 * Isto era um merge de k listas ordenadas no cliente: cada tabela devolvia
 * `limite + 1` linhas, a união era ordenada em memória e cortada aqui. O
 * argumento funcionava, mas existia só porque as linhas estavam em cinco
 * lugares. Com uma tabela, ordenação e corte voltam para o índice
 * `(baby_id, ocorrido_em desc)`, que é onde essa conta é barata.
 *
 * O FILTRO POR TIPO TAMBÉM VIRA UMA LINHA. Antes, pedir só amamentação exigia
 * traduzir o tipo numa coluna fixa dentro da tabela compartilhada — sem isso,
 * "carregar mais" de amamentação trazia mamadeira junto. Agora é `in('tipo', …)`
 * e o índice `(baby_id, tipo, ocorrido_em desc)` responde direto.
 *
 * ------------------------------------------------------------------
 * O CURSOR É KEYSET DE VERDADE, E ISSO CORRIGE UM BURACO
 *
 * A condição é a mesma ordem total do `paginacao.ts`, escrita em SQL:
 *
 *     ocorrido_em < cursor  OR  (ocorrido_em = cursor AND id < cursor.id)
 *
 * Antes era `lte` no instante, e o desempate por id acontecia no cliente,
 * DEPOIS do corte por `limite + 1`. Com cinco tabelas isso se escondia atrás do
 * volume; com uma, ele aparece: os empatados no instante do cursor voltam,
 * ocupam o teto, são filtrados aqui, e a página encolhe — ou termina cedo,
 * dizendo `temMais: false` com registro ainda por vir.
 *
 * E empate no instante é o caso COMUM deste app, não a exceção: a mãe informa a
 * hora numa máscara HH:MM, então todo registro nasce com os segundos zerados.
 * Fralda e humor salvos no mesmo minuto colidem.
 *
 * O filtro do `paginar` continua lá, e agora não corta nada. Fica como rede: se
 * um dia esta condição e a ordem do `paginacao.ts` divergirem, é melhor a página
 * vir curta do que vir com item repetido.
 */
export async function listarRegistros(
  babyId: string,
  opcoes: OpcoesListagem = {}
): Promise<Resultado<PaginaRegistros>> {
  const { desde = null, limite = 8, cursor = null, tipos = null, agora = new Date() } = opcoes;

  const pedidos = !tipos || tipos.length === 0 ? TIPOS_REGISTRO : tipos;

  let q = supabase.from(TABELA).select('*').eq('baby_id', babyId).in('tipo', pedidos);

  if (desde) q = q.gte('ocorrido_em', desde.toISOString());
  // A condição em si mora no `paginacao.ts`, colada na versão em JavaScript que
  // o `paginar` usa. As duas discordarem é o bug; separá-las seria convidá-lo.
  if (cursor) q = q.or(filtroDoCursor(cursor));

  // `limite + 1` continua sendo quem responde `temMais` sem consulta extra:
  // sobrou linha além do limite, há mais; não sobrou, a janela acabou.
  const { data, error } = await q
    .order('ocorrido_em', { ascending: false })
    .order('id', { ascending: false })
    .limit(limite + 1);

  if (error) console.warn('[registros] falha ao listar:', error.message);

  const candidatos: RegistroRecente[] = [];
  for (const linha of (data ?? []) as LinhaRegistro[]) {
    const tipo = tipoDaLinha(linha);
    // O `in('tipo', …)` já não deixa passar tipo desconhecido, então isto nunca
    // dispara hoje. Fica porque o dia em que disparar — um dos 14 que faltam,
    // aberto num PWA antigo em cache — é melhor a linha sumir do que a lista
    // inteira quebrar num `LEITURA[undefined]`.
    if (tipo) candidatos.push(normalizar(tipo, linha, agora));
  }

  // `data` e `error` são independentes de propósito: lista vazia e falha de rede
  // são estados diferentes, e a tela precisa dizer coisas diferentes pra cada um.
  return {
    data: paginar(candidatos, limite, cursor),
    error: error ? ERRO_LISTAR : null,
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

/**
 * Abre um registro para edição — os valores do formulário, não a tela de leitura.
 *
 * `buscarRegistro` devolve texto já formatado para a mãe ler; aqui é o contrário,
 * o que se quer é o que ela pode voltar a editar. Duas leituras da mesma linha
 * com propósitos opostos, e misturar as duas foi o que produziu, em outros
 * projetos, o formulário que salva o rótulo em vez do slug.
 *
 * `ocorridoEm` volta junto porque é ele que ancora o dia: a edição muda o horário
 * DENTRO do dia do registro, e sem essa referência o "HH:MM" seria lido como hoje.
 */
export async function carregarParaEdicao(
  tipo: TipoRegistro,
  id: string
): Promise<Resultado<{ valores: ValoresRegistro; ocorridoEm: string } | null>> {
  // O `tipo` aqui é o da tela, e ele CONFERE contra a linha em vez de mandar
  // nela: o formulário já foi desenhado com os campos desse tipo, e ler uma
  // fralda com o schema de sono devolveria um formulário vazio que, ao salvar,
  // apagaria o conteúdo da fralda.
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('id', id)
    .eq('tipo', tipo)
    .maybeSingle();

  if (error) {
    console.warn(`[registros] falha ao abrir ${tipo} para edição:`, error.message);
    return { data: null, error: 'Não consegui abrir esse registro agora.' };
  }
  if (!data) return { data: null, error: null };

  const linha = data as LinhaRegistro;
  const ocorridoEm = String(linha.ocorrido_em);

  return {
    data: {
      valores: valoresDaLinha(tipo, linha, formatarHora(ocorridoEm)),
      ocorridoEm,
    },
    error: null,
  };
}

/**
 * Salva a edição.
 *
 * Escreve os MESMOS campos que o insert escreveria, inclusive os vazios. Um
 * update parcial, só do que a tela julgou alterado, deixaria para trás o campo
 * que a mãe acabou de esvaziar.
 *
 * O `dados` inteiro é substituído, e é isso que faz o esvaziar funcionar: a
 * chave que ficou sem valor não é escrita como nula — ela deixa de existir, que
 * é a mesma forma que as 97 linhas migradas usam para "não informado".
 *
 * O que ele NÃO toca: `baby_id`, `id`, `tipo` e `terminou_em`. O fim de um sono
 * continua onde estava, e editar o começo de um sono encerrado muda a duração,
 * que é o que ela pediu ao mudar o começo.
 *
 * O `eq('tipo', tipo)` fecha o mesmo buraco do `carregarParaEdicao`: com uma
 * tabela só, salvar o formulário de um tipo por cima do `id` de outro deixaria
 * de ser impossível por construção.
 */
export async function atualizarRegistro(
  tipo: TipoRegistro,
  id: string,
  valores: ValoresRegistro,
  ocorridoEm: string
): Promise<{ error: string | null }> {
  // `tipo` sai do payload: ele identifica a linha (no `eq` abaixo), não é algo
  // que a edição decide. Um update que escreve a própria chave de identidade é
  // um update que, no dia em que a montagem tiver um bug, troca o tipo da linha.
  const { tipo: _identidade, ...campos } = linhaParaBanco(tipo, valores, ocorridoEm);

  const { data, error } = await supabase
    .from(TABELA)
    .update(campos)
    .eq('id', id)
    .eq('tipo', tipo)
    .select('id');

  if (error) {
    console.warn(`[registros] falha ao editar ${tipo}:`, error.message);
    return { error: 'Não consegui salvar essa alteração agora. Tenta de novo em instantes.' };
  }

  // Mesmo cuidado do delete: com a RLS barrando, o PostgREST devolve sucesso e
  // zero linhas. Sem contar o que saiu, a tela diria "salvo" para um registro
  // que não mudou.
  if ((data ?? []).length === 0) {
    console.warn(`[registros] update de ${tipo} ${id} não casou nenhuma linha`);
    return { error: 'Esse registro não está mais aqui.' };
  }

  return { error: null };
}

// ============================================================
// AS CONTAGENS DE HOJE — os mini-stats da Home
// ============================================================

/**
 * ⚠️ POR QUE UMA CONSULTA PRÓPRIA, E NÃO CONTAR O QUE A HOME JÁ TEM
 *
 * A Home carrega **8 registros** (`useRegistrosRecentes`). Contar "as mamadas de
 * hoje" a partir deles daria número errado em qualquer dia normal — fralda e
 * mamada passam de oito sozinhas antes do almoço.
 *
 * E número errado aqui é pior que número ausente: a mãe confere contra a própria
 * memória, vê "4" onde ela lembra de seis, e passa a duvidar do resto do app.
 *
 * Traz só a coluna `tipo` das linhas do dia. É payload minúsculo e uma ida só —
 * três `count` separados seriam três viagens para somar três números.
 */
/**
 * A ordem das chaves é a ordem da tela: mamadas, fraldas, sonecas. É a lista do
 * protótipo, literal.
 */
export type ContagensDeHoje = {
  mamadas: number;
  fraldas: number;
  sonecas: number;
};

const ERRO_CONTAR = 'Não consegui contar os registros de hoje agora.';

/**
 * ⚠️ SONECA NÃO É "SONO" — e a diferença é do motor, não deste arquivo.
 *
 * O `padroes.ts` separa soneca de noite pelo INÍCIO: sono que começa entre 19h e
 * 6h é noite e fica fora das métricas de soneca. Se o card contasse todo `sono`,
 * a noite inteira entraria como mais uma soneca, e o "2 sonecas" da Home
 * discordaria do que a Ninna diz sobre soneca duas linhas acima.
 *
 * Por isso `ehSonoNoturno` vem IMPORTADO do motor. A regra tem um dono, e não é
 * este módulo — copiar o `19` para cá seria a mesma deriva, só que silenciosa.
 *
 * `mamadas` vem de `TIPOS_DO_ALVO.mamada`, pela mesma razão: é a definição que o
 * assistente usa. Duas listas do que é mamada é a Home dizendo 7 e a Ninna
 * dizendo 5 sobre o mesmo dia.
 */
export async function contarHoje(
  babyId: string,
  agora: Date = new Date()
): Promise<Resultado<ContagensDeHoje>> {
  const vazio: ContagensDeHoje = { mamadas: 0, fraldas: 0, sonecas: 0 };
  const desde = inicioDoDiaLocal(agora);

  const deMamada = TIPOS_DO_ALVO.mamada as TipoRegistro[];
  const todos: TipoRegistro[] = [...deMamada, 'fralda', 'sono'];

  // `ocorrido_em` entra porque a soneca precisa da hora de início — sem ela não
  // há como separar soneca de noite, e contar tudo como soneca seria mais fácil
  // e errado.
  const { data, error } = await supabase
    .from(TABELA)
    .select('tipo, ocorrido_em')
    .eq('baby_id', babyId)
    .in('tipo', todos)
    .gte('ocorrido_em', desde.toISOString());

  if (error) {
    console.warn('[registros] falha ao contar hoje:', error.message);
    return { data: vazio, error: ERRO_CONTAR };
  }

  const contagens = { ...vazio };
  for (const linha of (data ?? []) as { tipo: string; ocorrido_em: string }[]) {
    if (deMamada.includes(linha.tipo as TipoRegistro)) {
      contagens.mamadas += 1;
      continue;
    }
    if (linha.tipo === 'fralda') {
      contagens.fraldas += 1;
      continue;
    }
    if (linha.tipo === 'sono') {
      const inicio = new Date(linha.ocorrido_em);
      const minutosLocais = inicio.getHours() * 60 + inicio.getMinutes();
      if (!ehSonoNoturno(minutosLocais)) contagens.sonecas += 1;
    }
  }

  return { data: contagens, error: null };
}
