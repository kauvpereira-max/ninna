/**
 * As regras e a copy do saque — módulo PURO.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO NÃO MORA NO `afiliadas.ts`
 *
 * Porque o `afiliadas.ts` importa `./supabase`, que arrasta AsyncStorage, e por
 * isso nenhum teste do Node consegue carregá-lo — é a dívida registrada no
 * CLAUDE.md. Uma regra de dinheiro que ninguém testa é uma regra de dinheiro que
 * ninguém testa.
 *
 * Aqui não há import de runtime nenhum. Roda no app, no Node dos testes e no
 * Deno, como os outros módulos puros da casa.
 *
 * ------------------------------------------------------------------
 * ⚠️ O MÍNIMO ESTÁ EM DOIS LUGARES, E ISSO É DE PROPÓSITO
 *
 * `solicitar_saque()` na migration 011 recusa abaixo de 2000 centavos, e este
 * arquivo repete o número. Não é duplicação por descuido:
 *
 * - o do BANCO é a regra. É ele que decide, e é ele que uma requisição
 *   fabricada à mão encontra;
 * - o daqui é só para a tela **desabilitar o botão antes** e dizer o porquê. Se
 *   os dois divergirem, o pior caso é a tela deixar tentar e o banco recusar com
 *   a frase certa — nunca o contrário.
 *
 * O `teste-saque.ts` guarda os dois contra a mesma constante.
 */

/** R$ 20,00. O mesmo número da 011 — ver o aviso acima. */
export const SAQUE_MINIMO_CENTAVOS = 2000;

/**
 * Os desfechos de `solicitar_saque()`.
 *
 * São os códigos literais que a função devolve. `erro` não vem do banco: é o que
 * o cliente usa quando a chamada nem chegou lá.
 */
export type CodigoDoSaque =
  | 'ok'
  | 'sem_sessao'
  | 'sem_cadastro'
  | 'pausada'
  | 'minimo'
  | 'chave'
  | 'saldo'
  | 'aberto'
  | 'erro';

/**
 * Código → frase pronta. Nenhuma cita número que a tela não tenha na mão, e
 * nenhuma promete prazo: o pagamento é manual, e prometer data seria passar para
 * outra pessoa uma promessa que ela vai ter que cumprir à mão.
 */
const FRASES: Record<CodigoDoSaque, string> = {
  ok: 'Pedido enviado. Aparece aqui embaixo enquanto está em análise.',
  sem_sessao: 'Sua sessão expirou. Entra de novo pra continuar.',
  sem_cadastro: 'Esta conta não é de parceira.',
  pausada: 'Seu link está pausado. Me chama no WhatsApp e a gente resolve.',
  minimo: 'O saque mínimo é R$ 20,00.',
  chave: 'Confere a chave Pix: o texto parece incompleto.',
  saldo: 'Esse valor é maior que o disponível agora.',
  aberto: 'Já existe um pedido em andamento. Assim que fechar, dá pra pedir outro.',
  erro: 'Não consegui enviar o pedido agora. Tenta de novo em instantes.',
};

export function fraseDoSaque(codigo: CodigoDoSaque): string {
  return FRASES[codigo] ?? FRASES.erro;
}

/** O que o banco devolveu virou um código conhecido? Texto de fora não vira estado. */
export function ehCodigoDoSaque(valor: unknown): valor is CodigoDoSaque {
  return typeof valor === 'string' && valor in FRASES;
}

/** Os estados da coluna `estado` em `saques`. */
export type EstadoDoSaque = 'pendente' | 'aprovado' | 'pago' | 'recusado';

/**
 * Rótulo de estado para a tela.
 *
 * "Em análise" no lugar de "pendente" porque pendente descreve a fila do lado de
 * cá; em análise descreve o que está acontecendo do lado dela.
 */
const ESTADOS: Record<EstadoDoSaque, string> = {
  pendente: 'Em análise',
  aprovado: 'Aprovado',
  pago: 'Pago',
  recusado: 'Recusado',
};

export function rotuloDoEstado(estado: EstadoDoSaque): string {
  return ESTADOS[estado] ?? 'Em análise';
}

/** Estados que ainda seguram saldo. 'recusado' devolve — igual à 011. */
export function comprometeSaldo(estado: EstadoDoSaque): boolean {
  return estado !== 'recusado';
}

/**
 * "12,50" ou "1250" → 1250 centavos. `null` quando não dá pra ler.
 *
 * Aceita vírgula e ponto porque o teclado numérico do telefone dá os dois, e
 * porque a mãe digita como fala. Mais de duas casas é erro de digitação, não
 * precisão — recusa em vez de arredondar dinheiro por conta própria.
 */
export function centavosDoTexto(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (limpo === '' || !/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const centavos = Math.round(Number(limpo) * 100);
  return Number.isFinite(centavos) ? centavos : null;
}

/**
 * A tela pode enviar? Devolve o código do impedimento, ou `null`.
 *
 * É a MESMA ordem de conferência da 011, e isso importa: se aqui o valor fosse
 * conferido antes da chave e lá o contrário, a mãe corrigiria um campo por vez
 * em ordens diferentes conforme a rede estivesse boa ou ruim.
 */
export function impedimentoDoSaque(
  valorCentavos: number | null,
  chavePix: string,
  disponivelCentavos: number,
): Exclude<CodigoDoSaque, 'ok' | 'sem_sessao' | 'sem_cadastro' | 'pausada' | 'aberto' | 'erro'> | null {
  if (valorCentavos === null || valorCentavos < SAQUE_MINIMO_CENTAVOS) return 'minimo';
  const chave = chavePix.trim();
  if (chave.length < 4 || chave.length > 140) return 'chave';
  if (valorCentavos > disponivelCentavos) return 'saldo';
  return null;
}
