import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * O endereço pra onde o link do e-mail de reset devolve a mãe.
 *
 * ESTE É O ÚNICO LUGAR onde esse endereço é montado. O P5 (deploy na Vercel)
 * vai trocar o domínio, e o custo dessa troca precisa ser uma variável de
 * ambiente — não uma caça a string espalhada por tela e por `redirectTo`.
 *
 * Ordem de resolução:
 *   1. EXPO_PUBLIC_APP_URL, se definida — é o que o P5 vai preencher;
 *   2. na web, a origem de onde o app está sendo servido (cobre o dev em
 *      localhost:8081 e um preview da Vercel sem precisar mexer no .env);
 *   3. no nativo, o deep link do scheme `ninna` do app.json.
 *
 * ⚠️ O valor final precisa estar na allow-list do Supabase
 * (Authentication > URL Configuration > Redirect URLs), senão o GoTrue devolve
 * a mãe pro Site URL padrão e o link "funciona" indo pro lugar errado.
 * Ver BETA.md §11.5.
 */
export const CAMINHO_NOVA_SENHA = '/nova-senha';

export function urlRetornoResetSenha(): string {
  const configurada = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (configurada) return `${configurada.replace(/\/+$/, '')}${CAMINHO_NOVA_SENHA}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${CAMINHO_NOVA_SENHA}`;
  }

  return Linking.createURL(CAMINHO_NOVA_SENHA);
}

/**
 * O link de recuperação volta com os tokens no FRAGMENTO da URL
 * (`#access_token=...&type=recovery`), ou com o motivo da falha
 * (`#error=...&error_code=otp_expired`) quando já expirou.
 *
 * Por que ler isso à mão em vez de só esperar o evento `PASSWORD_RECOVERY`: o
 * supabase-js consome e limpa o fragmento durante a própria inicialização, que
 * pode acontecer ANTES do listener do AuthContext existir. Perder esse evento
 * significa a mãe cair na Home logada, sem nunca ver a tela de definir senha —
 * com a senha antiga ainda valendo e sem entender por quê.
 *
 * Os dois caminhos (sniff aqui + evento no contexto) existem porque basta um
 * deles chegar.
 */
export function retornoDeRecuperacaoNaUrl(): 'recuperacao' | 'expirado' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const bruto = `${window.location.hash ?? ''}${window.location.search ?? ''}`;
  if (!bruto) return null;

  const params = new URLSearchParams(bruto.replace(/^[#?]/, '').replace(/#/g, '&'));

  if (params.get('error') || params.get('error_code')) return 'expirado';
  if (params.get('type') === 'recovery') return 'recuperacao';
  return null;
}
