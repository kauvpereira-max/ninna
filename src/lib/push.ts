/**
 * O lado IMPURO das notificações: navegador, service worker e banco.
 *
 * As REGRAS moram em `notificacoes.ts`, que é puro e roda no Node dos testes.
 * Aqui mora o que só existe dentro de um navegador de verdade — e por isso este
 * arquivo é regra 2b em pessoa: nenhum teste do Node alcança uma linha dele.
 * O que dá para testar foi empurrado para o módulo puro de propósito.
 *
 * ------------------------------------------------------------------
 * ⚠️ A PERMISSÃO SÓ SE PEDE UMA VEZ NA VIDA
 *
 * `Notification.requestPermission()` mostra o prompt do sistema **uma vez**.
 * Negada, ela não volta a aparecer: o navegador passa a responder `denied`
 * direto, e reverter exige a mãe abrir os ajustes do site e mexer numa lista de
 * permissões que a maioria das pessoas nunca viu.
 *
 * Por isso este módulo nunca chama `requestPermission` na carga da tela. Quem
 * chama é o `ConvitePush`, depois de um toque dela, depois de o convite explicar
 * o que a Ninna avisa. Pedir antes disso não é impaciência: é queimar o canal
 * para sempre em troca de nada.
 *
 * ------------------------------------------------------------------
 * POR QUE NÃO HÁ TRAVA DE "PWA INSTALADA" AQUI
 *
 * Push no iOS exige instalação na tela de início (PRODUTO.md §3.2). Mas no
 * Safari em aba **o `PushManager` simplesmente não existe** — a própria ausência
 * da API já faz `pushSuportado()` devolver `false`, sem nenhuma regra escrita.
 *
 * Uma trava explícita de "só instalada" custaria caro do outro lado: o Chrome no
 * Android entrega push numa aba comum, e a trava barraria mãe que recebe bem.
 * Quem conduz a instalação é o `BannerInstalar`, que é onde essa conversa mora.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase.ts';

/** A pública do par VAPID. A privada mora no secret do Supabase, nunca aqui. */
const CHAVE_PUBLICA = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

const CHAVE_DISPENSA = '@ninna/convite-push-dispensado';

export type Permissao = 'default' | 'granted' | 'denied';

export type EstadoDePush = {
  suportado: boolean;
  permissao: Permissao;
  inscrito: boolean;
};

// ------------------------------------------------------------------
// O que o navegador consegue
// ------------------------------------------------------------------

export function pushSuportado(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    'serviceWorker' in window.navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function permissaoAtual(): Permissao {
  if (!pushSuportado()) return 'default';
  const p = window.Notification.permission;
  return p === 'granted' || p === 'denied' ? p : 'default';
}

/**
 * Registra o service worker. Idempotente — chamar a cada carga é o esperado.
 *
 * Não pede permissão nenhuma e não mostra nada: registrar o SW é invisível para
 * a mãe. É só o que precisa estar de pé ANTES de ela aceitar, para o `subscribe`
 * ter em que se apoiar no momento do toque.
 */
export async function registrarServiceWorker(): Promise<void> {
  if (!pushSuportado()) return;
  try {
    await window.navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    // Falha aqui não tem tela: a mãe não pediu nada. O app inteiro continua
    // funcionando sem service worker — o que ela perde é só o push.
    console.warn('[push] service worker não registrou:', e);
  }
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null;
  try {
    const registro = await window.navigator.serviceWorker.ready;
    return await registro.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function estadoDePush(): Promise<EstadoDePush> {
  const suportado = pushSuportado();
  if (!suportado) return { suportado: false, permissao: 'default', inscrito: false };

  const permissao = permissaoAtual();
  // Sem permissão concedida não existe inscrição — e `serviceWorker.ready` fica
  // pendente para sempre quando não há SW registrado, então nem esperamos por ele.
  const inscrito = permissao === 'granted' ? (await inscricaoAtual()) !== null : false;

  return { suportado, permissao, inscrito };
}

// ------------------------------------------------------------------
// Ligar
// ------------------------------------------------------------------

/**
 * A chave pública viaja como base64url e o `subscribe` quer bytes crus.
 *
 * Chave malformada faz o `subscribe` jogar `InvalidCharacterError` — que é como
 * "esqueci de pôr a env no Vercel" chega aqui.
 */
// Devolve o `ArrayBuffer`, e não a view: `BufferSource` aceita os dois, e a view
// arrasta o genérico `Uint8Array<ArrayBufferLike>` do TypeScript novo, que não
// casa com o `ArrayBufferView<ArrayBuffer>` esperado pela assinatura do DOM.
function chaveParaBytes(base64url: string): ArrayBuffer {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const binario = window.atob(base64);
  const buffer = new ArrayBuffer(binario.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return buffer;
}

/**
 * As duas chaves da criptografia ponta a ponta, já em base64url.
 *
 * `toJSON()` entrega as duas prontas. O caminho por `getKey` existe porque
 * implementação antiga devolve `keys` vazio — e sem elas a inscrição é inútil:
 * o servidor não consegue cifrar, e o push nunca sai.
 */
function chavesDaInscricao(inscricao: PushSubscription): { p256dh: string; auth: string } | null {
  const json = inscricao.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  if (json.keys?.p256dh && json.keys.auth) {
    return { p256dh: json.keys.p256dh, auth: json.keys.auth };
  }

  const emBase64url = (buffer: ArrayBuffer | null): string | null => {
    if (!buffer) return null;
    const bytes = new Uint8Array(buffer);
    let binario = '';
    for (const b of bytes) binario += String.fromCharCode(b);
    return window.btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const p256dh = emBase64url(inscricao.getKey('p256dh'));
  const auth = emBase64url(inscricao.getKey('auth'));
  return p256dh && auth ? { p256dh, auth } : null;
}

const NAO_DEU = 'Não consegui ligar as notificações agora. Dá pra tentar de novo daqui a pouco.';

/**
 * Pede a permissão, inscreve o aparelho e grava a inscrição.
 *
 * ⚠️ **Tem que ser chamada de dentro de um toque dela.** O navegador ignora
 * `requestPermission()` que não venha de gesto do usuário.
 *
 * Nunca joga exceção: erro vira frase pronta, como todo o resto de `src/lib`.
 */
export async function ligarNotificacoes(): Promise<{ ok: boolean; frase: string }> {
  if (!pushSuportado()) {
    return { ok: false, frase: 'Este navegador não recebe notificações da Ninna.' };
  }

  if (!CHAVE_PUBLICA) {
    // Env faltando é erro de deploy, não da mãe — mas ela é quem está olhando.
    console.warn('[push] EXPO_PUBLIC_VAPID_PUBLIC_KEY ausente no bundle');
    return { ok: false, frase: NAO_DEU };
  }

  let permissao: Permissao;
  try {
    permissao = (await window.Notification.requestPermission()) as Permissao;
  } catch {
    return { ok: false, frase: NAO_DEU };
  }

  if (permissao === 'denied') {
    // Sem "tente de novo": não dá. O caminho de volta é pelos ajustes do site.
    return {
      ok: false,
      frase: 'O navegador está bloqueando as notificações. Dá pra liberar nos ajustes deste site.',
    };
  }
  if (permissao !== 'granted') {
    return { ok: false, frase: 'Tudo bem — nada muda até você quiser.' };
  }

  let inscricao: PushSubscription;
  try {
    const registro = await window.navigator.serviceWorker.ready;
    // `getSubscription` primeiro: reinscrever um aparelho já inscrito devolve
    // erro quando a chave difere, em vez de trocar. Reaproveitar é o caminho.
    inscricao =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        // Exigência do Chrome e do iOS, não escolha nossa — ver o topo do sw.js.
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(CHAVE_PUBLICA),
      }));
  } catch (e) {
    console.warn('[push] subscribe falhou:', e);
    return { ok: false, frase: NAO_DEU };
  }

  const chaves = chavesDaInscricao(inscricao);
  if (!chaves) {
    console.warn('[push] inscrição sem p256dh/auth');
    await inscricao.unsubscribe().catch(() => {});
    return { ok: false, frase: NAO_DEU };
  }

  const { data, error } = await supabase.rpc('registrar_push', {
    endpoint: inscricao.endpoint,
    p256dh: chaves.p256dh,
    auth_key: chaves.auth,
  });

  if (error || data !== 'ok') {
    // Desfaz a inscrição do navegador quando o banco não a guardou. Sem isto o
    // aparelho ficaria "inscrito" para o navegador e desconhecido para o
    // servidor — estado que não gera erro nenhum e nunca entrega notificação.
    console.warn('[push] registrar_push recusou:', error?.message ?? data);
    await inscricao.unsubscribe().catch(() => {});
    return { ok: false, frase: NAO_DEU };
  }

  await AsyncStorage.removeItem(CHAVE_DISPENSA).catch(() => {});
  return { ok: true, frase: 'Pronto. São dois avisos, e nenhum entre 21h e 8h.' };
}

// ------------------------------------------------------------------
// Desligar
// ------------------------------------------------------------------

/**
 * Desliga dos dois lados, e o do BANCO é o que importa.
 *
 * `unsubscribe()` sozinho encerra o endpoint no navegador, mas a linha continua
 * lá e o envio segue tentando até tomar 410. Apagar a linha é o que faz o
 * desligar valer na hora — e é para isso que a `012` deu policy de delete a ela.
 */
export async function desligarNotificacoes(): Promise<{ ok: boolean; frase: string }> {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return { ok: true, frase: 'As notificações estão desligadas.' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', inscricao.endpoint);

  if (error) {
    console.warn('[push] falha ao apagar a inscrição:', error.message);
    return { ok: false, frase: 'Não consegui desligar agora. Dá pra tentar de novo daqui a pouco.' };
  }

  await inscricao.unsubscribe().catch(() => {});
  return { ok: true, frase: 'Desligado. Nada mais chega neste aparelho.' };
}

// ------------------------------------------------------------------
// O "agora não" do convite
// ------------------------------------------------------------------
//
// ⚠️ Aqui a regra é o CONTRÁRIO da do `BannerInstalar`, e a diferença é de
// natureza: instalar é requisito funcional (sem isso o iOS limpa o storage e a
// mãe é deslogada), então aquele banner volta toda sessão de propósito.
//
// Notificação é escolha. Voltar a perguntar depois de um "agora não" é insistir
// numa coisa que ela já respondeu — e o caminho de volta continua existindo, em
// Mais › Notificações, que não some nunca.

export async function conviteDispensado(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHAVE_DISPENSA)) !== null;
  } catch {
    // Storage indisponível: mostra o convite. Errar para o lado de perguntar uma
    // vez a mais é melhor que esconder o único caminho para ligar.
    return false;
  }
}

export async function dispensarConvite(): Promise<void> {
  await AsyncStorage.setItem(CHAVE_DISPENSA, '1').catch(() => {});
}
