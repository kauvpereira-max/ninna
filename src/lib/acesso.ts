/**
 * Onde fica a fronteira entre o grátis e o pago.
 *
 * Módulo puro: recebe o estado da assinatura, devolve se o recurso abre. Sem
 * Supabase, sem React, sem Stripe. Roda no Node e se confere na mão, mesma regra
 * de `padroes.ts` e `consultas.ts`.
 *
 * ------------------------------------------------------------------
 * A FRONTEIRA, E POR QUE ELA CAI ONDE CAI
 *
 * Paga o que custa: **o assistente é o único recurso da Ninna com custo marginal
 * por usuária** (PRODUTO.md §3.1). Cada pergunta é uma chamada de modelo, e ela
 * sobe com o engajamento — que é justamente o que o produto tenta aumentar.
 *
 * Grátis o que constrói o histórico: registrar, consultar a rotina e ler o
 * insight do card não custam nada por mãe, e são o que faz o assistente valer
 * alguma coisa quando ela chegar nele. Cobrar por registro seria cobrar pela
 * matéria-prima do próprio produto — e uma mãe que não registrou nada não tem
 * o que perguntar.
 *
 * Isso também protege a tese: a mãe conhece o insight sobre o bebê DELA antes de
 * pagar por qualquer coisa. O que se vende é o que ela já viu funcionar.
 *
 * ⚠️ **Esta fronteira é decisão de negócio, e está aqui em um lugar só de
 * propósito.** Mudar o que é pago é mudar `RECURSOS_PAGOS`, e nada mais.
 */

/** Os status que a Stripe usa, mais o nosso para "nunca assinou". */
export type StatusAssinatura =
  | 'nenhuma'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type Assinatura = {
  status: StatusAssinatura;
  /** Fim do período já pago, em ISO. `null` quando nunca houve um. */
  validaAte: string | null;
};

export const SEM_ASSINATURA: Assinatura = { status: 'nenhuma', validaAte: null };

export type Recurso = 'registro' | 'historico' | 'insight' | 'assistente';

/** A fronteira. Mudar o modelo de negócio é mudar esta linha. */
export const RECURSOS_PAGOS: Recurso[] = ['assistente'];

/**
 * Status que dão acesso enquanto o período pago não venceu.
 *
 * `past_due` entra aqui de propósito: a Stripe ainda está tentando cobrar, e o
 * cartão que falhou na virada do mês é quase sempre um cartão vencido, não uma
 * desistência. Cortar no primeiro erro pune quem não fez nada de errado — e a
 * mãe descobre isso às 3h da manhã, perguntando algo que respondia ontem.
 *
 * `canceled` também: ela cancelou, mas o mês está pago. Cortar antes do fim é
 * ficar com dinheiro sem entregar.
 */
const STATUS_COM_PERIODO_VALIDO: StatusAssinatura[] = ['active', 'trialing', 'past_due', 'canceled'];

/**
 * `active` e `trialing` valem mesmo sem `validaAte` conhecido.
 *
 * O webhook pode chegar antes de a Stripe preencher o período, e negar acesso a
 * quem acabou de pagar é o pior primeiro minuto possível. Já `past_due` e
 * `canceled` SEM data não valem: nos dois o crédito vem justamente da data.
 */
const STATUS_SEM_PRECISAR_DE_DATA: StatusAssinatura[] = ['active', 'trialing'];

export function assinaturaValida(assinatura: Assinatura, agora: Date = new Date()): boolean {
  if (!STATUS_COM_PERIODO_VALIDO.includes(assinatura.status)) return false;

  if (assinatura.validaAte === null) {
    return STATUS_SEM_PRECISAR_DE_DATA.includes(assinatura.status);
  }

  const fim = new Date(assinatura.validaAte).getTime();
  if (!Number.isFinite(fim)) return STATUS_SEM_PRECISAR_DE_DATA.includes(assinatura.status);

  return fim > agora.getTime();
}

export function temAcesso(
  recurso: Recurso,
  assinatura: Assinatura,
  agora: Date = new Date()
): boolean {
  if (!RECURSOS_PAGOS.includes(recurso)) return true;
  return assinaturaValida(assinatura, agora);
}
