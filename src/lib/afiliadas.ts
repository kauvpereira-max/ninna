/**
 * O que o painel da afiliada lê — e o que ele estruturalmente não consegue ler.
 *
 * ------------------------------------------------------------------
 * NÃO EXISTE FUNÇÃO AQUI QUE DEVOLVA QUEM INDICOU
 *
 * E isso não é escolha deste arquivo: `indicacoes` tem RLS ligada e **zero
 * policies** (migration 008). Uma consulta a ela daqui devolveria lista vazia,
 * não a identidade da mãe.
 *
 * A ausência é o desenho. Nome ou e-mail de mãe num painel de terceiro é dado de
 * criança vazando por tabela, e o termo promete o contrário — então o caminho
 * não existe, em vez de existir e ser evitado com cuidado.
 *
 * O painel lê dois lugares, e nenhum carrega identidade:
 *
 * - `painel_da_afiliada()` — os números agregados;
 * - `comissoes` — o extrato, com valor, tipo e data. Sem `user_id` de ninguém.
 *
 * ------------------------------------------------------------------
 * Como o resto de `src/lib`: erro nunca sobe como exceção. Vira frase pronta.
 */

import { supabase } from './supabase';
import { ehCodigoDoSaque, fraseDoSaque, type CodigoDoSaque, type EstadoDoSaque } from './saque.ts';

type Resultado<T> = { data: T; error: string | null };

const ERRO = 'Não consegui carregar seus números agora. Tenta de novo em instantes.';

/** Quem ela é no programa. `null` quando a conta não é de afiliada. */
export type Afiliada = {
  codigo: string;
  nome: string;
  ativa: boolean;
};

export type NumerosDaAfiliada = {
  indicacoesTotal: number;
  indicacoesPagas: number;
  /** Tudo que foi creditado, menos os estornos. Pode ser negativo. */
  totalCentavos: number;
  /** Só o que passou da carência de 30 dias. É o ÚNICO que pode se chamar "disponível". */
  disponivelCentavos: number;
  /** O que ainda espera a carência. Existe para a tela não deixar ela subtraindo de cabeça. */
  emCarenciaCentavos: number;
  /**
   * O que já foi pedido e ainda não foi recusado — pendente, aprovado ou pago.
   *
   * Vem do banco, e não de uma soma do histórico na tela, pelo mesmo motivo do
   * `disponivel`: conta de dinheiro que mora no cliente é conta que diverge da
   * que o servidor pagaria.
   */
  sacadoCentavos: number;
};

/** Uma linha do histórico de saque. A chave é a DELA — não há dado de terceiro aqui. */
export type Saque = {
  id: string;
  valorCentavos: number;
  chavePix: string;
  estado: EstadoDoSaque;
  motivo: string | null;
  solicitadoEm: string;
};

/** Uma linha do extrato. Sem identidade — só o que aconteceu com o dinheiro. */
export type MovimentoComissao = {
  id: string;
  tipo: 'credito' | 'estorno';
  valorCentavos: number;
  criadaEm: string;
};

/**
 * A linha dela em `afiliadas`, se existir.
 *
 * É o que decide se a rota do painel abre. Ter linha aqui É ser afiliada — não
 * há segunda base de auth, e não há flag em `user_metadata` que alguém possa
 * editar do lado do cliente.
 */
export async function buscarAfiliada(): Promise<Resultado<Afiliada | null>> {
  const { data, error } = await supabase
    .from('afiliadas')
    .select('codigo, nome, ativa')
    .maybeSingle();

  if (error) {
    console.warn('[afiliadas] falha ao buscar cadastro:', error.message);
    return { data: null, error: ERRO };
  }
  return { data: (data as Afiliada) ?? null, error: null };
}

export async function buscarNumeros(): Promise<Resultado<NumerosDaAfiliada | null>> {
  const { data, error } = await supabase.rpc('painel_da_afiliada');

  if (error) {
    console.warn('[afiliadas] falha ao buscar números:', error.message);
    return { data: null, error: ERRO };
  }

  // A função devolve uma linha só; o PostgREST entrega como array.
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) return { data: null, error: null };

  return {
    data: {
      indicacoesTotal: Number(linha.indicacoes_total ?? 0),
      indicacoesPagas: Number(linha.indicacoes_pagas ?? 0),
      totalCentavos: Number(linha.total_centavos ?? 0),
      disponivelCentavos: Number(linha.disponivel_centavos ?? 0),
      emCarenciaCentavos: Number(linha.em_carencia_centavos ?? 0),
      sacadoCentavos: Number(linha.sacado_centavos ?? 0),
    },
    error: null,
  };
}

/** O histórico de saque, do mais recente para o mais antigo. */
export async function listarSaques(limite = 20): Promise<Resultado<Saque[]>> {
  const { data, error } = await supabase
    .from('saques')
    .select('id, valor_centavos, chave_pix, estado, motivo, solicitado_em')
    .order('solicitado_em', { ascending: false })
    .limit(limite);

  if (error) {
    console.warn('[afiliadas] falha ao buscar saques:', error.message);
    return { data: [], error: ERRO };
  }

  return {
    data: (data ?? []).map((l) => ({
      id: String(l.id),
      valorCentavos: Number(l.valor_centavos),
      chavePix: String(l.chave_pix),
      estado: l.estado as EstadoDoSaque,
      motivo: l.motivo === null || l.motivo === undefined ? null : String(l.motivo),
      solicitadoEm: String(l.solicitado_em),
    })),
    error: null,
  };
}

/**
 * Pede um saque. Devolve o código do desfecho, nunca uma exceção.
 *
 * ⚠️ A validação daqui NÃO é a regra — a regra é a da `solicitar_saque()` na
 * 011. Esta chamada só entrega o que a tela juntou e traduz a resposta. Um
 * cliente fabricado à mão encontra o mesmo servidor e a mesma recusa.
 *
 * A função do banco devolve TEXTO em vez de levantar exceção justamente para
 * este ponto: se levantasse, a causa chegaria aqui como mensagem do PostgREST, e
 * o app teria que adivinhá-la por texto que muda entre versões do Postgres.
 */
export async function solicitarSaque(
  valorCentavos: number,
  chavePix: string,
): Promise<{ codigo: CodigoDoSaque; frase: string }> {
  const { data, error } = await supabase.rpc('solicitar_saque', {
    valor_centavos: valorCentavos,
    chave_pix: chavePix,
  });

  if (error) {
    console.warn('[afiliadas] falha ao solicitar saque:', error.message);
    return { codigo: 'erro', frase: fraseDoSaque('erro') };
  }

  // Texto que não seja um código conhecido não vira estado: um `null` ou uma
  // string nova de uma migration futura cai no erro genérico em vez de a tela
  // decidir que deu certo.
  const codigo: CodigoDoSaque = ehCodigoDoSaque(data) ? data : 'erro';
  return { codigo, frase: fraseDoSaque(codigo) };
}

/** O extrato, do mais recente para o mais antigo. */
export async function listarExtrato(limite = 50): Promise<Resultado<MovimentoComissao[]>> {
  const { data, error } = await supabase
    .from('comissoes')
    .select('id, tipo, valor_centavos, criada_em')
    .order('criada_em', { ascending: false })
    .limit(limite);

  if (error) {
    console.warn('[afiliadas] falha ao buscar extrato:', error.message);
    return { data: [], error: ERRO };
  }

  return {
    data: (data ?? []).map((l) => ({
      id: String(l.id),
      tipo: l.tipo as 'credito' | 'estorno',
      valorCentavos: Number(l.valor_centavos),
      criadaEm: String(l.criada_em),
    })),
    error: null,
  };
}

/**
 * Centavos → "R$ 29,98".
 *
 * O sinal aparece no estorno, e de propósito: "−R$ 29,98" no extrato é o que
 * permite ela entender que o número mudou porque uma comissão foi devolvida, e
 * não porque sumiu. Ledger que apaga o passado não é ledger.
 */
export function emReais(centavos: number): string {
  const sinal = centavos < 0 ? '−' : '';
  const abs = Math.abs(centavos);
  return `${sinal}R$ ${(abs / 100).toFixed(2).replace('.', ',')}`;
}
