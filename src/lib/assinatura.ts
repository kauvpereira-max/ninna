/**
 * O cliente de assinatura — leitura do estado e as duas portas da Stripe.
 *
 * Nenhuma regra mora aqui. Se a assinatura vale é `acesso.ts` quem diz; o que
 * ela é, quem grava é o webhook. Este módulo só lê e abre URL.
 *
 * Mesmo contrato de erro do resto de `src/lib`: nunca joga exceção.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { SEM_ASSINATURA, type Assinatura, type StatusAssinatura } from './acesso';

export type { Assinatura };

const ERRO_ABRIR =
  'Não consegui abrir a tela de pagamento agora. Tenta de novo em instantes — nada foi cobrado.';

/**
 * O estado da assinatura desta conta.
 *
 * A RLS deixa a mãe ler só a própria linha, então não há filtro por usuária
 * aqui: o banco já resolve isso. Conta sem linha é conta que nunca assinou.
 *
 * Falha de rede devolve `SEM_ASSINATURA` — e isso é uma escolha: na dúvida, a
 * tela mostra o convite para assinar em vez de liberar o que é pago. O portão
 * de verdade está no servidor, então errar para cá não abre nada.
 */
export async function estadoDaAssinatura(): Promise<Assinatura> {
  try {
    const { data, error } = await supabase
      .from('assinaturas')
      .select('status, valida_ate')
      .maybeSingle();

    if (error || !data) return SEM_ASSINATURA;

    return {
      status: (data.status as StatusAssinatura) ?? 'nenhuma',
      validaAte: (data.valida_ate as string | null) ?? null,
    };
  } catch {
    return SEM_ASSINATURA;
  }
}

/**
 * Leva a mãe para uma página hospedada pela Stripe.
 *
 * Na web tem que ser na MESMA aba: o Checkout devolve por `success_url`, e numa
 * aba nova ela terminaria o pagamento numa janela e voltaria para o app numa
 * outra, sem entender qual das duas está certa. `Linking.openURL` do
 * react-native-web abre em aba nova, então a web é tratada à parte.
 */
function irPara(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }
  // No nativo o Checkout abre no navegador do sistema e volta pelo deep link.
  import('expo-linking').then((Linking) => Linking.openURL(url)).catch(() => {});
}

async function chamar(corpo: Record<string, unknown>): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('assinatura', { body: corpo });
    if (error) {
      console.warn('[assinatura] falha na chamada:', error.message);
      return null;
    }
    const url = (data as { url?: unknown })?.url;
    return typeof url === 'string' ? url : null;
  } catch (erro) {
    console.warn('[assinatura] exceção:', erro);
    return null;
  }
}

/** Abre o Checkout. Devolve a frase de erro quando não conseguiu — nunca joga. */
export async function assinar(plano: 'mensal' | 'anual'): Promise<string | null> {
  const url = await chamar({ acao: 'assinar', plano });
  if (!url) return ERRO_ABRIR;
  irPara(url);
  return null;
}

/** Abre o Portal do Cliente: cancelar, trocar cartão, ver faturas. */
export async function gerenciar(): Promise<string | null> {
  const url = await chamar({ acao: 'gerenciar' });
  if (!url) return ERRO_ABRIR;
  irPara(url);
  return null;
}
