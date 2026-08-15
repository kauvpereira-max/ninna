/**
 * Os níveis da afiliada — módulo PURO.
 *
 * ------------------------------------------------------------------
 * O CRITÉRIO É ASSINATURA PAGA ACUMULADA, E ELE JÁ EXISTIA
 *
 * `indicacoes_pagas`, que a RPC `painel_da_afiliada()` devolve desde a 010. Não
 * há coluna nova, não há consulta nova, e não há nível gravado em lugar nenhum:
 * **o nível é uma propriedade da contagem**, derivada na hora de exibir.
 *
 * As outras duas métricas consideradas foram descartadas com motivo:
 *
 * - **cadastros pelo link** — grátis de fabricar. Sobe de nível criando contas;
 * - **assinaturas ATIVAS** — flutua, e flutuar significa REBAIXAR. Perder o selo
 *   porque uma mãe cancelou pune a afiliada por algo fora do alcance dela:
 *   manter alguém assinando é trabalho do produto.
 *
 * ------------------------------------------------------------------
 * POR QUE A CONTAGEM NÃO DECAI, E POR QUE ISSO NÃO É SORTE
 *
 * `indicacoes_pagas` conta indicações que TIVERAM crédito:
 *
 *     count(*) where creditada_em is not null
 *     -- creditada_em = min(criada_em) filter (where tipo = 'credito')
 *
 * Um estorno lança linha NEGATIVA, não apaga a linha do crédito (decisão da
 * 010). Então `creditada_em` continua preenchida e a contagem não cai — o
 * dinheiro volta, o nível fica.
 *
 * É o que torna seguro derivar em vez de guardar. Se um dia o estorno passar a
 * apagar a linha, esta garantia cai junto, e aí o nível precisa de coluna.
 *
 * ------------------------------------------------------------------
 * ⚠️ OS LIMIARES SÃO PROVISÓRIOS — 45 DIAS DE PRODUTO E ZERO AFILIADAS
 *
 * 1 / 5 / 15 / 40 é chute honesto, e está aqui escrito como chute para ninguém
 * daqui a seis meses tratar como número apurado.
 *
 * **A revisão tem uma regra, e ela é mecânica:** limiar existente só pode
 * BAIXAR; nível novo só pode ser acrescentado ACIMA. Subir um limiar rebaixaria
 * quem já chegou lá — e como o nível é derivado, o rebaixamento seria silencioso
 * e retroativo, do tipo que a afiliada descobre abrindo o painel.
 *
 * O `scripts/teste-niveis.ts` guarda isso contra uma cópia congelada dos
 * limiares originais. Não é convenção: é asserção.
 *
 * ------------------------------------------------------------------
 * O QUE O NÍVEL DÁ, E O QUE ELE NÃO PROMETE
 *
 * Reconhecimento. Não muda comissão — 25% deixaria a margem do anual em R$4,37
 * antes de qualquer custo ainda desconhecido, e há um segundo motivo que não é
 * de planilha: **comissão por nível cria pressão para vender, e o público é mãe
 * de recém-nascido.** Selo é orgulho; percentual é meta.
 *
 * E o painel **não promete placa, brinde nem nada físico**. O que existe fora do
 * app é combinado fora do app. Prometer entrega física numa tela é criar dívida
 * que outra pessoa cumpre à mão — a mesma razão pela qual o rodapé do saque não
 * promete data.
 */

export type Nivel = {
  /** O nome que aparece no selo. */
  nome: string;
  /** Assinaturas pagas necessárias para chegar aqui. */
  minimo: number;
};

/**
 * Do menor para o maior. Abaixo do primeiro limiar não há nível — e isso é
 * deliberado: um selo que todo mundo tem no primeiro dia não reconhece nada.
 */
export const NIVEIS: Nivel[] = [
  { nome: 'Parceira', minimo: 1 },
  { nome: 'Prata', minimo: 5 },
  { nome: 'Ouro', minimo: 15 },
  { nome: 'Diamante', minimo: 40 },
];

/** O nível alcançado com `pagas` assinaturas, ou `null` antes da primeira. */
export function nivelDe(pagas: number): Nivel | null {
  let alcancado: Nivel | null = null;
  for (const n of NIVEIS) {
    if (pagas >= n.minimo) alcancado = n;
  }
  return alcancado;
}

/** O próximo degrau, ou `null` no topo. */
export function proximoNivel(pagas: number): Nivel | null {
  return NIVEIS.find((n) => pagas < n.minimo) ?? null;
}

/** Quantas faltam para o próximo. `null` no topo. */
export function faltamPara(pagas: number): number | null {
  const proximo = proximoNivel(pagas);
  return proximo ? proximo.minimo - pagas : null;
}

/**
 * A frase do progresso, ou `null` quando não há o que dizer.
 *
 * Fala de CONTAGEM, nunca do que vem junto: "faltam 2 para Prata" é verdade
 * verificável; "faltam 2 para ganhar X" seria promessa numa tela.
 */
export function fraseDoProgresso(pagas: number): string | null {
  const faltam = faltamPara(pagas);
  const proximo = proximoNivel(pagas);
  if (faltam === null || proximo === null) return null;
  return faltam === 1
    ? `Falta 1 assinatura para ${proximo.nome}.`
    : `Faltam ${faltam} assinaturas para ${proximo.nome}.`;
}

/**
 * O que o selo diz embaixo do nome: o fato que o produziu, e nada além.
 *
 * Sem adjetivo e sem agradecimento — a mesma disciplina da copy do card de
 * insight. O número é o elogio.
 */
export function fraseDoNivel(pagas: number): string {
  if (pagas === 0) return 'Nenhuma assinatura pelo seu link ainda.';
  return pagas === 1
    ? '1 mãe assinou pelo seu link.'
    : `${pagas} mães assinaram pelo seu link.`;
}
