/**
 * A origem da indicação: do `?ref=` até a conta criada.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO EXISTE, E POR QUE ELE VEM ANTES DO PAINEL
 *
 * Tudo no bloco de afiliadas é reconstituível a partir da Stripe — comissão,
 * saldo, extrato — **menos a atribuição**. Se o `?ref=` não for capturado no
 * instante em que a mãe toca no link, aquele toque não existe em lugar nenhum, e
 * a comissão da afiliada some sem deixar rastro nem jeito de recuperar.
 *
 * Por isso este arquivo nasce antes da tela que a afiliada vai olhar.
 *
 * ------------------------------------------------------------------
 * O QUE ELE GUARDA, E O QUE ELE DE PROPÓSITO NÃO GUARDA
 *
 * Guarda: um código curto, no armazenamento do próprio navegador dela.
 *
 * **Não guarda nada do lado do servidor sobre quem ainda não é usuária.** O
 * `PRODUTO.md` §3.5 sugere um "toque" gravado no servidor para sobreviver ao
 * Safari limpando o storage — e isso funcionaria, mas exige identificar um
 * visitante anônimo por impressão digital de dispositivo. Num app cuja postura
 * inteira é não coletar além do necessário, isso é decisão de produto, não
 * detalhe de implementação. Fica registrado como buraco conhecido, e não
 * fechado por conta própria: ver `docs/proposta-painel-afiliadas.md`.
 *
 * A consequência é honesta e precisa estar no termo da afiliada: **a atribuição
 * é aproximação.** Ela funciona quando a mãe cria a conta no mesmo navegador em
 * que tocou no link, o que é o caminho comum. Não funciona se ela voltar dias
 * depois num navegador que limpou o storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAVE = '@ninna:indicacao';

/**
 * O mesmo formato que o `check` da migration 008 exige.
 *
 * Validar aqui não é redundância com o banco: código inválido vindo de uma URL
 * montada à mão vira um `insert` recusado no meio do cadastro, e a mãe veria um
 * erro que não tem nada a ver com ela. Aqui ele é simplesmente ignorado.
 */
const FORMATO = /^[a-z0-9-]{3,32}$/;

/**
 * Guarda o código, se ele for válido e se ainda não houver um.
 *
 * ⚠️ O PRIMEIRO TOQUE VENCE, e isso é decisão. Se a mãe tocar no link da
 * afiliada A, não criar conta, e depois tocar no da B, a indicação é da A — foi
 * ela quem trouxe a mãe até aqui. Sobrescrever premiaria o último link tocado, e
 * o último link tende a ser o de quem já estava dentro do app.
 *
 * O banco reforça o mesmo com `indicada_user_id unique`: se dois caminhos
 * chegarem ao mesmo cadastro, o segundo não sobrescreve.
 */
export async function guardarIndicacao(codigo: string | null | undefined): Promise<void> {
  const limpo = (codigo ?? '').trim().toLowerCase();
  if (!FORMATO.test(limpo)) return;

  try {
    const jaTem = await AsyncStorage.getItem(CHAVE);
    if (jaTem) return;
    await AsyncStorage.setItem(CHAVE, limpo);
  } catch {
    // Storage indisponível (aba privada, cota estourada) não pode impedir a mãe
    // de usar o app. Perde-se a comissão, não o cadastro.
  }
}

/** O código guardado, ou null. Não apaga: quem apaga é `consumirIndicacao`. */
export async function lerIndicacao(): Promise<string | null> {
  try {
    const codigo = await AsyncStorage.getItem(CHAVE);
    return codigo && FORMATO.test(codigo) ? codigo : null;
  } catch {
    return null;
  }
}

/**
 * Lê e apaga, para uso no momento do cadastro.
 *
 * Apagar é o que impede a segunda conta criada no mesmo navegador de herdar a
 * indicação da primeira — o caso do celular emprestado, ou da mãe que cria uma
 * conta de teste antes da de verdade.
 */
export async function consumirIndicacao(): Promise<string | null> {
  const codigo = await lerIndicacao();
  try {
    await AsyncStorage.removeItem(CHAVE);
  } catch {
    // Ignorado pela mesma razão do `guardarIndicacao`.
  }
  return codigo;
}

/**
 * O `?ref=` da URL, na web.
 *
 * No nativo não existe — o link de afiliada é um link web, e a mãe que instala a
 * PWA passou pelo navegador antes. Quando o canal nativo entrar, a origem virá
 * por deep link e este é o lugar de somar o caso.
 */
export function refDaUrl(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return new URLSearchParams(window.location.search).get('ref');
  } catch {
    return null;
  }
}
