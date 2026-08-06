/**
 * Tradução das mensagens do Supabase Auth para português.
 *
 * Existe como módulo único porque erro de auth aparece em quatro telas (login,
 * signup, recuperar senha, nova senha) e string espalhada diverge: uma tela diz
 * "e-mail ou senha incorretos", a outra deixa passar "Invalid login credentials"
 * em inglês, e a mãe conclui que o app quebrou.
 *
 * NÃO importa react-native nem Supabase de propósito — é lógica pura, roda no
 * Node, mesma razão de `paginacao.ts` morar separado de `registros.ts`.
 *
 * Regra de tom (BETA.md, copy de saúde e §3.7): quem lê está cansada e com o
 * bebê no colo. A mensagem diz o que aconteceu e o que fazer agora. Nunca
 * mostra código de erro, nunca culpa, nunca manda "contate o suporte" — não
 * existe suporte, existe um grupo de WhatsApp.
 */

/** Mínimo que o Supabase aceita por padrão. Usado na validação local e na copy. */
export const SENHA_MINIMA = 6;

const GENERICO = 'Não consegui completar agora. Tenta de novo em instantes.';

/**
 * Credencial inválida e conta inexistente respondem A MESMA COISA, de propósito.
 *
 * Distinguir as duas ("essa conta não existe" vs "senha errada") entrega, pra
 * quem perguntar, a lista de e-mails que têm conta no Ninna — é enumeração de
 * usuário. O custo pra mãe é zero: em qualquer um dos casos o que ela faz é o
 * mesmo, conferir o que digitou ou recuperar a senha.
 */
const CREDENCIAL_INVALIDA = 'E-mail ou senha não conferem. Confere e tenta de novo.';

const SEM_REDE =
  'Sem conexão agora. O que você digitou continua aqui — é só tentar de novo quando a internet voltar.';

const JA_TEM_CONTA = 'Esse e-mail já tem conta. Tenta entrar, ou recupera a senha.';

/**
 * Chaveado pelo `code` do AuthError (supabase-js v2). É a chave estável: a
 * `message` muda entre versões do GoTrue sem aviso, o código não.
 */
const POR_CODIGO: Record<string, string> = {
  invalid_credentials: CREDENCIAL_INVALIDA,
  user_not_found: CREDENCIAL_INVALIDA,
  email_not_confirmed:
    'Essa conta ainda não foi confirmada. Procura o e-mail de confirmação na sua caixa de entrada.',
  email_exists: JA_TEM_CONTA,
  user_already_exists: JA_TEM_CONTA,
  weak_password: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
  same_password: 'Essa é a mesma senha de antes. Escolhe uma diferente.',
  email_address_invalid: 'Esse e-mail não parece válido. Confere se não faltou alguma letra.',
  validation_failed: 'Tem algum campo faltando ou fora do formato. Confere e tenta de novo.',
  over_email_send_rate_limit:
    'Já mandamos e-mails demais pra esse endereço agora há pouco. Espera uns minutos e tenta de novo.',
  over_request_rate_limit:
    'Foram muitas tentativas em pouco tempo. Espera uns minutos e tenta de novo.',
  otp_expired: 'Esse link não vale mais. Pede um novo que a gente manda outro.',
  signup_disabled: 'O cadastro está fechado no momento.',
  email_provider_disabled: 'A entrada por e-mail está desativada no momento.',
};

/**
 * Rede caída x erro do servidor são coisas diferentes pra quem está lendo: uma
 * pede "tenta de novo", a outra não adianta insistir. É o R8 — registro perdido
 * no quarto com Wi-Fi fraco é o cenário normal deste app, não a exceção.
 */
export function ehErroDeRede(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as { name?: string; status?: number; message?: string };
  if (e.name === 'AuthRetryableFetchError') return true;
  if (e.status === 0) return true;
  return /failed to fetch|network request failed|networkerror/i.test(e.message ?? '');
}

/**
 * Fallback por texto, para códigos que o GoTrue ainda não emite ou que chegam
 * de versões diferentes. Nunca é o caminho principal — o `code` é.
 */
function porMensagem(mensagem: string): string | null {
  const m = mensagem.toLowerCase();
  if (m.includes('invalid login credentials')) return CREDENCIAL_INVALIDA;
  if (m.includes('user not found')) return CREDENCIAL_INVALIDA;
  if (m.includes('email not confirmed')) return POR_CODIGO.email_not_confirmed;
  if (m.includes('already registered') || m.includes('already been registered')) return JA_TEM_CONTA;
  if (m.includes('password should be at least')) return POR_CODIGO.weak_password;
  if (m.includes('should be different')) return POR_CODIGO.same_password;
  if (m.includes('unable to validate email') || m.includes('is invalid'))
    return POR_CODIGO.email_address_invalid;
  if (m.includes('rate limit')) return POR_CODIGO.over_request_rate_limit;
  if (m.includes('expired') || m.includes('invalid or has expired')) return POR_CODIGO.otp_expired;
  return null;
}

/**
 * Recebe o erro cru do supabase-js e devolve uma frase em PT-BR pronta pra tela.
 * Nunca devolve string vazia e nunca vaza a mensagem original em inglês.
 */
export function traduzirErroAuth(erro: unknown): string {
  if (!erro) return GENERICO;
  if (ehErroDeRede(erro)) return SEM_REDE;

  const e = erro as { code?: string; message?: string };

  if (e.code && POR_CODIGO[e.code]) return POR_CODIGO[e.code];
  if (e.message) {
    const traduzida = porMensagem(e.message);
    if (traduzida) return traduzida;
  }

  return GENERICO;
}

/**
 * Validação local da senha, antes de gastar ida ao servidor.
 *
 * Mora aqui junto da copy porque signup e "definir nova senha" precisam da
 * MESMA regra e da MESMA frase — se divergirem, a mãe lê um mínimo na hora de
 * criar a conta e outro na hora de trocar a senha.
 */
export function erroDeSenhaLocal(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return POR_CODIGO.weak_password;
  return null;
}
