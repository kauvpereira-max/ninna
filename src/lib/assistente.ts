/**
 * O cliente do assistente — só a chamada à Edge Function.
 *
 * Nenhuma regra mora aqui. A superfície de consulta, a barreira de saúde, a
 * narração e o teto diário estão do outro lado, no servidor, porque é lá que
 * elas não podem ser contornadas por um cliente modificado.
 *
 * Mesmo contrato de erro do resto de `src/lib`: nunca joga exceção. Falha vira
 * frase pronta para a mãe ler, porque a alternativa é uma tela vermelha às 3h
 * da manhã.
 */

import { supabase } from './supabase';

export type RespostaDoAssistente = {
  texto: string;
  /** Quantas perguntas ainda cabem hoje. `null` quando o servidor não disse. */
  restantes: number | null;
  /** `true` quando o teto diário foi atingido — a tela some com o campo. */
  limite: boolean;
  /** `true` quando falta assinatura — a tela oferece o caminho pro plano. */
  semAssinatura: boolean;
};

const ERRO_REDE =
  'Não consegui falar com a Ninna agora. Tenta de novo em instantes — seus registros estão salvos.';

/**
 * `functions.invoke` e não `fetch`: ele já anexa o JWT da sessão, que é o que
 * faz a RLS valer dentro da função. Montar o header à mão seria uma chance a
 * mais de esquecer disso.
 */
export async function perguntar(
  pergunta: string,
  babyId: string
): Promise<RespostaDoAssistente> {
  try {
    const { data, error } = await supabase.functions.invoke('assistente', {
      body: { pergunta, babyId },
    });

    if (error) {
      console.warn('[assistente] falha na chamada:', error.message);
      return { texto: ERRO_REDE, restantes: null, limite: false, semAssinatura: false };
    }

    const corpo = data as { resposta?: unknown; restantes?: unknown; limite?: unknown; semAssinatura?: unknown };
    const texto = typeof corpo?.resposta === 'string' ? corpo.resposta : ERRO_REDE;

    return {
      texto,
      restantes: typeof corpo?.restantes === 'number' ? corpo.restantes : null,
      limite: corpo?.limite === true,
      semAssinatura: (corpo as { semAssinatura?: unknown })?.semAssinatura === true,
    };
  } catch (erro) {
    console.warn('[assistente] exceção:', erro);
    return { texto: ERRO_REDE, restantes: null, limite: false, semAssinatura: false };
  }
}
